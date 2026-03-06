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

// TaskHandler wires HTTP routes to TaskService.
type TaskHandler struct {
	svc *service.TaskService
	hub *sse.Hub
}

func NewTaskHandler(svc *service.TaskService, hub *sse.Hub) *TaskHandler {
	return &TaskHandler{svc: svc, hub: hub}
}

// GET /tasks
func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
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

	// Always resolve from DB — JWT household_id may be stale after household join/approval.
	hhID, err := h.svc.GetMemberHouseholdID(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	if hhID == nil {
		respond(w, http.StatusOK, envelope{"tasks": []domain.Task{}})
		return
	}

	filter := domain.TaskFilter{
		HouseholdID: hhID,
	}

	if cat := r.URL.Query().Get("category"); cat != "" {
		c := domain.Category(cat)
		filter.Category = &c
	}
	if d := r.URL.Query().Get("done"); d != "" {
		done := d == "true"
		filter.Done = &done
	}
	filter.Search = r.URL.Query().Get("search")

	tasks, err := h.svc.ListTasks(filter)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"tasks": tasks})
}

// GET /tasks/{id}
func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid task id"})
		return
	}
	task, err := h.svc.GetTask(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"task": task})
}

// POST /tasks
func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	// Always resolve from DB — JWT household_id may be stale after household join/approval.
	hhID, err := h.svc.GetMemberHouseholdID(memberID)
	if err != nil {
		respondError(w, err)
		return
	}
	if hhID == nil {
		respond(w, http.StatusBadRequest, envelope{"error": "must be in a household to create tasks"})
		return
	}

	var body domain.CreateTaskInput
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}

	body.HouseholdID = *hhID
	body.ActorID = memberID

	task, err := h.svc.CreateTask(body)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(task.HouseholdID)
	respond(w, http.StatusCreated, envelope{"task": task})
}

// PATCH /tasks/{id}
func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}
	actorID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id in token"})
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid task id"})
		return
	}
	var body domain.UpdateTaskInput
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	task, err := h.svc.UpdateTask(id, body, actorID)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(task.HouseholdID)
	respond(w, http.StatusOK, envelope{"task": task})
}

// GET /tasks/{id}/activity
func (h *TaskHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid task id"})
		return
	}
	activities, err := h.svc.GetActivity(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, envelope{"activities": activities})
}

// DELETE /tasks/{id}
func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid task id"})
		return
	}
	task, err := h.svc.GetTask(id)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := h.svc.DeleteTask(id); err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(task.HouseholdID)
	respond(w, http.StatusNoContent, nil)
}

// POST /tasks/{id}/comments
func (h *TaskHandler) AddComment(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid task id"})
		return
	}
	var body struct {
		AuthorID uuid.UUID `json:"author_id"`
		Body     string    `json:"body"`
	}
	if err := decode(r, &body); err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid request body"})
		return
	}
	task, err := h.svc.GetTask(taskID)
	if err != nil {
		respondError(w, err)
		return
	}
	comment, err := h.svc.AddComment(taskID, body.AuthorID, body.Body)
	if err != nil {
		respondError(w, err)
		return
	}
	h.hub.Notify(task.HouseholdID)
	respond(w, http.StatusCreated, envelope{"comment": comment})
}
