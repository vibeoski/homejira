package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newMemberSvc(repo *mockMemberRepo) *MemberService {
	return NewMemberService(repo)
}

// ── ListMembers ───────────────────────────────────────────────────────────────

func TestMemberService_ListMembers(t *testing.T) {
	repo := newMockMemberRepo()
	repo.seed(&domain.Member{ID: uuid.New(), Name: "Alice"})
	repo.seed(&domain.Member{ID: uuid.New(), Name: "Bob"})
	svc := newMemberSvc(repo)

	members, err := svc.ListMembers()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(members) != 2 {
		t.Errorf("got %d members, want 2", len(members))
	}
}

func TestMemberService_ListMembers_Empty(t *testing.T) {
	svc := newMemberSvc(newMockMemberRepo())

	members, err := svc.ListMembers()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(members) != 0 {
		t.Errorf("got %d members, want 0", len(members))
	}
}

// ── GetMember ─────────────────────────────────────────────────────────────────

func TestMemberService_GetMember_Found(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Carol"}
	repo.seed(m)
	svc := newMemberSvc(repo)

	got, err := svc.GetMember(m.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != m.ID {
		t.Errorf("got member %v, want %v", got.ID, m.ID)
	}
}

func TestMemberService_GetMember_NotFound(t *testing.T) {
	svc := newMemberSvc(newMockMemberRepo())

	_, err := svc.GetMember(uuid.New(), nil)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── CreateMember ──────────────────────────────────────────────────────────────

func TestMemberService_CreateMember(t *testing.T) {
	svc := newMemberSvc(newMockMemberRepo())

	m, err := svc.CreateMember("Dave", "👤", "#ff0000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Name != "Dave" {
		t.Errorf("got name %q, want %q", m.Name, "Dave")
	}
	if m.Avatar != "👤" {
		t.Errorf("got avatar %q, want %q", m.Avatar, "👤")
	}
	if m.Color != "#ff0000" {
		t.Errorf("got color %q, want %q", m.Color, "#ff0000")
	}
	if m.ID == uuid.Nil {
		t.Error("expected non-nil ID")
	}
}

// ── UpdateProfile ─────────────────────────────────────────────────────────────

func TestMemberService_UpdateProfile_Success(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Eve", Avatar: "🌸", Color: "#aabbcc"}
	repo.seed(m)
	svc := newMemberSvc(repo)

	updated, err := svc.UpdateProfile(m.ID, "Eve Updated", "🌺", "#112233")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Name != "Eve Updated" {
		t.Errorf("got name %q, want %q", updated.Name, "Eve Updated")
	}
	if updated.Avatar != "🌺" {
		t.Errorf("got avatar %q, want %q", updated.Avatar, "🌺")
	}
}

func TestMemberService_UpdateProfile_EmptyName(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Frank"}
	repo.seed(m)
	svc := newMemberSvc(repo)

	_, err := svc.UpdateProfile(m.ID, "", "🦊", "#000000")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestMemberService_UpdateProfile_NameTooLong(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Grace"}
	repo.seed(m)
	svc := newMemberSvc(repo)

	longName := string(make([]byte, 201))
	_, err := svc.UpdateProfile(m.ID, longName, "🌿", "#ffffff")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── ListByHousehold ───────────────────────────────────────────────────────────

func TestMemberService_ListByHousehold(t *testing.T) {
	repo := newMockMemberRepo()
	hhID := uuid.New()
	repo.seed(&domain.Member{ID: uuid.New(), Name: "Alice", HouseholdID: &hhID})
	repo.seed(&domain.Member{ID: uuid.New(), Name: "Bob", HouseholdID: &hhID})
	repo.seed(&domain.Member{ID: uuid.New(), Name: "Carol"}) // different household
	svc := newMemberSvc(repo)

	members, err := svc.ListByHousehold(hhID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(members) != 2 {
		t.Errorf("got %d members, want 2", len(members))
	}
}

func TestMemberService_UpdateProfile_MemberNotFound(t *testing.T) {
	svc := newMemberSvc(newMockMemberRepo())

	_, err := svc.UpdateProfile(uuid.New(), "Henry", "🎩", "#123456")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
