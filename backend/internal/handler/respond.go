package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/homejira/api/internal/domain"
)

type envelope map[string]any

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	msg := "internal server error"

	switch {
	case errors.Is(err, domain.ErrNotFound):
		status = http.StatusNotFound
		msg = err.Error()
	case errors.Is(err, domain.ErrInvalidInput):
		status = http.StatusUnprocessableEntity
		msg = err.Error()
	case errors.Is(err, domain.ErrUnauthorized):
		status = http.StatusUnauthorized
		msg = err.Error()
	case errors.Is(err, domain.ErrAlreadyExists):
		status = http.StatusConflict
		msg = err.Error()
	}

	respond(w, status, envelope{"error": msg})
}

func decode(r *http.Request, dst any) error {
	return json.NewDecoder(r.Body).Decode(dst)
}
