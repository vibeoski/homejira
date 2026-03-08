package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newAuthSvc(members *mockMemberRepo) *AuthService {
	return NewAuthService(members, nil, "test-secret-32-chars-padding!!!!!", &stubMailer{}, &stubVerificationRepo{}, nil, nil)
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

// ── Register with Firebase token ──────────────────────────────────────────────

func newAuthSvcWithFirebase(members *mockMemberRepo, fbVerifier *mockFirebaseVerifier) *AuthService {
	return NewAuthService(members, nil, "test-secret-32-chars-padding!!!!!", &stubMailer{}, &stubVerificationRepo{}, fbVerifier, nil)
}

func TestAuthService_Register_FirebaseToken_Success(t *testing.T) {
	const phone = "+1500000001"
	fbVerifier := &mockFirebaseVerifier{phone: phone}
	svc := newAuthSvcWithFirebase(newMockMemberRepo(), fbVerifier)

	_, m, err := svc.Register(domain.RegisterInput{
		Name: "Zara", Avatar: "🌟", Phone: phone, Mpin: "1234",
		FirebaseToken: "valid-token",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Phone != phone {
		t.Errorf("got phone %q, want %q", m.Phone, phone)
	}
}

func TestAuthService_Register_FirebaseToken_PhoneMismatch(t *testing.T) {
	fbVerifier := &mockFirebaseVerifier{phone: "+1999999999"}
	svc := newAuthSvcWithFirebase(newMockMemberRepo(), fbVerifier)

	_, _, err := svc.Register(domain.RegisterInput{
		Name: "Bad", Avatar: "❌", Phone: "+1500000002", Mpin: "1234",
		FirebaseToken: "mismatched-token",
	})
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

func TestAuthService_Register_FirebaseToken_VerifyFails(t *testing.T) {
	fbVerifier := &mockFirebaseVerifier{err: errors.New("token expired")}
	svc := newAuthSvcWithFirebase(newMockMemberRepo(), fbVerifier)

	_, _, err := svc.Register(domain.RegisterInput{
		Name: "Bad", Avatar: "❌", Phone: "+1500000003", Mpin: "1234",
		FirebaseToken: "expired-token",
	})
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── VerifyPhone ───────────────────────────────────────────────────────────────

func TestAuthService_VerifyPhone_Success(t *testing.T) {
	const phone = "+1600000001"
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("1234"), Name: "Vera"}
	repo.seed(m)
	fbVerifier := &mockFirebaseVerifier{phone: phone}
	svc := newAuthSvcWithFirebase(repo, fbVerifier)

	got, err := svc.VerifyPhone(m.ID, phone, "valid-firebase-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != m.ID {
		t.Errorf("got member %v, want %v", got.ID, m.ID)
	}
	// Confirm phone_verified is set on the stored member.
	stored, _ := repo.FindByID(m.ID)
	if !stored.PhoneVerified {
		t.Error("expected PhoneVerified=true after VerifyPhone")
	}
}

func TestAuthService_VerifyPhone_PhoneMismatch(t *testing.T) {
	const phone = "+1600000002"
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("1234"), Name: "Walt"}
	repo.seed(m)
	// Firebase returns a different phone than the member's.
	fbVerifier := &mockFirebaseVerifier{phone: "+1999999999"}
	svc := newAuthSvcWithFirebase(repo, fbVerifier)

	_, err := svc.VerifyPhone(m.ID, phone, "mismatched-token")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

func TestAuthService_VerifyPhone_TokenInvalid(t *testing.T) {
	const phone = "+1600000003"
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("1234"), Name: "Xena"}
	repo.seed(m)
	// Firebase returns an error (expired/invalid token).
	fbVerifier := &mockFirebaseVerifier{err: errors.New("token expired")}
	svc := newAuthSvcWithFirebase(repo, fbVerifier)

	_, err := svc.VerifyPhone(m.ID, phone, "bad-token")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── SendEmailVerification ─────────────────────────────────────────────────────

func TestAuthService_SendEmailVerification_Success(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1000000001", MpinHash: mustHashMpin("1234"), Name: "Jay"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	if err := svc.SendEmailVerification(m.ID, "jay@example.com", "http://localhost:3000"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// email should be stored on the member
	got, _ := repo.FindByID(m.ID)
	if got.Email != "jay@example.com" {
		t.Errorf("email not stored, got %q", got.Email)
	}
}

func TestAuthService_SendEmailVerification_InvalidEmail(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1000000002", MpinHash: mustHashMpin("1234"), Name: "Kay"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	err := svc.SendEmailVerification(m.ID, "not-an-email", "http://localhost:3000")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── VerifyEmail ───────────────────────────────────────────────────────────────

func newAuthSvcWithVerification(members *mockMemberRepo, verifications *recordingVerificationRepo) *AuthService {
	return NewAuthService(members, nil, "test-secret-32-chars-padding!!!!!", &stubMailer{}, verifications, nil, nil)
}

func TestAuthService_VerifyEmail_Success(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1000000003", MpinHash: mustHashMpin("1234"), Name: "Lee"}
	repo.seed(m)

	vRepo := newRecordingVerificationRepo()
	svc := newAuthSvcWithVerification(repo, vRepo)

	// First send a verification (records the token in vRepo)
	if err := svc.SendEmailVerification(m.ID, "lee@example.com", "http://localhost:3000"); err != nil {
		t.Fatalf("send: %v", err)
	}

	token := vRepo.lastToken
	if err := svc.VerifyEmail(token); err != nil {
		t.Fatalf("verify: %v", err)
	}

	got, _ := repo.FindByID(m.ID)
	if !got.EmailVerified {
		t.Error("expected EmailVerified=true")
	}
}

func TestAuthService_VerifyEmail_NotFound(t *testing.T) {
	svc := newAuthSvc(newMockMemberRepo())
	err := svc.VerifyEmail("nonexistent-token")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── UpdateEmail ───────────────────────────────────────────────────────────────

func TestAuthService_UpdateEmail_Success(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1000000004", MpinHash: mustHashMpin("1234"), Name: "Max"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	got, err := svc.UpdateEmail(m.ID, "max@example.com", "http://localhost:3000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Email != "max@example.com" {
		t.Errorf("email not updated, got %q", got.Email)
	}
}

func TestAuthService_UpdateEmail_InvalidEmail(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1000000005", MpinHash: mustHashMpin("1234"), Name: "Nan"}
	repo.seed(m)
	svc := newAuthSvc(repo)

	_, err := svc.UpdateEmail(m.ID, "bad", "http://localhost:3000")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── Feature flag gates ────────────────────────────────────────────────────────

func newAuthSvcWithFlags(members *mockMemberRepo, flags map[string]bool) *AuthService {
	flagRepo := newMockFeatureFlagRepo(flags)
	flagSvc := NewFeatureFlagService(flagRepo)
	return NewAuthService(members, nil, "test-secret-32-chars-padding!!!!!", &stubMailer{}, &stubVerificationRepo{}, nil, flagSvc)
}

func TestAuthService_SendEmailVerification_FlagDisabled(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1100000001", MpinHash: mustHashMpin("1234"), Name: "Oscar"}
	repo.seed(m)
	svc := newAuthSvcWithFlags(repo, map[string]bool{"email_verification": false})

	err := svc.SendEmailVerification(m.ID, "oscar@example.com", "http://localhost:3000")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput when email_verification disabled, got %v", err)
	}
}

func TestAuthService_SendEmailVerification_FlagEnabled(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1100000002", MpinHash: mustHashMpin("1234"), Name: "Petra"}
	repo.seed(m)
	svc := newAuthSvcWithFlags(repo, map[string]bool{"email_verification": true})

	if err := svc.SendEmailVerification(m.ID, "petra@example.com", "http://localhost:3000"); err != nil {
		t.Fatalf("unexpected error when email_verification enabled: %v", err)
	}
}

func TestAuthService_VerifyPhone_FlagDisabled(t *testing.T) {
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: "+1200000001", MpinHash: mustHashMpin("1234"), Name: "Quinn"}
	repo.seed(m)
	svc := newAuthSvcWithFlags(repo, map[string]bool{"phone_verification": false})

	_, err := svc.VerifyPhone(m.ID, m.Phone, "firebase-token")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput when phone_verification disabled, got %v", err)
	}
}

func TestAuthService_VerifyPhone_FlagEnabled_NoFirebaseClient(t *testing.T) {
	const phone = "+1200000002"
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("1234"), Name: "Rosa"}
	repo.seed(m)
	svc := newAuthSvcWithFlags(repo, map[string]bool{"phone_verification": true})

	// firebaseClient is nil — verification skipped, phone marked verified
	got, err := svc.VerifyPhone(m.ID, phone, "firebase-token")
	if err != nil {
		t.Fatalf("unexpected error when firebase client nil: %v", err)
	}
	if got == nil || !got.PhoneVerified {
		t.Error("expected PhoneVerified=true when firebase client nil")
	}
}

func TestAuthService_VerifyPhone_FlagEnabled_Success(t *testing.T) {
	const phone = "+1200000003"
	repo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Phone: phone, MpinHash: mustHashMpin("1234"), Name: "Sam"}
	repo.seed(m)

	flagRepo := newMockFeatureFlagRepo(map[string]bool{"phone_verification": true})
	flagSvc := NewFeatureFlagService(flagRepo)
	fbVerifier := &mockFirebaseVerifier{phone: phone}
	svc := NewAuthService(repo, nil, "test-secret-32-chars-padding!!!!!", &stubMailer{}, &stubVerificationRepo{}, fbVerifier, flagSvc)

	got, err := svc.VerifyPhone(m.ID, phone, "valid-firebase-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || !got.PhoneVerified {
		t.Error("expected PhoneVerified=true")
	}
}
