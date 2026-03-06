package domain

import (
	"time"

	"github.com/google/uuid"
)

// MemberRole indicates what a member can do inside a household.
type MemberRole string

const (
	MemberRoleAdmin  MemberRole = "admin"
	MemberRoleMember MemberRole = "member"
)

// Member represents a household member.
type Member struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Avatar      string     `json:"avatar"`
	Color       string     `json:"color"`
	Phone       string     `json:"phone,omitempty"`        // omitted from list responses
	MpinHash    string     `json:"-"`                      // never serialized
	HouseholdID *uuid.UUID `json:"household_id,omitempty"` // null until they join/create
	Role        MemberRole `json:"role,omitempty"`         // admin/member inside a household
	CreatedAt   time.Time  `json:"created_at"`
}

// MemberRepository defines the persistence contract.
type MemberRepository interface {
	FindAll() ([]Member, error)
	FindByHousehold(householdID uuid.UUID) ([]Member, error)
	FindByID(id uuid.UUID) (*Member, error)
	Create(name, avatar, color string) (*Member, error)

	// Auth-specific methods
	FindByPhone(phone string) (*Member, error)
	CreateWithAuth(name, avatar, color, phone, mpinHash string) (*Member, error)

	// Household / role updates
	UpdateHouseholdAndRole(id uuid.UUID, householdID *uuid.UUID, role MemberRole) (*Member, error)
	ClearHousehold(id uuid.UUID) (*Member, error)

	// Profile update
	UpdateProfile(id uuid.UUID, name, avatar, color string) (*Member, error)

	// Credential update
	UpdateMpin(id uuid.UUID, mpinHash string) error
}
