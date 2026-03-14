package service

import (
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

// TaskService handles business logic for tasks.
type TaskService struct {
	tasks      domain.TaskRepository
	members    domain.MemberRepository
	activities domain.ActivityRepository
}

func NewTaskService(tasks domain.TaskRepository, members domain.MemberRepository, activities domain.ActivityRepository) *TaskService {
	return &TaskService{tasks: tasks, members: members, activities: activities}
}

func (s *TaskService) ListTasks(filter domain.TaskFilter) ([]domain.Task, error) {
	return s.tasks.FindAll(filter)
}

// GetMemberHouseholdID fetches the current household_id for a member from the DB.
// Used by handlers instead of reading the (potentially stale) JWT claim.
func (s *TaskService) GetMemberHouseholdID(memberID uuid.UUID) (*uuid.UUID, error) {
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, err
	}
	return m.HouseholdID, nil
}

func (s *TaskService) GetTask(id uuid.UUID, callerHouseholdID *uuid.UUID) (*domain.Task, error) {
	t, err := s.tasks.FindByID(id)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && t.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}
	return t, nil
}

func (s *TaskService) CreateTask(input domain.CreateTaskInput) (*domain.Task, error) {
	if err := s.validateTaskInput(input.Title, input.Category, input.Priority, input.AssigneeID); err != nil {
		return nil, err
	}
	task, err := s.tasks.Create(input)
	if err != nil {
		return nil, err
	}
	actor := &input.ActorID
	s.activities.Create(task.ID, actor, domain.ActivityCreated, nil) //nolint:errcheck
	return task, nil
}

func (s *TaskService) UpdateTask(id uuid.UUID, input domain.UpdateTaskInput, actorID uuid.UUID, callerHouseholdID *uuid.UUID) (*domain.Task, error) {
	old, err := s.tasks.FindByID(id)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && old.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}
	if input.Category != nil && !validCategory(*input.Category) {
		return nil, fmt.Errorf("%w: invalid category", domain.ErrInvalidInput)
	}
	if input.Priority != nil && !validPriority(*input.Priority) {
		return nil, fmt.Errorf("%w: invalid priority", domain.ErrInvalidInput)
	}
	if input.AssigneeID != nil {
		if _, err := s.members.FindByID(*input.AssigneeID); err != nil {
			return nil, fmt.Errorf("%w: assignee not found", domain.ErrInvalidInput)
		}
	}

	task, err := s.tasks.Update(id, input)
	if err != nil {
		return nil, err
	}

	actor := &actorID
	s.recordUpdateActivities(old, task, input, actor)
	return task, nil
}

func (s *TaskService) DeleteTask(id uuid.UUID, callerHouseholdID *uuid.UUID) error {
	t, err := s.tasks.FindByID(id)
	if err != nil {
		return err
	}
	if callerHouseholdID != nil && t.HouseholdID != *callerHouseholdID {
		return domain.ErrNotFound
	}
	return s.tasks.Delete(id)
}

func (s *TaskService) AddComment(taskID, authorID uuid.UUID, body string, callerHouseholdID *uuid.UUID) (*domain.Comment, error) {
	if strings.TrimSpace(body) == "" {
		return nil, fmt.Errorf("%w: comment body required", domain.ErrInvalidInput)
	}
	t, err := s.tasks.FindByID(taskID)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && t.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}
	if _, err := s.members.FindByID(authorID); err != nil {
		return nil, fmt.Errorf("%w: author not found", domain.ErrInvalidInput)
	}
	return s.tasks.AddComment(taskID, authorID, body)
}

func (s *TaskService) GetActivity(taskID uuid.UUID, callerHouseholdID *uuid.UUID) ([]domain.Activity, error) {
	t, err := s.tasks.FindByID(taskID)
	if err != nil {
		return nil, err
	}
	if callerHouseholdID != nil && t.HouseholdID != *callerHouseholdID {
		return nil, domain.ErrNotFound
	}
	return s.activities.FindByTask(taskID)
}

// recordUpdateActivities diffs old vs new task and creates an activity for each changed field.
func (s *TaskService) recordUpdateActivities(old, new *domain.Task, input domain.UpdateTaskInput, actorID *uuid.UUID) {
	if input.Done != nil && *input.Done != old.Done {
		kind := domain.ActivityReopened
		if *input.Done {
			kind = domain.ActivityCompleted
		}
		s.activities.Create(new.ID, actorID, kind, nil) //nolint:errcheck
	}

	assigneeChanged := input.AssigneeID != nil && (old.AssigneeID == nil || *input.AssigneeID != *old.AssigneeID)
	if assigneeChanged {
		fromName := ""
		toName := ""
		if old.Assignee != nil {
			fromName = old.Assignee.Name
		}
		if new.Assignee != nil {
			toName = new.Assignee.Name
		}
		s.activities.Create(new.ID, actorID, domain.ActivityAssigned, map[string]string{ //nolint:errcheck
			"from": fromName,
			"to":   toName,
		})
	}

	if input.Priority != nil && *input.Priority != old.Priority {
		s.activities.Create(new.ID, actorID, domain.ActivityPriorityChanged, map[string]string{ //nolint:errcheck
			"from": string(old.Priority),
			"to":   string(*input.Priority),
		})
	}

	if input.Category != nil && *input.Category != old.Category {
		s.activities.Create(new.ID, actorID, domain.ActivityCategoryChanged, map[string]string{ //nolint:errcheck
			"from": string(old.Category),
			"to":   string(*input.Category),
		})
	}

	if input.Title != nil && *input.Title != old.Title {
		s.activities.Create(new.ID, actorID, domain.ActivityTitleChanged, map[string]string{ //nolint:errcheck
			"to": *input.Title,
		})
	}

	if input.Notes != nil && *input.Notes != old.Notes {
		s.activities.Create(new.ID, actorID, domain.ActivityNotesChanged, nil) //nolint:errcheck
	}

	if input.ClearDueAt {
		s.activities.Create(new.ID, actorID, domain.ActivityDueCleared, nil) //nolint:errcheck
	} else if input.DueAt != nil {
		formatted := input.DueAt.Format("Jan 2, 2006")
		if old.DueAt == nil || !old.DueAt.Equal(*input.DueAt) {
			s.activities.Create(new.ID, actorID, domain.ActivityDueSet, map[string]string{ //nolint:errcheck
				"to": formatted,
			})
		}
	}
}

func (s *TaskService) validateTaskInput(title string, category domain.Category, priority domain.Priority, assigneeID *uuid.UUID) error {
	if title == "" {
		return fmt.Errorf("%w: title required", domain.ErrInvalidInput)
	}
	if !validCategory(category) {
		return fmt.Errorf("%w: invalid category", domain.ErrInvalidInput)
	}
	if !validPriority(priority) {
		return fmt.Errorf("%w: invalid priority", domain.ErrInvalidInput)
	}
	if assigneeID != nil {
		if _, err := s.members.FindByID(*assigneeID); err != nil {
			return fmt.Errorf("%w: assignee not found", domain.ErrInvalidInput)
		}
	}
	return nil
}

func validCategory(c domain.Category) bool {
	switch c {
	case domain.CategoryChore, domain.CategoryErrand, domain.CategoryRepair:
		return true
	}
	return false
}

func validPriority(p domain.Priority) bool {
	switch p {
	case domain.PriorityUrgent, domain.PriorityHigh, domain.PriorityNormal:
		return true
	}
	return false
}

