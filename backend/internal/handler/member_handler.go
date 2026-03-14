package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/homejira/api/internal/middleware"
	"github.com/homejira/api/internal/service"
)

type MemberHandler struct {
	svc        *service.MemberService
	authSvc    *service.AuthService
	appBaseURL string
}

func NewMemberHandler(svc *service.MemberService, authSvc *service.AuthService, appBaseURL string) *MemberHandler {
	return &MemberHandler{svc: svc, authSvc: authSvc, appBaseURL: appBaseURL}
}

// GET /members
func (h *MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	callerID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	// Always look up from DB — JWT household_id may be stale after household join/approval.
	caller, err := h.svc.GetMember(callerID, nil)
	if err != nil {
		respondError(w, err)
		return
	}
	if caller.HouseholdID == nil {
		respond(w, http.StatusOK, envelope{"members": []any{}})
		return
	}
	members, err := h.svc.ListByHousehold(*caller.HouseholdID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"members": members})
}

// GET /members/{id}
func (h *MemberHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	callerID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	caller, err := h.svc.GetMember(callerID, nil)
	if err != nil {
		respondError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}
	member, err := h.svc.GetMember(id, caller.HouseholdID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"member": member})
}

// PATCH /members/me
func (h *MemberHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
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
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Color  string `json:"color"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}

	member, err := h.svc.UpdateProfile(memberID, body.Name, body.Avatar, body.Color)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"member": member})
}


