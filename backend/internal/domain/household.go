package domain

import (
	"time"

	"github.com/google/uuid"
)

// HouseholdKind distinguishes between a "home" and a more generic "group".
type HouseholdKind string

const (
	HouseholdKindHome  HouseholdKind = "home"
	HouseholdKindGroup HouseholdKind = "group"
)

// Household represents a group of members sharing tasks.
type Household struct {
	ID        uuid.UUID     `json:"id"`
	Name      string        `json:"name"`
	Kind      HouseholdKind `json:"kind"`
	JoinCode  string        `json:"join_code"`
	CreatedBy uuid.UUID     `json:"created_by"`
	CreatedAt time.Time     `json:"created_at"`
}

// JoinRequestStatus captures the lifecycle of a join request.
type JoinRequestStatus string

const (
	JoinRequestPending  JoinRequestStatus = "pending"
	JoinRequestApproved JoinRequestStatus = "approved"
	JoinRequestRejected JoinRequestStatus = "rejected"
)

// HouseholdJoinRequest represents a member asking to join a household.
type HouseholdJoinRequest struct {
	ID          uuid.UUID         `json:"id"`
	HouseholdID uuid.UUID         `json:"household_id"`
	RequesterID uuid.UUID         `json:"requester_id"`
	Status      JoinRequestStatus `json:"status"`
	CreatedAt   time.Time         `json:"created_at"`
	DecidedAt   *time.Time        `json:"decided_at,omitempty"`
	DecidedBy   *uuid.UUID        `json:"decided_by,omitempty"`
	Note        string            `json:"note,omitempty"`

	// Expanded relationships
	Requester *Member    `json:"requester,omitempty"`
	Household *Household `json:"household,omitempty"`
}

// InviteStatus captures the lifecycle of a household invite.
type InviteStatus string

const (
	InvitePending  InviteStatus = "pending"
	InviteAccepted InviteStatus = "accepted"
	InviteRejected InviteStatus = "rejected"
	InviteExpired  InviteStatus = "expired"
)

// HouseholdInvite represents an invitation to join a household.
type HouseholdInvite struct {
	ID           uuid.UUID    `json:"id"`
	HouseholdID  uuid.UUID    `json:"household_id"`
	InvitedPhone string       `json:"invited_phone,omitempty"`
	InvitedName  string       `json:"invited_name,omitempty"`
	Status       InviteStatus `json:"status"`
	CreatedBy    uuid.UUID    `json:"created_by"`
	CreatedAt    time.Time    `json:"created_at"`

	// Expanded relationships
	Household *Household `json:"household,omitempty"`
}

// HouseholdInviteLink is a shareable link token that lets anyone join a household.
type HouseholdInviteLink struct {
	ID          uuid.UUID  `json:"id"`
	HouseholdID uuid.UUID  `json:"household_id"`
	CreatedBy   uuid.UUID  `json:"created_by"`
	Token       string     `json:"token"`
	ExpiresAt   time.Time  `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// HouseholdInviteLinkRepository manages invite link persistence.
type HouseholdInviteLinkRepository interface {
	Create(householdID, createdBy uuid.UUID, token string, expiresAt time.Time) (*HouseholdInviteLink, error)
	FindByToken(token string) (*HouseholdInviteLink, error)
}

// HouseholdRepository encapsulates basic household operations.
type HouseholdRepository interface {
	Create(name string, kind HouseholdKind, createdBy uuid.UUID, joinCode string) (*Household, error)
	FindByID(id uuid.UUID) (*Household, error)
	FindByJoinCode(joinCode string) (*Household, error)
	Delete(id uuid.UUID) error
}

// HouseholdJoinRequestRepository manages join request persistence.
type HouseholdJoinRequestRepository interface {
	Create(householdID uuid.UUID, requesterID uuid.UUID) (*HouseholdJoinRequest, error)
	FindPendingByHousehold(householdID uuid.UUID) ([]HouseholdJoinRequest, error)
	FindPendingByRequester(requesterID uuid.UUID) (*HouseholdJoinRequest, error)
	FindByID(id uuid.UUID) (*HouseholdJoinRequest, error)
	UpdateStatus(id uuid.UUID, status JoinRequestStatus, decidedBy uuid.UUID) (*HouseholdJoinRequest, error)
	DeleteByID(id uuid.UUID) error
}

// HouseholdInviteRepository manages invite persistence.
type HouseholdInviteRepository interface {
	Create(householdID uuid.UUID, invitedPhone, invitedName string, createdBy uuid.UUID) (*HouseholdInvite, error)
	FindPendingForPhone(phone string) ([]HouseholdInvite, error)
	FindByID(id uuid.UUID) (*HouseholdInvite, error)
	UpdateStatus(id uuid.UUID, status InviteStatus) (*HouseholdInvite, error)
}

