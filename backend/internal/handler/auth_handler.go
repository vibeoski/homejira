package handler

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
	"github.com/homejira/api/internal/middleware"
	"github.com/homejira/api/internal/service"
)

var phoneRegexp = regexp.MustCompile(`^\+?[0-9]{7,15}$`)

// PATCH /auth/mpin — change mPIN (requires valid JWT + current mPIN)
func (h *AuthHandler) ChangeMpin(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	var body struct {
		CurrentMpin string `json:"current_mpin"`
		NewMpin     string `json:"new_mpin"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if len(body.CurrentMpin) != 4 || len(body.NewMpin) != 4 {
		respond(w, http.StatusBadRequest, envelope{"error": "mPINs must be 4 digits"})
		return
	}

	if err := h.svc.ChangeMpin(memberID, body.CurrentMpin, body.NewMpin); err != nil {
		if errors.Is(err, domain.ErrWrongMpin) {
			respond(w, http.StatusUnauthorized, envelope{"error": "current mPIN is incorrect"})
			return
		}
		respondError(w, err)
		return
	}
	respond(w, http.StatusNoContent, nil)
}

// POST /auth/refresh
// Requires a valid JWT. Returns a fresh token reflecting the current DB state (e.g. after household approval).
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	token, member, err := h.svc.Refresh(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"token": token, "member": member})
}

// AuthHandler handles the phone+mPIN authentication flow.
type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// POST /auth/check-phone
// Body:     { "phone": "+821012345678" }
// Response: { "registered": true/false }
func (h *AuthHandler) CheckPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if !phoneRegexp.MatchString(body.Phone) {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid phone number"})
		return
	}

	_, err := h.svc.CheckPhone(body.Phone)
	if errors.Is(err, domain.ErrNotFound) {
		respond(w, http.StatusOK, envelope{"registered": false})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"registered": true})
}

// POST /auth/login
// Body:     { "phone": "...", "mpin": "1234" }
// Response: { "token": "...", "member": {...} }
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
		Mpin  string `json:"mpin"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if len(body.Mpin) != 4 {
		respond(w, http.StatusBadRequest, envelope{"error": "mPIN must be 4 digits"})
		return
	}

	token, member, err := h.svc.Login(body.Phone, body.Mpin)
	if errors.Is(err, domain.ErrUnauthorized) || errors.Is(err, domain.ErrWrongMpin) {
		respond(w, http.StatusUnauthorized, envelope{"error": "invalid phone or mPIN"})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"token": token, "member": member})
}

// POST /auth/email/send-verification
// Body:     { "email": "user@example.com", "app_base_url": "https://homejira.app" }
// Response: 204 No Content
func (h *AuthHandler) SendEmailVerification(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	var body struct {
		Email      string `json:"email"`
		AppBaseURL string `json:"app_base_url"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if body.Email == "" {
		respond(w, http.StatusBadRequest, envelope{"error": "email is required"})
		return
	}

	if err := h.svc.SendEmailVerification(memberID, body.Email, body.AppBaseURL); err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusNoContent, nil)
}

// GET /auth/email/verify?token=xxx  (public route)
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		respond(w, http.StatusBadRequest, envelope{"error": "token is required"})
		return
	}
	if err := h.svc.VerifyEmail(token); err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"verified": true})
}

// POST /auth/register
// Body:     { "phone": "...", "name": "Example User", "avatar": "🧑", "mpin": "1234", "firebase_token": "...", "referral_token": "optional" }
// Response: { "token": "...", "member": {...} }
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone         string `json:"phone"`
		Name          string `json:"name"`
		Avatar        string `json:"avatar"`
		Mpin          string `json:"mpin"`
		FirebaseToken string `json:"firebase_token"`
		ReferralToken string `json:"referral_token"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if !phoneRegexp.MatchString(body.Phone) || body.Name == "" || body.Avatar == "" || len(body.Mpin) != 4 {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid registration input"})
		return
	}

	token, member, err := h.svc.Register(domain.RegisterInput{
		Phone:         body.Phone,
		Name:          body.Name,
		Avatar:        body.Avatar,
		Mpin:          body.Mpin,
		FirebaseToken: body.FirebaseToken,
		ReferralToken: body.ReferralToken,
	})
	if errors.Is(err, domain.ErrAlreadyExists) {
		respond(w, http.StatusConflict, envelope{"error": "phone already registered"})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, envelope{"token": token, "member": member})
}
