package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/homejira/api/internal/domain"
	"github.com/homejira/api/internal/service"
)

type contextKey string

const ClaimsKey contextKey = "auth_claims"

// RequireAuth validates the Bearer JWT and injects the claims into the request context.
func RequireAuth(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := authSvc.ValidateToken(tokenStr)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves the auth claims injected by RequireAuth.
func ClaimsFromContext(ctx context.Context) (*domain.Claims, bool) {
	c, ok := ctx.Value(ClaimsKey).(*domain.Claims)
	return c, ok
}
