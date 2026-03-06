package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// fixedWindow tracks request counts within a time window per key.
type fixedWindow struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	count     int
	expiresAt time.Time
}

func newFixedWindow() *fixedWindow {
	fw := &fixedWindow{buckets: make(map[string]*bucket)}
	// Periodically evict expired buckets to avoid unbounded growth.
	go func() {
		for range time.Tick(5 * time.Minute) {
			fw.mu.Lock()
			now := time.Now()
			for k, b := range fw.buckets {
				if now.After(b.expiresAt) {
					delete(fw.buckets, k)
				}
			}
			fw.mu.Unlock()
		}
	}()
	return fw
}

// allow returns true if the key is under the limit for the given window.
func (fw *fixedWindow) allow(key string, limit int, window time.Duration) bool {
	fw.mu.Lock()
	defer fw.mu.Unlock()

	now := time.Now()
	b, ok := fw.buckets[key]
	if !ok || now.After(b.expiresAt) {
		fw.buckets[key] = &bucket{count: 1, expiresAt: now.Add(window)}
		return true
	}
	if b.count >= limit {
		return false
	}
	b.count++
	return true
}

var authLimiter = newFixedWindow()

// RateLimitAuth limits each IP to 10 requests per minute on the auth route group.
func RateLimitAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		// Respect X-Forwarded-For when running behind a reverse proxy
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			ip = xff
		}

		if !authLimiter.allow(ip, 10, time.Minute) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"too many requests — try again in a minute"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
