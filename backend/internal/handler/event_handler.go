package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/service"
	"github.com/homejira/api/internal/sse"
)

// EventHandler serves the SSE stream at GET /api/v1/events.
type EventHandler struct {
	hub     *sse.Hub
	authSvc *service.AuthService
	taskSvc *service.TaskService
}

func NewEventHandler(hub *sse.Hub, authSvc *service.AuthService, taskSvc *service.TaskService) *EventHandler {
	return &EventHandler{hub: hub, authSvc: authSvc, taskSvc: taskSvc}
}

// Stream handles GET /api/v1/events?token=<jwt>
// EventSource cannot send Authorization headers, so the JWT is passed as a query param.
func (h *EventHandler) Stream(w http.ResponseWriter, r *http.Request) {
	// Validate token from query param
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		respond(w, http.StatusUnauthorized, envelope{"error": "token required"})
		return
	}
	claims, err := h.authSvc.ValidateToken(tokenStr)
	if err != nil {
		respond(w, http.StatusUnauthorized, envelope{"error": "unauthorized"})
		return
	}

	memberID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		respond(w, http.StatusBadRequest, envelope{"error": "invalid member id"})
		return
	}

	// Get household from DB (JWT may be stale)
	hhID, err := h.taskSvc.GetMemberHouseholdID(memberID)
	if err != nil {
		respondError(w, err)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering if present

	flusher, ok := w.(http.Flusher)
	if !ok {
		respond(w, http.StatusInternalServerError, envelope{"error": "streaming unsupported"})
		return
	}

	// Send initial ping so the client knows the connection is live
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	// Subscribe to household channel if in one, otherwise to member channel.
	// Member channel is used while waiting for a join request to be approved/rejected.
	var ch chan struct{}
	var unsubscribe func()
	if hhID != nil {
		ch, unsubscribe = h.hub.Subscribe(*hhID)
	} else {
		ch, unsubscribe = h.hub.SubscribeMember(memberID)
	}
	defer unsubscribe()

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ch:
			fmt.Fprint(w, "data: update\n\n")
			flusher.Flush()
		case <-ticker.C:
			// Keepalive comment — prevents proxy timeouts
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}
