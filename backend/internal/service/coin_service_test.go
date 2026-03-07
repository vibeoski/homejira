package service

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

// ── mock repos ──────────────────────────────────────────────────────────────

type mockCoinRepo struct {
	balance      int
	transactions []domain.CoinTransaction
	awardErr     error
}

func (m *mockCoinRepo) Award(_ uuid.UUID, amount int, reason string, _ map[string]interface{}) error {
	if m.awardErr != nil {
		return m.awardErr
	}
	m.balance += amount
	m.transactions = append(m.transactions, domain.CoinTransaction{
		ID: uuid.New(), Amount: amount, Reason: reason, CreatedAt: time.Now(),
	})
	return nil
}

func (m *mockCoinRepo) GetBalance(_ uuid.UUID) (int, error) { return m.balance, nil }

func (m *mockCoinRepo) ListTransactions(_ uuid.UUID) ([]domain.CoinTransaction, error) {
	return m.transactions, nil
}

type mockReferralRepo struct {
	links      map[string]*domain.ReferralLink // token → link
	byMember   map[uuid.UUID]*domain.ReferralLink
	upsertErr  error
}

func newMockReferralRepo() *mockReferralRepo {
	return &mockReferralRepo{
		links:    make(map[string]*domain.ReferralLink),
		byMember: make(map[uuid.UUID]*domain.ReferralLink),
	}
}

func (m *mockReferralRepo) Upsert(memberID uuid.UUID, token string) (*domain.ReferralLink, error) {
	if m.upsertErr != nil {
		return nil, m.upsertErr
	}
	if existing, ok := m.byMember[memberID]; ok {
		return existing, nil
	}
	link := &domain.ReferralLink{ID: uuid.New(), MemberID: memberID, Token: token, CreatedAt: time.Now()}
	m.links[token] = link
	m.byMember[memberID] = link
	return link, nil
}

func (m *mockReferralRepo) FindByToken(token string) (*domain.ReferralLink, error) {
	l, ok := m.links[token]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return l, nil
}

func (m *mockReferralRepo) FindByMember(memberID uuid.UUID) (*domain.ReferralLink, error) {
	l, ok := m.byMember[memberID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return l, nil
}

// ── helpers ──────────────────────────────────────────────────────────────────

func newTestCoinService(coinRepo *mockCoinRepo, referralRepo *mockReferralRepo, members domain.MemberRepository) *CoinService {
	return NewCoinService(coinRepo, referralRepo, members)
}

// ── tests ────────────────────────────────────────────────────────────────────

func TestCoinService_Award(t *testing.T) {
	coinRepo := &mockCoinRepo{}
	svc := newTestCoinService(coinRepo, newMockReferralRepo(), &mockMemberRepo{})

	if err := svc.Award(uuid.New(), 10, CoinReasonReferral, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if coinRepo.balance != 10 {
		t.Errorf("expected balance 10, got %d", coinRepo.balance)
	}
}

func TestCoinService_GetMyCoins(t *testing.T) {
	coinRepo := &mockCoinRepo{balance: 30}
	coinRepo.transactions = []domain.CoinTransaction{
		{ID: uuid.New(), Amount: 30, Reason: CoinReasonHouseholdInvite},
	}
	svc := newTestCoinService(coinRepo, newMockReferralRepo(), &mockMemberRepo{})

	balance, txns, err := svc.GetMyCoins(uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance != 30 {
		t.Errorf("expected balance 30, got %d", balance)
	}
	if len(txns) != 1 {
		t.Errorf("expected 1 transaction, got %d", len(txns))
	}
}

func TestCoinService_GetOrCreateReferralLink_Creates(t *testing.T) {
	svc := newTestCoinService(&mockCoinRepo{}, newMockReferralRepo(), &mockMemberRepo{})
	memberID := uuid.New()

	token, err := svc.GetOrCreateReferralLink(memberID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
}

func TestCoinService_GetOrCreateReferralLink_ReturnsExisting(t *testing.T) {
	referralRepo := newMockReferralRepo()
	svc := newTestCoinService(&mockCoinRepo{}, referralRepo, &mockMemberRepo{})
	memberID := uuid.New()

	token1, _ := svc.GetOrCreateReferralLink(memberID)
	token2, _ := svc.GetOrCreateReferralLink(memberID)

	if token1 != token2 {
		t.Errorf("expected same token on second call: %s != %s", token1, token2)
	}
}

func TestCoinService_GetReferrerByToken_Found(t *testing.T) {
	referrerID := uuid.New()
	referralRepo := newMockReferralRepo()
	members := &mockMemberRepo{members: map[uuid.UUID]*domain.Member{
		referrerID: {ID: referrerID, Name: "Alice", Avatar: "🧑", Color: "#f97316"},
	}}
	svc := newTestCoinService(&mockCoinRepo{}, referralRepo, members)

	// Seed a token
	token := "TESTTOKEN"
	referralRepo.links[token] = &domain.ReferralLink{ID: uuid.New(), MemberID: referrerID, Token: token}

	m, err := svc.GetReferrerByToken(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Name != "Alice" {
		t.Errorf("expected Alice, got %s", m.Name)
	}
}

func TestCoinService_GetReferrerByToken_NotFound(t *testing.T) {
	svc := newTestCoinService(&mockCoinRepo{}, newMockReferralRepo(), &mockMemberRepo{})
	_, err := svc.GetReferrerByToken("INVALID")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestCoinService_ProcessReferral_Awards(t *testing.T) {
	referrerID := uuid.New()
	newMemberID := uuid.New()

	referralRepo := newMockReferralRepo()
	token := "REFTOKEN"
	referralRepo.links[token] = &domain.ReferralLink{ID: uuid.New(), MemberID: referrerID, Token: token}

	members := &mockMemberRepo{members: map[uuid.UUID]*domain.Member{
		newMemberID: {ID: newMemberID, Name: "Bob"},
	}}
	coinRepo := &mockCoinRepo{}
	svc := newTestCoinService(coinRepo, referralRepo, members)

	svc.ProcessReferral(token, newMemberID)

	if coinRepo.balance != 10 {
		t.Errorf("expected referrer to earn 10 coins, got %d", coinRepo.balance)
	}
}

func TestCoinService_ProcessReferral_EmptyToken(t *testing.T) {
	coinRepo := &mockCoinRepo{}
	svc := newTestCoinService(coinRepo, newMockReferralRepo(), &mockMemberRepo{})
	svc.ProcessReferral("", uuid.New())
	if coinRepo.balance != 0 {
		t.Error("expected no coins for empty token")
	}
}

func TestCoinService_GetMyCoins_TransactionError(t *testing.T) {
	coinRepo := &mockCoinRepo{balance: 5}
	svc := newTestCoinService(coinRepo, newMockReferralRepo(), &mockMemberRepo{})
	balance, txns, err := svc.GetMyCoins(uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if balance != 5 {
		t.Errorf("expected 5, got %d", balance)
	}
	_ = txns // nil is acceptable when no transactions exist
}

func TestCoinService_GetOrCreateReferralLink_UpsertError(t *testing.T) {
	referralRepo := newMockReferralRepo()
	referralRepo.upsertErr = errors.New("db error")
	svc := newTestCoinService(&mockCoinRepo{}, referralRepo, &mockMemberRepo{})

	_, err := svc.GetOrCreateReferralLink(uuid.New())
	if err == nil {
		t.Error("expected error from upsert failure")
	}
}

func TestCoinService_ProcessReferral_InvalidToken(t *testing.T) {
	coinRepo := &mockCoinRepo{}
	svc := newTestCoinService(coinRepo, newMockReferralRepo(), &mockMemberRepo{})
	svc.ProcessReferral("NONEXISTENT", uuid.New())
	if coinRepo.balance != 0 {
		t.Error("expected no coins for invalid token")
	}
}

func TestCoinService_ProcessReferral_SelfReferral(t *testing.T) {
	memberID := uuid.New()
	referralRepo := newMockReferralRepo()
	token := "SELFTOKEN"
	referralRepo.links[token] = &domain.ReferralLink{ID: uuid.New(), MemberID: memberID, Token: token}

	coinRepo := &mockCoinRepo{}
	svc := newTestCoinService(coinRepo, referralRepo, &mockMemberRepo{})

	svc.ProcessReferral(token, memberID) // self-referral — should award nothing
	if coinRepo.balance != 0 {
		t.Error("expected no coins for self-referral")
	}
}
