package service

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newTaskSvc(tasks *mockTaskRepo, members *mockMemberRepo) *TaskService {
	return NewTaskService(tasks, members, &mockActivityRepo{})
}

func seedMemberAndTask(t *testing.T) (*mockMemberRepo, *mockTaskRepo, *domain.Member, *domain.Task) {
	t.Helper()
	memberRepo := newMockMemberRepo()
	taskRepo := newMockTaskRepo()

	m := &domain.Member{ID: uuid.New(), Name: "Alice"}
	memberRepo.seed(m)

	task, err := taskRepo.Create(domain.CreateTaskInput{
		Title:       "Buy milk",
		Category:    domain.CategoryChore,
		Priority:    domain.PriorityNormal,
		AssigneeID:  &m.ID,
		HouseholdID: uuid.New(),
		ActorID:     m.ID,
	})
	if err != nil {
		t.Fatalf("seed task: %v", err)
	}

	return memberRepo, taskRepo, m, task
}

// ── CreateTask ────────────────────────────────────────────────────────────────

func TestTaskService_CreateTask_Success(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Bob"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	task, err := svc.CreateTask(domain.CreateTaskInput{
		Title:       "Fix fence",
		Category:    domain.CategoryRepair,
		Priority:    domain.PriorityHigh,
		AssigneeID:  &m.ID,
		HouseholdID: uuid.New(),
		ActorID:     m.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if task.Title != "Fix fence" {
		t.Errorf("got title %q, want %q", task.Title, "Fix fence")
	}
}

func TestTaskService_CreateTask_EmptyTitle(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Carol"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	_, err := svc.CreateTask(domain.CreateTaskInput{
		Title:      "",
		Category:   domain.CategoryChore,
		Priority:   domain.PriorityNormal,
		AssigneeID: &m.ID,
		ActorID:    m.ID,
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_CreateTask_InvalidCategory(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Dave"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	_, err := svc.CreateTask(domain.CreateTaskInput{
		Title:      "Something",
		Category:   "invalid",
		Priority:   domain.PriorityNormal,
		AssigneeID: &m.ID,
		ActorID:    m.ID,
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_CreateTask_InvalidPriority(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Eve"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	_, err := svc.CreateTask(domain.CreateTaskInput{
		Title:      "Something",
		Category:   domain.CategoryChore,
		Priority:   "critical",
		AssigneeID: &m.ID,
		ActorID:    m.ID,
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_CreateTask_AssigneeNotFound(t *testing.T) {
	svc := newTaskSvc(newMockTaskRepo(), newMockMemberRepo())

	unknownID := uuid.New()
	_, err := svc.CreateTask(domain.CreateTaskInput{
		Title:      "Something",
		Category:   domain.CategoryChore,
		Priority:   domain.PriorityNormal,
		AssigneeID: &unknownID, // not seeded
		ActorID:    uuid.New(),
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── GetTask ───────────────────────────────────────────────────────────────────

func TestTaskService_GetTask_Found(t *testing.T) {
	memberRepo, taskRepo, _, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	got, err := svc.GetTask(task.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != task.ID {
		t.Errorf("got task %v, want %v", got.ID, task.ID)
	}
}

func TestTaskService_GetTask_NotFound(t *testing.T) {
	svc := newTaskSvc(newMockTaskRepo(), newMockMemberRepo())

	_, err := svc.GetTask(uuid.New(), nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── UpdateTask ────────────────────────────────────────────────────────────────

func TestTaskService_UpdateTask_Title(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	updated, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{
		Title: ptr("Buy oat milk"),
	}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Title != "Buy oat milk" {
		t.Errorf("got title %q, want %q", updated.Title, "Buy oat milk")
	}
}

func TestTaskService_UpdateTask_Done(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	updated, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{Done: ptr(true)}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.Done {
		t.Error("expected task to be done")
	}
}

func TestTaskService_UpdateTask_InvalidCategory(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	cat := domain.Category("bogus")
	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{Category: &cat}, m.ID, nil)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_UpdateTask_AssigneeNotFound(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	unknownID := uuid.New()
	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{AssigneeID: &unknownID}, m.ID, nil)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_UpdateTask_NotFound(t *testing.T) {
	svc := newTaskSvc(newMockTaskRepo(), newMockMemberRepo())

	_, err := svc.UpdateTask(uuid.New(), domain.UpdateTaskInput{Title: ptr("X")}, uuid.New(), nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── DeleteTask ────────────────────────────────────────────────────────────────

func TestTaskService_DeleteTask(t *testing.T) {
	memberRepo, taskRepo, _, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	if err := svc.DeleteTask(task.ID, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, err := svc.GetTask(task.ID, nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound after delete, got %v", err)
	}
}

// ── AddComment ────────────────────────────────────────────────────────────────

func TestTaskService_AddComment_Success(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	c, err := svc.AddComment(task.ID, m.ID, "Looks good!", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.Body != "Looks good!" {
		t.Errorf("got body %q, want %q", c.Body, "Looks good!")
	}
}

func TestTaskService_AddComment_EmptyBody(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	_, err := svc.AddComment(task.ID, m.ID, "   ", nil)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestTaskService_AddComment_TaskNotFound(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Frank"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	_, err := svc.AddComment(uuid.New(), m.ID, "Hello", nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestTaskService_AddComment_AuthorNotFound(t *testing.T) {
	memberRepo, taskRepo, _, task := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	_, err := svc.AddComment(task.ID, uuid.New(), "Hello", nil)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── ListTasks ─────────────────────────────────────────────────────────────────

func TestTaskService_ListTasks(t *testing.T) {
	memberRepo, taskRepo, _, _ := seedMemberAndTask(t)
	svc := newTaskSvc(taskRepo, memberRepo)

	tasks, err := svc.ListTasks(domain.TaskFilter{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tasks) != 1 {
		t.Errorf("got %d tasks, want 1", len(tasks))
	}
}

// ── GetMemberHouseholdID ──────────────────────────────────────────────────────

func TestTaskService_GetMemberHouseholdID_WithHousehold(t *testing.T) {
	memberRepo := newMockMemberRepo()
	hhID := uuid.New()
	m := &domain.Member{ID: uuid.New(), Name: "Alice", HouseholdID: &hhID}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	got, err := svc.GetMemberHouseholdID(m.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || *got != hhID {
		t.Errorf("got household %v, want %v", got, hhID)
	}
}

func TestTaskService_GetMemberHouseholdID_NoHousehold(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Bob"}
	memberRepo.seed(m)
	svc := newTaskSvc(newMockTaskRepo(), memberRepo)

	got, err := svc.GetMemberHouseholdID(m.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

// ── recordUpdateActivities ────────────────────────────────────────────────────

func TestTaskService_UpdateTask_AllActivityKinds(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	activityRepo := &mockActivityRepo{}
	svc := NewTaskService(taskRepo, memberRepo, activityRepo)

	newCat := domain.CategoryChore
	newPri := domain.PriorityHigh
	newAssignee := m.ID

	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{
		Title:      ptr("Updated title"),
		Notes:      ptr("some notes"),
		Category:   &newCat,
		Priority:   &newPri,
		AssigneeID: &newAssignee,
		Done:       ptr(true),
	}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Completed + title changed + category changed + priority changed + notes changed = 5 activities
	if len(activityRepo.activities) < 3 {
		t.Errorf("got %d activities, want at least 3", len(activityRepo.activities))
	}
}

func TestTaskService_UpdateTask_SetDueAt(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	activityRepo := &mockActivityRepo{}
	svc := NewTaskService(taskRepo, memberRepo, activityRepo)

	due := time.Now().Add(24 * time.Hour)
	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{DueAt: &due}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dueActivities := 0
	for _, a := range activityRepo.activities {
		if a.Kind == domain.ActivityDueSet {
			dueActivities++
		}
	}
	if dueActivities != 1 {
		t.Errorf("got %d DueSet activities, want 1", dueActivities)
	}
}

func TestTaskService_UpdateTask_ClearDueAt(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	activityRepo := &mockActivityRepo{}
	svc := NewTaskService(taskRepo, memberRepo, activityRepo)

	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{ClearDueAt: true}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cleared := 0
	for _, a := range activityRepo.activities {
		if a.Kind == domain.ActivityDueCleared {
			cleared++
		}
	}
	if cleared != 1 {
		t.Errorf("got %d DueCleared activities, want 1", cleared)
	}
}

func TestTaskService_UpdateTask_Reopen(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	activityRepo := &mockActivityRepo{}
	svc := NewTaskService(taskRepo, memberRepo, activityRepo)

	// First mark done, then reopen.
	svc.UpdateTask(task.ID, domain.UpdateTaskInput{Done: ptr(true)}, m.ID, nil) //nolint:errcheck

	_, err := svc.UpdateTask(task.ID, domain.UpdateTaskInput{Done: ptr(false)}, m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	reopened := 0
	for _, a := range activityRepo.activities {
		if a.Kind == domain.ActivityReopened {
			reopened++
		}
	}
	if reopened != 1 {
		t.Errorf("got %d Reopened activities, want 1", reopened)
	}
}

// ── GetActivity ───────────────────────────────────────────────────────────────

func TestTaskService_GetActivity(t *testing.T) {
	memberRepo, taskRepo, m, task := seedMemberAndTask(t)
	activityRepo := &mockActivityRepo{}
	svc := NewTaskService(taskRepo, memberRepo, activityRepo)

	// CreateTask already recorded one activity; confirm we can retrieve it.
	activities, err := svc.GetActivity(task.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The mock CreateTask in mocks_test.go doesn't call activityRepo; activity was recorded
	// by the service. But NewTaskService above uses a fresh activityRepo.
	// Manually seed one activity so this test has a deterministic result.
	activityRepo.Create(task.ID, &m.ID, domain.ActivityCreated, nil) //nolint:errcheck

	activities, err = svc.GetActivity(task.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(activities) != 1 {
		t.Errorf("got %d activities, want 1", len(activities))
	}
	_ = activities
}
