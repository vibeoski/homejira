package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newGrocerySvc(groceries *mockGroceryRepo, members *mockMemberRepo) *GroceryService {
	return NewGroceryService(groceries, members)
}

func seedGrocery(t *testing.T, repo *mockGroceryRepo, hhID uuid.UUID, title string) *domain.Grocery {
	t.Helper()
	g, err := repo.Create(domain.CreateGroceryInput{
		Title:       title,
		HouseholdID: hhID,
	})
	if err != nil {
		t.Fatalf("seed grocery: %v", err)
	}
	return g
}

// ── ListGroceries ─────────────────────────────────────────────────────────────

func TestGroceryService_ListGroceries(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	hhID := uuid.New()
	seedGrocery(t, groceryRepo, hhID, "Milk")
	seedGrocery(t, groceryRepo, hhID, "Eggs")
	seedGrocery(t, groceryRepo, uuid.New(), "Other HH item")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	items, err := svc.ListGroceries(domain.GroceryFilter{HouseholdID: hhID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("got %d items, want 2", len(items))
	}
}

// ── GetGrocery ────────────────────────────────────────────────────────────────

func TestGroceryService_GetGrocery_Success(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	hhID := uuid.New()
	g := seedGrocery(t, groceryRepo, hhID, "Butter")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	got, err := svc.GetGrocery(g.ID, &hhID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Title != "Butter" {
		t.Errorf("got title %q, want %q", got.Title, "Butter")
	}
}

func TestGroceryService_GetGrocery_WrongHousehold(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	g := seedGrocery(t, groceryRepo, uuid.New(), "Butter")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	other := uuid.New()
	_, err := svc.GetGrocery(g.ID, &other)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestGroceryService_GetGrocery_NotFound(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	_, err := svc.GetGrocery(uuid.New(), nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

// ── CreateGrocery ─────────────────────────────────────────────────────────────

func TestGroceryService_CreateGrocery_Success(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	g, err := svc.CreateGrocery(domain.CreateGroceryInput{
		Title:       "Bread",
		HouseholdID: uuid.New(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if g.Title != "Bread" {
		t.Errorf("got %q, want %q", g.Title, "Bread")
	}
}

func TestGroceryService_CreateGrocery_EmptyTitle(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	_, err := svc.CreateGrocery(domain.CreateGroceryInput{HouseholdID: uuid.New()})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("got %v, want ErrInvalidInput", err)
	}
}

func TestGroceryService_CreateGrocery_AssigneeNotFound(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	badID := uuid.New()
	_, err := svc.CreateGrocery(domain.CreateGroceryInput{
		Title:       "Cheese",
		HouseholdID: uuid.New(),
		AssigneeID:  &badID,
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("got %v, want ErrInvalidInput", err)
	}
}

func TestGroceryService_CreateGrocery_WithValidAssignee(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Alice"}
	memberRepo.seed(m)

	svc := newGrocerySvc(newMockGroceryRepo(), memberRepo)
	g, err := svc.CreateGrocery(domain.CreateGroceryInput{
		Title:       "Yogurt",
		HouseholdID: uuid.New(),
		AssigneeID:  &m.ID,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if *g.AssigneeID != m.ID {
		t.Errorf("assignee mismatch")
	}
}

// ── UpdateGrocery ─────────────────────────────────────────────────────────────

func TestGroceryService_UpdateGrocery_Success(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	hhID := uuid.New()
	g := seedGrocery(t, groceryRepo, hhID, "Apples")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	updated, err := svc.UpdateGrocery(g.ID, domain.UpdateGroceryInput{Title: ptr("Oranges")}, &hhID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Title != "Oranges" {
		t.Errorf("got %q, want %q", updated.Title, "Oranges")
	}
}

func TestGroceryService_UpdateGrocery_NotFound(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	_, err := svc.UpdateGrocery(uuid.New(), domain.UpdateGroceryInput{}, nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestGroceryService_UpdateGrocery_WrongHousehold(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	g := seedGrocery(t, groceryRepo, uuid.New(), "Pasta")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	other := uuid.New()
	_, err := svc.UpdateGrocery(g.ID, domain.UpdateGroceryInput{}, &other)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestGroceryService_UpdateGrocery_BadAssignee(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	hhID := uuid.New()
	g := seedGrocery(t, groceryRepo, hhID, "Rice")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	bad := uuid.New()
	_, err := svc.UpdateGrocery(g.ID, domain.UpdateGroceryInput{AssigneeID: &bad}, &hhID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("got %v, want ErrInvalidInput", err)
	}
}

// ── DeleteGrocery ─────────────────────────────────────────────────────────────

func TestGroceryService_DeleteGrocery_Success(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	hhID := uuid.New()
	g := seedGrocery(t, groceryRepo, hhID, "Tomatoes")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	if err := svc.DeleteGrocery(g.ID, &hhID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, err := groceryRepo.FindByID(g.ID)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected item deleted, got %v", err)
	}
}

func TestGroceryService_DeleteGrocery_NotFound(t *testing.T) {
	svc := newGrocerySvc(newMockGroceryRepo(), newMockMemberRepo())
	err := svc.DeleteGrocery(uuid.New(), nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestGroceryService_DeleteGrocery_WrongHousehold(t *testing.T) {
	groceryRepo := newMockGroceryRepo()
	g := seedGrocery(t, groceryRepo, uuid.New(), "Spinach")

	svc := newGrocerySvc(groceryRepo, newMockMemberRepo())
	other := uuid.New()
	err := svc.DeleteGrocery(g.ID, &other)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}
