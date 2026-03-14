package domain

import (
	"time"

	"github.com/google/uuid"
)

// Grocery represents a single item in a grocery list.
type Grocery struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Quantity    *string    `json:"quantity,omitempty"`
	Notes       string     `json:"notes"`
	Done        bool       `json:"done"`
	DoneAt      *time.Time `json:"done_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	HouseholdID uuid.UUID  `json:"household_id"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`

	// Populated from joins
	Assignee *Member `json:"assignee,omitempty"`
}

// CreateGroceryInput holds fields for creating a grocery item.
type CreateGroceryInput struct {
	Title       string     `json:"title"`
	Quantity    *string    `json:"quantity,omitempty"`
	Notes       string     `json:"notes"`
	HouseholdID uuid.UUID  `json:"household_id"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	ActorID     uuid.UUID  `json:"-"`
}

// UpdateGroceryInput holds fields for updating a grocery item.
type UpdateGroceryInput struct {
	Title      *string    `json:"title,omitempty"`
	Quantity   *string    `json:"quantity,omitempty"`
	Notes      *string    `json:"notes,omitempty"`
	Done       *bool      `json:"done,omitempty"`
	AssigneeID *uuid.UUID `json:"assignee_id,omitempty"`
}

// GroceryFilter contains query filters for groceries.
type GroceryFilter struct {
	HouseholdID uuid.UUID
	Done        *bool
	Search      string
}

// GroceryRepository defines the persistence contract for groceries.
type GroceryRepository interface {
	FindAll(filter GroceryFilter) ([]Grocery, error)
	FindByID(id uuid.UUID) (*Grocery, error)
	Create(input CreateGroceryInput) (*Grocery, error)
	Update(id uuid.UUID, input UpdateGroceryInput) (*Grocery, error)
	Delete(id uuid.UUID) error
}
