package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/homejira/api/internal/middleware"
	"github.com/homejira/api/internal/service"
)

// CoinHandler handles coin balance, history, and referral link endpoints.
type CoinHandler struct {
	svc *service.CoinService
}

func NewCoinHandler(svc *service.CoinService) *CoinHandler {
	return &CoinHandler{svc: svc}
}

// GET /members/me/coins
// Returns the authenticated member's coin balance and transaction history.
func (h *CoinHandler) GetMyCoins(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}

	balance, txns, err := h.svc.GetMyCoins(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"balance": balance, "transactions": txns})
}

// GET /members/me/referral-link
// Returns the authenticated member's referral link token, creating one if needed.
func (h *CoinHandler) GetOrCreateReferralLink(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}

	token, err := h.svc.GetOrCreateReferralLink(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"token": token})
}

// GET /referral/{token}  (public — no auth required)
// Resolves a referral token to the referrer's public profile (name, avatar, color).
func (h *CoinHandler) GetReferrer(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		respond(w, http.StatusBadRequest, envelope{"error": "token required"})
		return
	}

	referrer, err := h.svc.GetReferrerByToken(token)
	if err != nil {
		respondError(w, err)
		return
	}
	// Return only public fields — never phone or mpin_hash
	respond(w, http.StatusOK, envelope{"referrer": map[string]string{
		"name":   referrer.Name,
		"avatar": referrer.Avatar,
		"color":  referrer.Color,
	}})
}
