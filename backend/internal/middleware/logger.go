package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// Logger is a simple request logger middleware.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"uri", r.RequestURI,
			"remote", r.RemoteAddr,
			"status", ww.status,
			"duration", time.Since(start),
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Flush delegates to the underlying ResponseWriter if it supports http.Flusher.
// Required for SSE (Server-Sent Events) streaming connections.
func (rw *responseWriter) Flush() {
	if f, ok := rw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
