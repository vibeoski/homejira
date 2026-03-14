package service

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

// GroceryService handles business logic for groceries.
type GroceryService struct {
	groceries domain.GroceryRepository
	members   domain.MemberRepository
}

func NewGroceryService(groceries domain.GroceryRepository, members domain.MemberRepository) *GroceryService {
	return &GroceryService{groceries: groceries, members: members}
}

func (s *GroceryService) ListGroceries(filter domain.GroceryFilter) ([]domain.Grocery, error) {
	return s.groceries.FindAll(filter)
}

func (s *GroceryService) GetGrocery(id uuid.UUID, callerHouseholdID *uuid.UUID) (*domain.Grocery, error) {
	g, err := s.groceries.FindByID(id)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && g.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}
	return g, nil
}

func (s *GroceryService) CreateGrocery(input domain.CreateGroceryInput) (*domain.Grocery, error) {
	if input.Title == "" {
		return nil, fmt.Errorf("%w: title required", domain.ErrInvalidInput)
	}
	if input.AssigneeID != nil {
		if _, err := s.members.FindByID(*input.AssigneeID); err != nil {
			return nil, fmt.Errorf("%w: assignee not found", domain.ErrInvalidInput)
		}
	}
	return s.groceries.Create(input)
}

func (s *GroceryService) UpdateGrocery(id uuid.UUID, input domain.UpdateGroceryInput, callerHouseholdID *uuid.UUID) (*domain.Grocery, error) {
	old, err := s.groceries.FindByID(id)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && old.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}

	if input.AssigneeID != nil {
		if _, err := s.members.FindByID(*input.AssigneeID); err != nil {
			return nil, fmt.Errorf("%w: assignee not found", domain.ErrInvalidInput)
		}
	}

	return s.groceries.Update(id, input)
}

func (s *GroceryService) DeleteGrocery(id uuid.UUID, callerHouseholdID *uuid.UUID) error {
	g, err := s.groceries.FindByID(id)
	if err != nil {
		return err
	}
	if callerHouseholdID != nil && g.HouseholdID != *callerHouseholdID {
		return domain.ErrNotFound
	}
	return s.groceries.Delete(id)
}
