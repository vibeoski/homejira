package domain

import (
	"time"

	"github.com/google/uuid"
)

// CoinTransaction records a single coin earn event for a member.
type CoinTransaction struct {
	ID        uuid.UUID              `json:"id"`
	MemberID  uuid.UUID              `json:"member_id"`
	Amount    int                    `json:"amount"`
	Reason    string                 `json:"reason"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// ReferralLink is a permanent shareable link tied to a member.
// When someone registers via the link, the member earns 10 coins.
type ReferralLink struct {
	ID        uuid.UUID `json:"id"`
	MemberID  uuid.UUID `json:"member_id"`
	Token     string    `json:"token"`
	CreatedAt time.Time `json:"created_at"`
}

// CoinRepository manages coin balance and transaction history.
type CoinRepository interface {
	// Award atomically inserts a transaction record and increments the member's coin balance.
	Award(memberID uuid.UUID, amount int, reason string, meta map[string]interface{}) error
	// GetBalance returns the current coin total for a member.
	GetBalance(memberID uuid.UUID) (int, error)
	// ListTransactions returns all earn events for a member, newest first.
	ListTransactions(memberID uuid.UUID) ([]CoinTransaction, error)
}

// ReferralRepository manages app referral link persistence.
type ReferralRepository interface {
	// Upsert returns the existing link for the member, or creates a new one.
	Upsert(memberID uuid.UUID, token string) (*ReferralLink, error)
	// FindByToken looks up a referral link by its token value.
	FindByToken(token string) (*ReferralLink, error)
	// FindByMember returns the referral link for a member if it exists.
	FindByMember(memberID uuid.UUID) (*ReferralLink, error)
}
