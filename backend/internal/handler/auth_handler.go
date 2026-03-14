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

// usernameRegexp validates: 3–30 chars, alphanumeric + underscore only.
var usernameRegexp = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)

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

// AuthHandler handles the username+mPIN authentication flow.
type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// POST /auth/check-username
// Body:     { "username": "alice" }
// Response: { "registered": true/false }
func (h *AuthHandler) CheckUsername(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if !usernameRegexp.MatchString(body.Username) {
		respond(w, http.StatusBadRequest, envelope{"error": "username must be 3–30 chars (letters, numbers, underscores)"})
		return
	}

	_, err := h.svc.CheckUsername(body.Username)
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
// Body:     { "username": "alice", "mpin": "1234" }
// Response: { "token": "...", "member": {...} }
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Mpin     string `json:"mpin"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if len(body.Mpin) != 4 {
		respond(w, http.StatusBadRequest, envelope{"error": "mPIN must be 4 digits"})
		return
	}

	token, member, err := h.svc.Login(body.Username, body.Mpin)
	if errors.Is(err, domain.ErrUnauthorized) || errors.Is(err, domain.ErrWrongMpin) {
		respond(w, http.StatusUnauthorized, envelope{"error": "invalid username or mPIN"})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"token": token, "member": member})
}

// POST /auth/register
// Body:     { "username": "alice", "name": "Alice", "avatar": "🧑", "mpin": "1234", "referral_token": "optional" }
// Response: { "token": "...", "member": {...} }
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username      string `json:"username"`
		Name          string `json:"name"`
		Avatar        string `json:"avatar"`
		Mpin          string `json:"mpin"`
		ReferralToken string `json:"referral_token"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	if !usernameRegexp.MatchString(body.Username) || body.Name == "" || len(body.Mpin) != 4 {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid registration input"})
		return
	}

	token, member, err := h.svc.Register(domain.RegisterInput{
		Username:      body.Username,
		Name:          body.Name,
		Avatar:        body.Avatar,
		Mpin:          body.Mpin,
		ReferralToken: body.ReferralToken,
	})
	if errors.Is(err, domain.ErrAlreadyExists) {
		respond(w, http.StatusConflict, envelope{"error": "username already taken"})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, envelope{"token": token, "member": member})
}
