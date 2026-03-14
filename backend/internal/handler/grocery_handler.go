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

// GroceryHandler wires HTTP routes to GroceryService.
type GroceryHandler struct {
	svc *service.GroceryService
	hub *sse.Hub
}

func NewGroceryHandler(svc *service.GroceryService, hub *sse.Hub) *GroceryHandler {
	return &GroceryHandler{svc: svc, hub: hub}
}

// GET /groceries
func (h *GroceryHandler) ListGroceries(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}

	householdID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid household id"})
		return
	}

	filter := domain.GroceryFilter{
		HouseholdID: householdID,
	}

	if d := r.URL.Query().Get("done"); d != "" {
		done := d == "true"
		filter.Done = &done
	}
	filter.Search = r.URL.Query().Get("search")

	groceries, err := h.svc.ListGroceries(filter)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"groceries": groceries})
}

func (h *GroceryHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	hhID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "must be in a household"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid id"})
		return
	}
	g, err := h.svc.GetGrocery(id, &hhID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"grocery": g})
}

func (h *GroceryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	memberID, _ := uuid.Parse(claims.MemberID)
	hhID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "must be in a household"})
		return
	}

	var body domain.CreateGroceryInput
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid body"})
		return
	}

	body.HouseholdID = hhID
	body.ActorID = memberID

	g, err := h.svc.CreateGrocery(body)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(g.HouseholdID)
	respond(w, http.StatusCreated, envelope{"grocery": g})
}

func (h *GroceryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	hhID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "must be in a household"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid id"})
		return
	}
	var body domain.UpdateGroceryInput
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid body"})
		return
	}
	g, err := h.svc.UpdateGrocery(id, body, &hhID)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(g.HouseholdID)
	respond(w, http.StatusOK, envelope{"grocery": g})
}

func (h *GroceryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	hhID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "must be in a household"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteGrocery(id, &hhID); err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(hhID)
	respond(w, http.StatusNoContent, nil)
}
