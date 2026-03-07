package service

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

const (
	CoinReasonHouseholdInvite = "household_invite" // +20: someone joined via your household invite
	CoinReasonReferral        = "referral"          // +10: someone signed up via your referral link
)

// CoinService manages coin awards and referral link generation.
type CoinService struct {
	coins    domain.CoinRepository
	referral domain.ReferralRepository
	members  domain.MemberRepository
}

func NewCoinService(
	coins domain.CoinRepository,
	referral domain.ReferralRepository,
	members domain.MemberRepository,
) *CoinService {
	return &CoinService{coins: coins, referral: referral, members: members}
}

// Award credits coins to a member and records the transaction.
func (s *CoinService) Award(memberID uuid.UUID, amount int, reason string, meta map[string]interface{}) error {
	return s.coins.Award(memberID, amount, reason, meta)
}

// GetMyCoins returns the current balance and full transaction history for a member.
func (s *CoinService) GetMyCoins(memberID uuid.UUID) (int, []domain.CoinTransaction, error) {
	balance, err := s.coins.GetBalance(memberID)
	if err != nil {
		return 0, nil, err
	}
	txns, err := s.coins.ListTransactions(memberID)
	if err != nil {
		return 0, nil, err
	}
	return balance, txns, nil
}

// GetOrCreateReferralLink returns the member's existing referral link token, creating one if needed.
func (s *CoinService) GetOrCreateReferralLink(memberID uuid.UUID) (string, error) {
	existing, err := s.referral.FindByMember(memberID)
	if err == nil {
		return existing.Token, nil
	}
	if err != domain.ErrNotFound {
		return "", err
	}

	token, err := generateReferralToken()
	if err != nil {
		return "", err
	}

	link, err := s.referral.Upsert(memberID, token)
	if err != nil {
		return "", err
	}
	return link.Token, nil
}

// GetReferrerByToken resolves a referral token to its owner (for the landing page).
// Returns the referrer's name, avatar, and color — no sensitive fields.
func (s *CoinService) GetReferrerByToken(token string) (*domain.Member, error) {
	link, err := s.referral.FindByToken(token)
	if err != nil {
		return nil, err
	}
	return s.members.FindByID(link.MemberID)
}

// ProcessReferral resolves a referral token from a new signup and awards the referrer 10 coins.
// Errors are non-fatal — if the token is invalid the signup still succeeds.
func (s *CoinService) ProcessReferral(referralToken string, newMemberID uuid.UUID) {
	if referralToken == "" {
		return
	}
	link, err := s.referral.FindByToken(referralToken)
	if err != nil {
		return // invalid or expired token — silently ignore
	}
	// Don't self-refer
	if link.MemberID == newMemberID {
		return
	}
	newMember, err := s.members.FindByID(newMemberID)
	if err != nil {
		return
	}
	_ = s.coins.Award(link.MemberID, 10, CoinReasonReferral, map[string]interface{}{
		"referred_name": newMember.Name,
	})
}

func generateReferralToken() (string, error) {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate referral token: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:]), nil
}
