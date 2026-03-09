package service

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

// HouseholdService orchestrates household creation, join flows, and invites.
type HouseholdService struct {
	households  domain.HouseholdRepository
	members     domain.MemberRepository
	joins       domain.HouseholdJoinRequestRepository
	invites     domain.HouseholdInviteRepository
	inviteLinks domain.HouseholdInviteLinkRepository
	tasks       domain.TaskRepository
	coins       *CoinService
}

func NewHouseholdService(
	households domain.HouseholdRepository,
	members domain.MemberRepository,
	joins domain.HouseholdJoinRequestRepository,
	invites domain.HouseholdInviteRepository,
	inviteLinks domain.HouseholdInviteLinkRepository,
	tasks domain.TaskRepository,
	coins *CoinService,
) *HouseholdService {
	return &HouseholdService{
		households:  households,
		members:     members,
		joins:       joins,
		invites:     invites,
		inviteLinks: inviteLinks,
		tasks:       tasks,
		coins:       coins,
	}
}

// generateJoinCode creates a short, URL-safe join code.
func generateJoinCode() (string, error) {
	var b [5]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate join code: %w", err)
	}
	code := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:])
	return code, nil
}

// CreateHousehold creates a new household and promotes the creator to admin.
func (s *HouseholdService) CreateHousehold(creatorID uuid.UUID, name string, kind domain.HouseholdKind) (*domain.Household, *domain.Member, error) {
	if name == "" {
		return nil, nil, fmt.Errorf("%w: household name required", domain.ErrInvalidInput)
	}
	if len(name) > 200 {
		return nil, nil, fmt.Errorf("%w: household name must be 200 characters or fewer", domain.ErrInvalidInput)
	}
	if kind != domain.HouseholdKindHome && kind != domain.HouseholdKindGroup {
		return nil, nil, fmt.Errorf("%w: invalid household kind", domain.ErrInvalidInput)
	}

	creator, err := s.members.FindByID(creatorID)
	if err != nil {
		return nil, nil, err
	}

	code, err := generateJoinCode()
	if err != nil {
		return nil, nil, err
	}

	h, err := s.households.Create(name, kind, creator.ID, code)
	if err != nil {
		return nil, nil, err
	}

	updatedMember, err := s.members.UpdateHouseholdAndRole(creator.ID, &h.ID, domain.MemberRoleAdmin)
	if err != nil {
		return nil, nil, err
	}

	return h, updatedMember, nil
}

// RequestJoinByCode creates a join request for the given join code.
func (s *HouseholdService) RequestJoinByCode(memberID uuid.UUID, code string) (*domain.HouseholdJoinRequest, *domain.Household, error) {
	if code == "" {
		return nil, nil, fmt.Errorf("%w: join code required", domain.ErrInvalidInput)
	}

	member, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, nil, err
	}

	h, err := s.households.FindByJoinCode(code)
	if err != nil {
		return nil, nil, err
	}

	// Optional: prevent requesting join if already in a household
	if member.HouseholdID != nil && *member.HouseholdID == h.ID {
		return nil, nil, fmt.Errorf("%w: already in this household", domain.ErrInvalidInput)
	}

	req, err := s.joins.Create(h.ID, member.ID)
	if err != nil {
		return nil, nil, err
	}
	return req, h, nil
}

// ListPendingRequestsForAdmin lists pending join requests for the admin's household.
func (s *HouseholdService) ListPendingRequestsForAdmin(adminID uuid.UUID) ([]domain.HouseholdJoinRequest, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, domain.ErrUnauthorized
	}
	requests, err := s.joins.FindPendingByHousehold(*admin.HouseholdID)
	if err != nil {
		return nil, err
	}
	return requests, nil
}

// ApproveJoinRequest approves a join request; only admins of that household may call it.
func (s *HouseholdService) ApproveJoinRequest(adminID, requestID uuid.UUID) (*domain.HouseholdJoinRequest, *domain.Member, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, nil, domain.ErrUnauthorized
	}

	req, err := s.joins.FindByID(requestID)
	if err != nil {
		return nil, nil, err
	}
	if *admin.HouseholdID != req.HouseholdID {
		return nil, nil, domain.ErrUnauthorized
	}
	if req.Status != domain.JoinRequestPending {
		return nil, nil, fmt.Errorf("%w: join request is no longer pending", domain.ErrInvalidInput)
	}

	updatedReq, err := s.joins.UpdateStatus(req.ID, domain.JoinRequestApproved, admin.ID)
	if err != nil {
		return nil, nil, err
	}

	member, err := s.members.UpdateHouseholdAndRole(req.RequesterID, &req.HouseholdID, domain.MemberRoleMember)
	if err != nil {
		return nil, nil, err
	}

	return updatedReq, member, nil
}

// RejectJoinRequest rejects a join request; only admins of that household may call it.
func (s *HouseholdService) RejectJoinRequest(adminID, requestID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, domain.ErrUnauthorized
	}

	req, err := s.joins.FindByID(requestID)
	if err != nil {
		return nil, err
	}
	if *admin.HouseholdID != req.HouseholdID {
		return nil, domain.ErrUnauthorized
	}

	return s.joins.UpdateStatus(req.ID, domain.JoinRequestRejected, admin.ID)
}

// CreateInviteByPhone allows an admin to invite a phone number to their household.
func (s *HouseholdService) CreateInviteByPhone(adminID uuid.UUID, phone, name string) (*domain.HouseholdInvite, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, domain.ErrUnauthorized
	}
	if phone == "" {
		return nil, fmt.Errorf("%w: phone required", domain.ErrInvalidInput)
	}
	return s.invites.Create(*admin.HouseholdID, phone, name, admin.ID)
}

// ListInvitesForPhone lists pending invites for a given phone (used after login/registration).
func (s *HouseholdService) ListInvitesForPhone(phone string) ([]domain.HouseholdInvite, error) {
	if phone == "" {
		return nil, fmt.Errorf("%w: phone required", domain.ErrInvalidInput)
	}
	return s.invites.FindPendingForPhone(phone)
}

// AcceptInvite attaches the member to the invited household.
func (s *HouseholdService) AcceptInvite(memberID, inviteID uuid.UUID) (*domain.HouseholdInvite, *domain.Member, error) {
	member, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, nil, err
	}

	inv, err := s.invites.FindByID(inviteID)
	if err != nil {
		return nil, nil, err
	}

	// Optional: ensure phone matches, if present.
	if inv.InvitedPhone != "" && member.Phone != "" && inv.InvitedPhone != member.Phone {
		return nil, nil, domain.ErrUnauthorized
	}

	updatedInv, err := s.invites.UpdateStatus(inv.ID, domain.InviteAccepted)
	if err != nil {
		return nil, nil, err
	}

	updatedMember, err := s.members.UpdateHouseholdAndRole(member.ID, &inv.HouseholdID, domain.MemberRoleMember)
	if err != nil {
		return nil, nil, err
	}

	return updatedInv, updatedMember, nil
}

// RejectInvite marks an invite as rejected without changing membership.
func (s *HouseholdService) RejectInvite(memberID, inviteID uuid.UUID) (*domain.HouseholdInvite, error) {
	_, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, err
	}
	inv, err := s.invites.FindByID(inviteID)
	if err != nil {
		return nil, err
	}
	// No strong phone check for now – frontend should only show invites relevant to the user.
	return s.invites.UpdateStatus(inv.ID, domain.InviteRejected)
}

// RemoveMember lets an admin remove another member from their household.
func (s *HouseholdService) RemoveMember(adminID, targetID uuid.UUID) (*domain.Member, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, domain.ErrUnauthorized
	}
	if adminID == targetID {
		return nil, fmt.Errorf("%w: use leave to remove yourself", domain.ErrInvalidInput)
	}

	target, err := s.members.FindByID(targetID)
	if err != nil {
		return nil, err
	}
	if target.HouseholdID == nil || *target.HouseholdID != *admin.HouseholdID {
		return nil, domain.ErrUnauthorized
	}

	if err := s.tasks.ReassignTasks(targetID, adminID, *admin.HouseholdID); err != nil {
		return nil, err
	}

	return s.members.ClearHousehold(targetID)
}

// LeaveHousehold removes the calling member from their household.
// Returns ErrInvalidInput if the member is the sole admin.
func (s *HouseholdService) LeaveHousehold(memberID uuid.UUID) (*domain.Member, error) {
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, err
	}
	if m.HouseholdID == nil {
		return nil, fmt.Errorf("%w: not in a household", domain.ErrInvalidInput)
	}

	all, err := s.members.FindByHousehold(*m.HouseholdID)
	if err != nil {
		return nil, err
	}

	if m.Role == domain.MemberRoleAdmin {
		adminCount := 0
		for _, hm := range all {
			if hm.Role == domain.MemberRoleAdmin {
				adminCount++
			}
		}
		if adminCount <= 1 {
			return nil, fmt.Errorf("%w: you are the only admin — assign another admin before leaving", domain.ErrInvalidInput)
		}
	}

	// Reassign open tasks to another member (prefer admin, fall back to any other member).
	var recipient *domain.Member
	for i := range all {
		if all[i].ID == memberID {
			continue
		}
		if recipient == nil || all[i].Role == domain.MemberRoleAdmin {
			recipient = &all[i]
		}
	}
	if recipient != nil {
		if err := s.tasks.ReassignTasks(memberID, recipient.ID, *m.HouseholdID); err != nil {
			return nil, err
		}
	}

	return s.members.ClearHousehold(memberID)
}

// DeleteHousehold deletes the caller's household entirely. Caller must be an admin.
// Tasks, join requests, and invite links are removed via DB cascade.
// All other members have their household_id cleared.
func (s *HouseholdService) DeleteHousehold(memberID uuid.UUID) error {
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return err
	}
	if m.HouseholdID == nil {
		return fmt.Errorf("%w: not in a household", domain.ErrInvalidInput)
	}
	if m.Role != domain.MemberRoleAdmin {
		return fmt.Errorf("%w: only admins can delete the household", domain.ErrUnauthorized)
	}
	return s.households.Delete(*m.HouseholdID)
}

// GetMyPendingRequest returns the caller's current pending join request, or nil if none exists.
func (s *HouseholdService) GetMyPendingRequest(memberID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	req, err := s.joins.FindPendingByRequester(memberID)
	if err == domain.ErrNotFound {
		return nil, nil
	}
	return req, err
}

// CancelJoinRequest lets the requester withdraw their own pending join request.
func (s *HouseholdService) CancelJoinRequest(memberID, requestID uuid.UUID) error {
	req, err := s.joins.FindByID(requestID)
	if err != nil {
		return err
	}
	if req.RequesterID != memberID {
		return domain.ErrUnauthorized
	}
	if req.Status != domain.JoinRequestPending {
		return fmt.Errorf("%w: request is no longer pending", domain.ErrInvalidInput)
	}
	return s.joins.DeleteByID(requestID)
}

// PromoteMember promotes a non-admin member to admin; only admins may call it.
func (s *HouseholdService) PromoteMember(adminID, targetID uuid.UUID) (*domain.Member, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return nil, domain.ErrUnauthorized
	}
	if adminID == targetID {
		return nil, fmt.Errorf("%w: you are already an admin", domain.ErrInvalidInput)
	}

	target, err := s.members.FindByID(targetID)
	if err != nil {
		return nil, err
	}
	if target.HouseholdID == nil || *target.HouseholdID != *admin.HouseholdID {
		return nil, domain.ErrUnauthorized
	}
	if target.Role == domain.MemberRoleAdmin {
		return nil, fmt.Errorf("%w: member is already an admin", domain.ErrInvalidInput)
	}

	return s.members.UpdateHouseholdAndRole(targetID, target.HouseholdID, domain.MemberRoleAdmin)
}

// CreateInviteLink generates a shareable join link for an admin's household.
// Returns the token and the household (so the caller can build the full URL).
func (s *HouseholdService) CreateInviteLink(adminID uuid.UUID) (string, *domain.Household, error) {
	admin, err := s.members.FindByID(adminID)
	if err != nil {
		return "", nil, err
	}
	if admin.HouseholdID == nil || admin.Role != domain.MemberRoleAdmin {
		return "", nil, domain.ErrUnauthorized
	}

	h, err := s.households.FindByID(*admin.HouseholdID)
	if err != nil {
		return "", nil, err
	}

	token, err := generateJoinCode()
	if err != nil {
		return "", nil, err
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := s.inviteLinks.Create(*admin.HouseholdID, admin.ID, token, expiresAt); err != nil {
		return "", nil, err
	}

	return token, h, nil
}

// GetHouseholdByInviteToken returns the household for a valid, non-expired invite link.
func (s *HouseholdService) GetHouseholdByInviteToken(token string) (*domain.Household, error) {
	link, err := s.inviteLinks.FindByToken(token)
	if err != nil {
		return nil, err
	}
	return s.households.FindByID(link.HouseholdID)
}

// JoinByInviteToken adds the authenticated member to the household referenced by the link.
func (s *HouseholdService) JoinByInviteToken(memberID uuid.UUID, token string) (*domain.Member, error) {
	member, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, err
	}

	link, err := s.inviteLinks.FindByToken(token)
	if err != nil {
		return nil, err
	}

	// Already in any household (same or different) — reject with 422.
	if member.HouseholdID != nil {
		return nil, fmt.Errorf("%w: already in a household", domain.ErrInvalidInput)
	}

	updated, err := s.members.UpdateHouseholdAndRole(memberID, &link.HouseholdID, domain.MemberRoleMember)
	if err != nil {
		return nil, err
	}

	// Award coins to the invite link creator — non-fatal
	if s.coins != nil {
		_ = s.coins.Award(link.CreatedBy, 20, CoinReasonHouseholdInvite, map[string]interface{}{
			"member_name": member.Name,
		})
		_ = s.coins.Award(link.CreatedBy, 10, CoinReasonReferral, map[string]interface{}{
			"referred_name": member.Name,
		})
	}

	return updated, nil
}

// GetHouseholdForMember returns the household for the given member, if any.
func (s *HouseholdService) GetHouseholdForMember(memberID uuid.UUID) (*domain.Household, error) {
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return nil, err
	}
	if m.HouseholdID == nil {
		return nil, nil
	}
	return s.households.FindByID(*m.HouseholdID)
}
