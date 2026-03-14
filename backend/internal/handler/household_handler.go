package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
	"github.com/homejira/api/internal/middleware"
	"github.com/homejira/api/internal/service"
	"github.com/homejira/api/internal/sse"
)

// HouseholdHandler exposes household-related endpoints.
type HouseholdHandler struct {
	svc *service.HouseholdService
	hub *sse.Hub
}

func NewHouseholdHandler(svc *service.HouseholdService, hub *sse.Hub) *HouseholdHandler {
	return &HouseholdHandler{svc: svc, hub: hub}
}

// GET /households/me
func (h *HouseholdHandler) GetMine(w http.ResponseWriter, r *http.Request) {
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

	household, err := h.svc.GetHouseholdForMember(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"household": household})
}

// POST /households
func (h *HouseholdHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}

	var body struct {
		Name string `json:"name"`
		Kind string `json:"kind"` // "home" or "group"
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}

	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	kind := domain.HouseholdKind(body.Kind)
	household, member, err := h.svc.CreateHousehold(memberID, body.Name, kind)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(household.ID)
	respond(w, http.StatusCreated, envelope{"household": household, "member": member})
}

// POST /households/join-by-code
func (h *HouseholdHandler) JoinByCode(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}

	var body struct {
		Code string `json:"code"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}

	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	req, household, err := h.svc.RequestJoinByCode(memberID, body.Code)
	if err != nil {
		respondError(w, err)
		return
	}
	// Notify the household admin's SSE stream that a new request arrived
	h.hub.Notify(req.HouseholdID)
	respond(w, http.StatusCreated, envelope{"request": req, "household": household})
}

// GET /households/requests/mine
func (h *HouseholdHandler) GetMyRequest(w http.ResponseWriter, r *http.Request) {
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
	req, err := h.svc.GetMyPendingRequest(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"request": req})
}

// POST /households/requests/{id}/cancel
func (h *HouseholdHandler) CancelRequest(w http.ResponseWriter, r *http.Request) {
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
	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request id"})
		return
	}
	if err := h.svc.CancelJoinRequest(memberID, reqID); err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusNoContent, nil)
}

// GET /households/requests
func (h *HouseholdHandler) ListRequests(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	requests, err := h.svc.ListPendingRequestsForAdmin(adminID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"requests": requests})
}

// POST /households/requests/{id}/approve
func (h *HouseholdHandler) ApproveRequest(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request id"})
		return
	}

	req, member, err := h.svc.ApproveJoinRequest(adminID, reqID)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(req.HouseholdID)
	h.hub.NotifyMember(req.RequesterID) // wake the requester's waiting SSE stream
	respond(w, http.StatusOK, envelope{"request": req, "member": member})
}

// POST /households/requests/{id}/reject
func (h *HouseholdHandler) RejectRequest(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	reqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request id"})
		return
	}

	req, err := h.svc.RejectJoinRequest(adminID, reqID)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(req.HouseholdID)
	h.hub.NotifyMember(req.RequesterID) // wake the requester's waiting SSE stream
	respond(w, http.StatusOK, envelope{"request": req})
}

// POST /households/members/{id}/remove
func (h *HouseholdHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	targetID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}
	household, _ := h.svc.GetHouseholdForMember(adminID)
	member, err := h.svc.RemoveMember(adminID, targetID)
	if err != nil {
		respondError(w, err)
		return
	}
	if household != nil {
		h.hub.Notify(household.ID)
	}
	respond(w, http.StatusOK, envelope{"member": member})
}

// POST /households/members/{id}/promote
func (h *HouseholdHandler) PromoteMember(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	targetID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}
	member, err := h.svc.PromoteMember(adminID, targetID)
	if err != nil {
		respondError(w, err)
		return
	}
	if member.HouseholdID != nil {
		h.hub.Notify(*member.HouseholdID)
	}
	respond(w, http.StatusOK, envelope{"member": member})
}

// DELETE /households
func (h *HouseholdHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	household, _ := h.svc.GetHouseholdForMember(memberID)
	if err := h.svc.DeleteHousehold(memberID); err != nil {
		respondError(w, err)
		return
	}
	if household != nil {
		h.hub.Notify(household.ID)
	}
	respond(w, http.StatusNoContent, nil)
}

// POST /households/leave
func (h *HouseholdHandler) Leave(w http.ResponseWriter, r *http.Request) {
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
	household, _ := h.svc.GetHouseholdForMember(memberID)
	member, err := h.svc.LeaveHousehold(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	if household != nil {
		h.hub.Notify(household.ID)
	}
	respond(w, http.StatusOK, envelope{"member": member})
}

// POST /households/invites
func (h *HouseholdHandler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	var body struct {
		Phone string `json:"phone"`
		Name  string `json:"name"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}

	invite, err := h.svc.CreateInviteByPhone(adminID, body.Phone, body.Name)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, envelope{"invite": invite})
}

// GET /households/invites/me
func (h *HouseholdHandler) ListMyInvites(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}

	// Use username from claims if available; fallback to query param.
	username := claims.Username
	if username == "" {
		username = r.URL.Query().Get("username")
	}
	if username == "" {
		respond(w, http.StatusBadRequest, envelope{"error": "username required"})
		return
	}

	invites, err := h.svc.ListInvitesForPhone(username)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"invites": invites})
}

// POST /households/invites/{id}/accept
func (h *HouseholdHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
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

	inviteID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid invite id"})
		return
	}

	invite, member, err := h.svc.AcceptInvite(memberID, inviteID)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(invite.HouseholdID)
	respond(w, http.StatusOK, envelope{"invite": invite, "member": member})
}

// POST /households/invite-link
func (h *HouseholdHandler) CreateInviteLink(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	adminID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}

	token, household, err := h.svc.CreateInviteLink(adminID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, envelope{"token": token, "household": household})
}

// GET /households/link/{token} — public, no auth required
func (h *HouseholdHandler) GetByInviteToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	household, err := h.svc.GetHouseholdByInviteToken(token)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"household": household})
}

// POST /households/link/{token}/join
func (h *HouseholdHandler) JoinByInviteToken(w http.ResponseWriter, r *http.Request) {
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

	token := chi.URLParam(r, "token")
	member, err := h.svc.JoinByInviteToken(memberID, token)
	if err != nil {
		respondError(w, err)
		return
	}
	if member.HouseholdID != nil {
		h.hub.Notify(*member.HouseholdID)
	}
	respond(w, http.StatusOK, envelope{"member": member})
}

// POST /households/invites/{id}/reject
func (h *HouseholdHandler) RejectInvite(w http.ResponseWriter, r *http.Request) {
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

	inviteID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid invite id"})
		return
	}

	invite, err := h.svc.RejectInvite(memberID, inviteID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"invite": invite})
}

