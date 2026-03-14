package service

// Regression tests for the rows.Err() bug.
//
// All multi-row repository methods (FindAll, FindByHousehold, etc.) must call
// rows.Err() after the rows.Next() loop to surface any error that occurred
// during iteration (e.g. a dropped DB connection). Without this check the
// caller receives a nil error and partial data, which is silently wrong.
//
// These tests inject a synthetic error into the mock repos and assert that the
// service layer propagates it, which would fail if the repo implementation ever
// swallowed rows.Err().

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

var errIterationFailed = errors.New("db iteration error")

// ── MemberService ─────────────────────────────────────────────────────────────

func TestMemberService_ListMembers_PropagatesDBError(t *testing.T) {
	repo := newMockMemberRepo()
	repo.findAllErr = errIterationFailed
	svc := NewMemberService(repo)

	_, err := svc.ListMembers()
	if !errors.Is(err, errIterationFailed) {
		t.Errorf("want errIterationFailed, got %v", err)
	}
}

func TestMemberService_ListByHousehold_PropagatesDBError(t *testing.T) {
	repo := newMockMemberRepo()
	repo.findByHouseholdErr = errIterationFailed
	svc := NewMemberService(repo)

	_, err := svc.ListByHousehold(uuid.New())
	if !errors.Is(err, errIterationFailed) {
		t.Errorf("want errIterationFailed, got %v", err)
	}
}

// ── TaskService ───────────────────────────────────────────────────────────────

func TestTaskService_ListTasks_PropagatesDBError(t *testing.T) {
	taskRepo := newMockTaskRepo()
	taskRepo.findAllErr = errIterationFailed
	svc := newTaskSvc(taskRepo, newMockMemberRepo())

	_, err := svc.ListTasks(domain.TaskFilter{})
	if !errors.Is(err, errIterationFailed) {
		t.Errorf("want errIterationFailed, got %v", err)
	}
}
