package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newAuthSvc(members *mockMemberRepo) *AuthService {
	return NewAuthService(members, nil, "test-secret-32-chars-padding!!!!!")
}

// ── CheckPhone ────────────────────────────────────────────────────────────────

func TestAuthService_CheckPhone_Found(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1234567890", Name: "Alice"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	got, err := svc.CheckPhone("+1234567890")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != m.ID {
		t.Errorf("got member %v, want %v", got.ID, m.ID)
	}
}

func TestAuthService_CheckPhone_NotFound(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())

	_, err := svc.CheckPhone("+0000000000")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── Login ─────────────────────────────────────────────────────────────────────

func TestAuthService_Login_Success(t *testing.T) {
	repo := newMockMemberRepo()
	const phone = "+1111111111"
	const mpin = "1234"
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin(mpin), Name: "Bob"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	token, got, err := svc.Login(phone, mpin)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if got.ID != m.ID {
		t.Errorf("got member %v, want %v", got.ID, m.ID)
	}
}

func TestAuthService_Login_UnknownPhone(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())

	_, _, err := svc.Login("+9999999999", "1234")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

func TestAuthService_Login_WrongMpin(t *testing.T) {
	repo := newMockMemberRepo()
	const phone = "+2222222222"
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("9876"), Name: "Carol"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	_, _, err := svc.Login(phone, "0000")
	if !errors.Is(err, domain.ErrWrongMpin) {
		t.Fatalf("want ErrWrongMpin, got %v", err)
	}
}

// ── Register ──────────────────────────────────────────────────────────────────

func TestAuthService_Register_Success(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())

	token, m, err := svc.Register(domain.RegisterInput{
		Name:   "Dave",
		Avatar: "👤",
		Phone:  "+3333333333",
		Mpin:   "5678",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if m.Name != "Dave" {
		t.Errorf("got name %q, want %q", m.Name, "Dave")
	}
}

// ── ValidateToken ─────────────────────────────────────────────────────────────

func TestAuthService_ValidateToken_RoundTrip(t *testing.T) {
	repo := newMockMemberRepo()
	svc := newAuthSvc(repo)

	token, m, err := svc.Register(domain.RegisterInput{
		Name:   "Eve",
		Avatar: "🌸",
		Phone:  "+4444444444",
		Mpin:   "1111",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	claims, err := svc.ValidateToken(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if claims.MemberID != m.ID.String() {
		t.Errorf("claims.MemberID = %q, want %q", claims.MemberID, m.ID.String())
	}
}

func TestAuthService_ValidateToken_Invalid(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())

	_, err := svc.ValidateToken("not.a.jwt")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

func TestAuthService_ValidateToken_DeletedMember(t *testing.T) {
	repo := newMockMemberRepo()
	svc := newAuthSvc(repo)

	token, m, err := svc.Register(domain.RegisterInput{
		Name: "Ghost", Avatar: "👻", Phone: "+5555555555", Mpin: "2222",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	// Remove the member from the repo to simulate deletion.
	delete(repo.members, m.ID)
	delete(repo.byPhone, m.Phone)

	_, err = svc.ValidateToken(token)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized after member deleted, got %v", err)
	}
}

// ── Refresh ───────────────────────────────────────────────────────────────────

func TestAuthService_Refresh_Success(t *testing.T) {
	repo := newMockMemberRepo()
	svc := newAuthSvc(repo)

	_, m, _ := svc.Register(domain.RegisterInput{
		Name: "Frank", Avatar: "🦊", Phone: "+6666666666", Mpin: "3333",
	})

	token, refreshed, err := svc.Refresh(m.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if refreshed.ID != m.ID {
		t.Errorf("got member %v, want %v", refreshed.ID, m.ID)
	}
}

func TestAuthService_Refresh_NotFound(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())

	_, _, err := svc.Refresh(uuid.New())
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── ChangeMpin ────────────────────────────────────────────────────────────────

func TestAuthService_ChangeMpin_Success(t *testing.T) {
	repo := newMockMemberRepo()
	const phone = "+7777777777"
	const oldPin = "1234"
	const newPin = "5678"
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin(oldPin), Name: "Grace"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	if err := svc.ChangeMpin(m.ID, oldPin, newPin); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify new pin works.
	_, _, err := svc.Login(phone, newPin)
	if err != nil {
		t.Fatalf("login with new pin: %v", err)
	}
}

func TestAuthService_ChangeMpin_WrongCurrent(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+8888888888", MpinHash: mustHashMpin("9999"), Name: "Hank"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	err := svc.ChangeMpin(m.ID, "0000", "1111")
	if !errors.Is(err, domain.ErrWrongMpin) {
		t.Fatalf("want ErrWrongMpin, got %v", err)
	}
}

func TestAuthService_ChangeMpin_InvalidLength(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+9999999999", MpinHash: mustHashMpin("1234"), Name: "Ivy"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	err := svc.ChangeMpin(m.ID, "1234", "12")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}
