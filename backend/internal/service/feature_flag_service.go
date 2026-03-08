package service

import "github.com/homejira/api/internal/domain"

// FeatureFlagService provides safe access to feature flags.
type FeatureFlagService struct {
	repo domain.FeatureFlagRepository
}

// NewFeatureFlagService creates a new FeatureFlagService.
func NewFeatureFlagService(repo domain.FeatureFlagRepository) *FeatureFlagService {
	return &FeatureFlagService{repo: repo}
}

// IsEnabled returns whether the named flag is enabled.
// Returns false if the flag does not exist or on any repo error.
func (s *FeatureFlagService) IsEnabled(key string) bool {
	enabled, err := s.repo.IsEnabled(key)
	if err != nil {
		return false
	}
	return enabled
}

// List returns all feature flags.
func (s *FeatureFlagService) List() ([]domain.FeatureFlag, error) {
	return s.repo.List()
}
