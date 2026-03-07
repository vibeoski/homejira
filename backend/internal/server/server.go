package server

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/config"
	"github.com/homejira/api/internal/handler"
	"github.com/homejira/api/internal/middleware"
	"github.com/homejira/api/internal/repository"
	"github.com/homejira/api/internal/service"
	"github.com/homejira/api/internal/sse"
)

type Server struct {
	router *chi.Mux
	cfg    *config.Config
}

func New(cfg *config.Config, db *pgxpool.Pool) *Server {
	// ── Dependency Injection ──────────────────────────────────────
	memberRepo := repository.NewMemberRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	activityRepo := repository.NewActivityRepository(db)
	householdRepo := repository.NewHouseholdRepository(db)
	joinRepo := repository.NewHouseholdJoinRequestRepository(db)
	inviteRepo := repository.NewHouseholdInviteRepository(db)

	memberSvc := service.NewMemberService(memberRepo)
	taskSvc := service.NewTaskService(taskRepo, memberRepo, activityRepo)
	authSvc := service.NewAuthService(memberRepo, cfg.JWTSecret)
	householdSvc := service.NewHouseholdService(householdRepo, memberRepo, joinRepo, inviteRepo, taskRepo)

	hub := sse.NewHub()

	memberH := handler.NewMemberHandler(memberSvc)
	taskH := handler.NewTaskHandler(taskSvc, hub)
	authH := handler.NewAuthHandler(authSvc)
	householdH := handler.NewHouseholdHandler(householdSvc, hub)
	eventH := handler.NewEventHandler(hub, authSvc, taskSvc)

	// ── Router ────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(middleware.Logger)
	rawOrigins := strings.Split(cfg.CORSOrigins, ",")
	allowedOrigins := make([]string, 0, len(rawOrigins))
	for _, o := range rawOrigins {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-Request-ID", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Public: auth endpoints (no JWT required) — rate-limited per IP
		r.Route("/auth", func(r chi.Router) {
			r.Use(middleware.RateLimitAuth)
			r.Post("/check-phone", authH.CheckPhone)
			r.Post("/login", authH.Login)
			r.Post("/register", authH.Register)
		})

		// SSE stream — auth via ?token= query param (EventSource can't set headers)
		r.Get("/events", eventH.Stream)

		// Protected: all app routes require a valid JWT
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(authSvc))

			// Auth refresh — reissues JWT with current DB state
			r.Post("/auth/refresh", authH.Refresh)
			r.Patch("/auth/mpin", authH.ChangeMpin)

			// Members
			r.Route("/members", func(r chi.Router) {
				r.Get("/", memberH.List)
				r.Post("/", memberH.Create)
				r.Patch("/me", memberH.UpdateMe)
				r.Get("/{id}", memberH.Get)
			})

			// Tasks
			r.Route("/tasks", func(r chi.Router) {
				r.Get("/", taskH.List)
				r.Post("/", taskH.Create)
				r.Get("/{id}", taskH.Get)
				r.Patch("/{id}", taskH.Update)
				r.Delete("/{id}", taskH.Delete)
				r.Post("/{id}/comments", taskH.AddComment)
				r.Get("/{id}/activity", taskH.GetActivity)
			})

			// Households / groups
			r.Route("/households", func(r chi.Router) {
				r.Get("/me", householdH.GetMine)
				r.Post("/", householdH.Create)
				r.Post("/join-by-code", householdH.JoinByCode)

				r.Post("/leave", householdH.Leave)
				r.Post("/members/{id}/remove", householdH.RemoveMember)
				r.Post("/members/{id}/promote", householdH.PromoteMember)

				// /requests/mine must be registered before /requests/{id} to avoid route shadowing
				r.Get("/requests/mine", householdH.GetMyRequest)
				r.Get("/requests", householdH.ListRequests)
				r.Post("/requests/{id}/approve", householdH.ApproveRequest)
				r.Post("/requests/{id}/reject", householdH.RejectRequest)
				r.Post("/requests/{id}/cancel", householdH.CancelRequest)

				r.Post("/invites", householdH.CreateInvite)
				r.Get("/invites/me", householdH.ListMyInvites)
				r.Post("/invites/{id}/accept", householdH.AcceptInvite)
				r.Post("/invites/{id}/reject", householdH.RejectInvite)
			})
		})
	})

	return &Server{
		router: r,
		cfg:    cfg,
	}
}

func (s *Server) Start() error {
	addr := fmt.Sprintf(":%s", s.cfg.Port)
	log.Printf("✓ HomeJira API listening on %s", addr)

	srv := &http.Server{
		Addr:        addr,
		Handler:     s.router,
		ReadTimeout: 10 * time.Second,
		// WriteTimeout is 0 (disabled) to allow long-lived SSE connections.
		// Individual handlers enforce their own timeouts via request context.
		WriteTimeout: 0,
		IdleTimeout:  60 * time.Second,
	}

	return srv.ListenAndServe()
}
