package handler

import (
	"net/http"

	"github.com/homejira/api/internal/service"
)

// ConfigHandler exposes the public app configuration endpoint.
type ConfigHandler struct {
	flags *service.FeatureFlagService
}

// NewConfigHandler creates a new ConfigHandler.
func NewConfigHandler(flags *service.FeatureFlagService) *ConfigHandler {
	return &ConfigHandler{flags: flags}
}

// GET /config — public endpoint, no auth required.
// Returns a flat map of feature flag keys to their enabled state.
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	flags, err := h.flags.List()
	if err != nil {
		respondError(w, err)
		return
	}
	result := make(map[string]bool, len(flags))
	for _, f := range flags {
		result[f.Key] = f.Enabled
	}
	respond(w, http.StatusOK, envelope{"flags": result})
}
