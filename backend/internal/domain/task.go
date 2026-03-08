package domain

import (
	"time"

	"github.com/google/uuid"
)

// Category represents a task category.
type Category string

const (
	CategoryGrocery Category = "grocery"
	CategoryChore   Category = "chore"
	CategoryErrand  Category = "errand"
	CategoryRepair  Category = "repair"
)

// Priority represents a task's urgency level.
type Priority string

const (
	PriorityUrgent Priority = "urgent"
	PriorityHigh   Priority = "high"
	PriorityNormal Priority = "normal"
)

// Task is the core aggregate root.
type Task struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Notes       string     `json:"notes"`
	Category    Category   `json:"category"`
	Priority    Priority   `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	HouseholdID uuid.UUID  `json:"household_id"`
	Done        bool       `json:"done"`
	DoneAt      *time.Time `json:"done_at,omitempty"`
	DueAt       *time.Time `json:"due_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	// Populated from joins
	Assignee *Member   `json:"assignee"`
	Comments []Comment `json:"comments,omitempty"`
}

// Comment is a message attached to a task.
type Comment struct {
	ID        uuid.UUID `json:"id"`
	TaskID    uuid.UUID `json:"task_id"`
	AuthorID  uuid.UUID `json:"author_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`

	Author *Member `json:"author,omitempty"`
}

// CreateTaskInput holds validated fields for task creation.
type CreateTaskInput struct {
	Title       string     `json:"title"`
	Notes       string     `json:"notes"`
	Category    Category   `json:"category"`
	Priority    Priority   `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	HouseholdID uuid.UUID  `json:"household_id"`
	DueAt       *time.Time `json:"due_at,omitempty"`
	ActorID     uuid.UUID  `json:"-"` // who triggered the action (not from client body)
}

// UpdateTaskInput holds fields that may be mutated.
type UpdateTaskInput struct {
	Title      *string    `json:"title,omitempty"`
	Notes      *string    `json:"notes,omitempty"`
	Category   *Category  `json:"category,omitempty"`
	Priority   *Priority  `json:"priority,omitempty"`
	AssigneeID *uuid.UUID `json:"assignee_id,omitempty"`
	Done       *bool      `json:"done,omitempty"`
	DueAt      *time.Time `json:"due_at,omitempty"`
	ClearDueAt bool       `json:"clear_due_at,omitempty"`
}

// TaskFilter contains optional query filters.
type TaskFilter struct {
	HouseholdID *uuid.UUID
	Category    *Category
	Done        *bool
	Search      string
}

// TaskRepository defines the persistence contract.
type TaskRepository interface {
	FindAll(filter TaskFilter) ([]Task, error)
	FindByID(id uuid.UUID) (*Task, error)
	Create(input CreateTaskInput) (*Task, error)
	Update(id uuid.UUID, input UpdateTaskInput) (*Task, error)
	Delete(id uuid.UUID) error
	AddComment(taskID uuid.UUID, authorID uuid.UUID, body string) (*Comment, error)
	ReassignTasks(fromMemberID, toMemberID, householdID uuid.UUID) error
}
