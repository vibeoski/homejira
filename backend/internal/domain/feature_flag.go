package domain

import "time"

type FeatureFlag struct {
	Key       string
	Enabled   bool
	UpdatedAt time.Time
}

type FeatureFlagRepository interface {
	IsEnabled(key string) (bool, error)
	List() ([]FeatureFlag, error)
}
