package service

import (
	"testing"
)

func TestFeatureFlagService_IsEnabled_True(t *testing.T) {
	svc := NewFeatureFlagService(newMockFeatureFlagRepo(map[string]bool{"grocery_list": true}))
	if !svc.IsEnabled("grocery_list") {
		t.Error("expected grocery_list to be enabled")
	}
}

func TestFeatureFlagService_IsEnabled_False(t *testing.T) {
	svc := NewFeatureFlagService(newMockFeatureFlagRepo(map[string]bool{"coins": false}))
	if svc.IsEnabled("coins") {
		t.Error("expected coins to be disabled")
	}
}

func TestFeatureFlagService_IsEnabled_Missing(t *testing.T) {
	svc := NewFeatureFlagService(newMockFeatureFlagRepo(map[string]bool{}))
	if svc.IsEnabled("nonexistent") {
		t.Error("expected nonexistent flag to return false")
	}
}

func TestFeatureFlagService_List(t *testing.T) {
	svc := NewFeatureFlagService(newMockFeatureFlagRepo(map[string]bool{"a": true, "b": false}))
	flags, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flags) != 2 {
		t.Errorf("expected 2 flags, got %d", len(flags))
	}
}
