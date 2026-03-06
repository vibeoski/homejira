package domain

import (
	"time"

	"github.com/google/uuid"
)

type ActivityKind string

const (
	ActivityCreated         ActivityKind = "created"
	ActivityCompleted       ActivityKind = "completed"
	ActivityReopened        ActivityKind = "reopened"
	ActivityAssigned        ActivityKind = "assigned"
	ActivityPriorityChanged ActivityKind = "priority_changed"
	ActivityCategoryChanged ActivityKind = "category_changed"
	ActivityTitleChanged    ActivityKind = "title_changed"
	ActivityNotesChanged    ActivityKind = "notes_changed"
	ActivityDueSet          ActivityKind = "due_set"
	ActivityDueCleared      ActivityKind = "due_cleared"
)

// Activity is an immutable event on a task.
type Activity struct {
	ID        uuid.UUID            `json:"id"`
	TaskID    uuid.UUID            `json:"task_id"`
	ActorID   *uuid.UUID           `json:"actor_id,omitempty"`
	Kind      ActivityKind         `json:"kind"`
	Meta      map[string]string    `json:"meta,omitempty"`
	CreatedAt time.Time            `json:"created_at"`

	// Populated from join
	Actor *Member `json:"actor,omitempty"`
}

// ActivityRepository defines persistence for task activities.
type ActivityRepository interface {
	Create(taskID uuid.UUID, actorID *uuid.UUID, kind ActivityKind, meta map[string]string) (*Activity, error)
	FindByTask(taskID uuid.UUID) ([]Activity, error)
}
