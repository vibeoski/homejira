package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/homejira/api/internal/domain"
)

func newHouseholdSvc(
	households *mockHouseholdRepo,
	members *mockMemberRepo,
	joins *mockJoinRepo,
	invites *mockInviteRepo,
	inviteLinks *mockInviteLinkRepo,
	tasks *mockTaskRepo,
) *HouseholdService {
	return NewHouseholdService(households, members, joins, invites, inviteLinks, tasks, nil)
}

// seedAdmin returns a member repo with an admin who belongs to a household.
func seedAdmin(t *testing.T) (*mockMemberRepo, *mockHouseholdRepo, *domain.Member, *domain.Household) {
	t.Helper()
	memberRepo := newMockMemberRepo()
	householdRepo := newMockHouseholdRepo()

	adminID := uuid.New()
	householdID := uuid.New()

	h, err := householdRepo.Create("Test House", domain.HouseholdKindHome, adminID, "TESTCODE")
	if err != nil {
		t.Fatalf("create household: %v", err)
	}
	// Override the auto-generated ID so adminID → householdID is consistent.
	h.ID = householdID
	householdRepo.households[householdID] = h
	householdRepo.byCodes["TESTCODE"] = h

	admin := &domain.Member{ID: adminID, Name: "Admin", HouseholdID: &householdID, Role: domain.MemberRoleAdmin}
	memberRepo.seed(admin)

	return memberRepo, householdRepo, admin, h
}

// ── CreateHousehold ───────────────────────────────────────────────────────────

func TestHouseholdService_CreateHousehold_Success(t *testing.T) {
	memberRepo := newMockMemberRepo()
	creator := &domain.Member{ID: uuid.New(), Name: "Alice"}
	memberRepo.seed(creator)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	h, m, err := svc.CreateHousehold(creator.ID, "My Home", domain.HouseholdKindHome)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h.Name != "My Home" {
		t.Errorf("got name %q, want %q", h.Name, "My Home")
	}
	if m.Role != domain.MemberRoleAdmin {
		t.Errorf("got role %q, want admin", m.Role)
	}
	if m.HouseholdID == nil || *m.HouseholdID != h.ID {
		t.Error("creator should be linked to the new household")
	}
}

func TestHouseholdService_CreateHousehold_EmptyName(t *testing.T) {
	memberRepo := newMockMemberRepo()
	creator := &domain.Member{ID: uuid.New(), Name: "Bob"}
	memberRepo.seed(creator)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, _, err := svc.CreateHousehold(creator.ID, "", domain.HouseholdKindHome)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestHouseholdService_CreateHousehold_InvalidKind(t *testing.T) {
	memberRepo := newMockMemberRepo()
	creator := &domain.Member{ID: uuid.New(), Name: "Carol"}
	memberRepo.seed(creator)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, _, err := svc.CreateHousehold(creator.ID, "My Home", "invalid")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── RequestJoinByCode ─────────────────────────────────────────────────────────

func TestHouseholdService_RequestJoinByCode_Success(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	requester := &domain.Member{ID: uuid.New(), Name: "Dave"}
	memberRepo.seed(requester)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	req, gotH, err := svc.RequestJoinByCode(requester.ID, h.JoinCode)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.RequesterID != requester.ID {
		t.Errorf("got requester %v, want %v", req.RequesterID, requester.ID)
	}
	if gotH.ID != h.ID {
		t.Errorf("got household %v, want %v", gotH.ID, h.ID)
	}
}

func TestHouseholdService_RequestJoinByCode_EmptyCode(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Eve"}
	memberRepo.seed(m)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, _, err := svc.RequestJoinByCode(m.ID, "")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestHouseholdService_RequestJoinByCode_AlreadyInHousehold(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	// Admin tries to join their own household via code.
	_, _, err := svc.RequestJoinByCode(admin.ID, h.JoinCode)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── ListPendingRequestsForAdmin ───────────────────────────────────────────────

func TestHouseholdService_ListPendingRequestsForAdmin_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	joinRepo := newMockJoinRepo()
	joinRepo.Create(h.ID, uuid.New()) //nolint:errcheck
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	requests, err := svc.ListPendingRequestsForAdmin(admin.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(requests) != 1 {
		t.Errorf("got %d requests, want 1", len(requests))
	}
}

func TestHouseholdService_ListPendingRequestsForAdmin_NonAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	regularMember := &domain.Member{ID: uuid.New(), Name: "Frank", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regularMember)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.ListPendingRequestsForAdmin(regularMember.ID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── ApproveJoinRequest ────────────────────────────────────────────────────────

func TestHouseholdService_ApproveJoinRequest_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	requester := &domain.Member{ID: uuid.New(), Name: "Grace"}
	memberRepo.seed(requester)
	joinRepo := newMockJoinRepo()
	req, _ := joinRepo.Create(h.ID, requester.ID)
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	updatedReq, updatedMember, err := svc.ApproveJoinRequest(admin.ID, req.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedReq.Status != domain.JoinRequestApproved {
		t.Errorf("got status %q, want approved", updatedReq.Status)
	}
	if updatedMember.HouseholdID == nil || *updatedMember.HouseholdID != h.ID {
		t.Error("requester should now belong to the household")
	}
}

func TestHouseholdService_ApproveJoinRequest_NonAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Hank", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	joinRepo := newMockJoinRepo()
	req, _ := joinRepo.Create(h.ID, uuid.New())
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, _, err := svc.ApproveJoinRequest(regular.ID, req.ID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── RejectJoinRequest ─────────────────────────────────────────────────────────

func TestHouseholdService_RejectJoinRequest_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	joinRepo := newMockJoinRepo()
	req, _ := joinRepo.Create(h.ID, uuid.New())
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	rejected, err := svc.RejectJoinRequest(admin.ID, req.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rejected.Status != domain.JoinRequestRejected {
		t.Errorf("got status %q, want rejected", rejected.Status)
	}
}

// ── RemoveMember ──────────────────────────────────────────────────────────────

func TestHouseholdService_RemoveMember_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	target := &domain.Member{ID: uuid.New(), Name: "Ivy", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(target)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	removed, err := svc.RemoveMember(admin.ID, target.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if removed.HouseholdID != nil {
		t.Error("removed member should have nil household_id")
	}
}

func TestHouseholdService_RemoveMember_SelfRemoval(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.RemoveMember(admin.ID, admin.ID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput for self-removal, got %v", err)
	}
}

func TestHouseholdService_RemoveMember_NonAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Jake", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	target := &domain.Member{ID: uuid.New(), Name: "Kate", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	memberRepo.seed(target)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.RemoveMember(regular.ID, target.ID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── LeaveHousehold ────────────────────────────────────────────────────────────

func TestHouseholdService_LeaveHousehold_MemberSuccess(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Leo", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	left, err := svc.LeaveHousehold(regular.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if left.HouseholdID != nil {
		t.Error("left member should have nil household_id")
	}
	_ = admin
}

func TestHouseholdService_LeaveHousehold_SoleAdmin(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.LeaveHousehold(admin.ID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput for sole admin leaving, got %v", err)
	}
}

func TestHouseholdService_LeaveHousehold_NotInHousehold(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Mary"}
	memberRepo.seed(m)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.LeaveHousehold(m.ID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── CancelJoinRequest ─────────────────────────────────────────────────────────

func TestHouseholdService_CancelJoinRequest_Success(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	requester := &domain.Member{ID: uuid.New(), Name: "Nick"}
	memberRepo.seed(requester)
	joinRepo := newMockJoinRepo()
	req, _ := joinRepo.Create(h.ID, requester.ID)
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	if err := svc.CancelJoinRequest(requester.ID, req.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestHouseholdService_CancelJoinRequest_WrongOwner(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	joinRepo := newMockJoinRepo()
	req, _ := joinRepo.Create(h.ID, uuid.New())
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	// A different member tries to cancel.
	other := &domain.Member{ID: uuid.New(), Name: "Olivia"}
	memberRepo.seed(other)

	err := svc.CancelJoinRequest(other.ID, req.ID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── PromoteMember ─────────────────────────────────────────────────────────────

func TestHouseholdService_PromoteMember_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Paul", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	promoted, err := svc.PromoteMember(admin.ID, regular.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if promoted.Role != domain.MemberRoleAdmin {
		t.Errorf("got role %q, want admin", promoted.Role)
	}
}

func TestHouseholdService_PromoteMember_AlreadyAdmin(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	otherAdmin := &domain.Member{ID: uuid.New(), Name: "Quinn", HouseholdID: &h.ID, Role: domain.MemberRoleAdmin}
	memberRepo.seed(otherAdmin)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.PromoteMember(admin.ID, otherAdmin.ID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── CreateInviteLink ──────────────────────────────────────────────────────────

func TestHouseholdService_CreateInviteLink_Success(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	token, h, err := svc.CreateInviteLink(admin.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if h == nil {
		t.Error("expected non-nil household")
	}
}

func TestHouseholdService_CreateInviteLink_NonAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Rosa", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, _, err := svc.CreateInviteLink(regular.ID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── JoinByInviteToken ─────────────────────────────────────────────────────────

func TestHouseholdService_JoinByInviteToken_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	inviteLinkRepo := newMockInviteLinkRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), inviteLinkRepo, newMockTaskRepo())

	// Admin creates an invite link, then a new member uses it.
	token, _, err := svc.CreateInviteLink(admin.ID)
	if err != nil {
		t.Fatalf("create invite link: %v", err)
	}

	newMember := &domain.Member{ID: uuid.New(), Name: "Sam"}
	memberRepo.seed(newMember)

	joined, err := svc.JoinByInviteToken(newMember.ID, token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if joined.HouseholdID == nil || *joined.HouseholdID != h.ID {
		t.Error("new member should now belong to the household")
	}
}

func TestHouseholdService_JoinByInviteToken_AlreadyInHousehold(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	inviteLinkRepo := newMockInviteLinkRepo()
	other := uuid.New()
	otherH := &domain.Household{ID: other}
	_ = otherH

	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), inviteLinkRepo, newMockTaskRepo())

	token, _, _ := svc.CreateInviteLink(admin.ID)

	// Create a member already in a different household.
	differentHID := uuid.New()
	occupied := &domain.Member{ID: uuid.New(), Name: "Ted", HouseholdID: &differentHID, Role: domain.MemberRoleMember}
	memberRepo.seed(occupied)

	_, err := svc.JoinByInviteToken(occupied.ID, token)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
	_ = h
}

// ── GetHouseholdByInviteToken ─────────────────────────────────────────────────

func TestHouseholdService_GetHouseholdByInviteToken_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	inviteLinkRepo := newMockInviteLinkRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), inviteLinkRepo, newMockTaskRepo())

	token, _, _ := svc.CreateInviteLink(admin.ID)

	got, err := svc.GetHouseholdByInviteToken(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != h.ID {
		t.Errorf("got household %v, want %v", got.ID, h.ID)
	}
}

func TestHouseholdService_GetHouseholdByInviteToken_Invalid(t *testing.T) {
	svc := newHouseholdSvc(newMockHouseholdRepo(), newMockMemberRepo(), newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.GetHouseholdByInviteToken("bad-token")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// ── GetHouseholdForMember ─────────────────────────────────────────────────────

func TestHouseholdService_GetHouseholdForMember_InHousehold(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	got, err := svc.GetHouseholdForMember(admin.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || got.ID != h.ID {
		t.Errorf("got household %v, want %v", got, h.ID)
	}
}

func TestHouseholdService_GetHouseholdForMember_NoHousehold(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Zara"}
	memberRepo.seed(m)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	got, err := svc.GetHouseholdForMember(m.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil household, got %v", got)
	}
}

// ── GetMyPendingRequest ───────────────────────────────────────────────────────

func TestHouseholdService_GetMyPendingRequest_Exists(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	requester := &domain.Member{ID: uuid.New(), Name: "Uma"}
	memberRepo.seed(requester)
	joinRepo := newMockJoinRepo()
	joinRepo.Create(h.ID, requester.ID) //nolint:errcheck
	svc := newHouseholdSvc(householdRepo, memberRepo, joinRepo, newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	req, err := svc.GetMyPendingRequest(requester.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req == nil {
		t.Fatal("expected pending request, got nil")
	}
	if req.RequesterID != requester.ID {
		t.Errorf("got requester %v, want %v", req.RequesterID, requester.ID)
	}
}

func TestHouseholdService_GetMyPendingRequest_None(t *testing.T) {
	memberRepo := newMockMemberRepo()
	m := &domain.Member{ID: uuid.New(), Name: "Victor"}
	memberRepo.seed(m)
	svc := newHouseholdSvc(newMockHouseholdRepo(), memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	req, err := svc.GetMyPendingRequest(m.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req != nil {
		t.Errorf("expected nil, got %v", req)
	}
}

// ── CreateInviteByPhone ───────────────────────────────────────────────────────

func TestHouseholdService_CreateInviteByPhone_Success(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	inv, err := svc.CreateInviteByPhone(admin.ID, "+5551234567", "Wendy")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inv.InvitedPhone != "+5551234567" {
		t.Errorf("got phone %q, want %q", inv.InvitedPhone, "+5551234567")
	}
}

func TestHouseholdService_CreateInviteByPhone_EmptyPhone(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.CreateInviteByPhone(admin.ID, "", "Xander")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

func TestHouseholdService_CreateInviteByPhone_NonAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	regular := &domain.Member{ID: uuid.New(), Name: "Yara", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(regular)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.CreateInviteByPhone(regular.ID, "+9990000001", "Zach")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("want ErrUnauthorized, got %v", err)
	}
}

// ── ListInvitesForPhone ───────────────────────────────────────────────────────

func TestHouseholdService_ListInvitesForPhone_Success(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	inviteRepo := newMockInviteRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), inviteRepo, newMockInviteLinkRepo(), newMockTaskRepo())

	svc.CreateInviteByPhone(admin.ID, "+1112223333", "Anna") //nolint:errcheck

	invites, err := svc.ListInvitesForPhone("+1112223333")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(invites) != 1 {
		t.Errorf("got %d invites, want 1", len(invites))
	}
}

func TestHouseholdService_ListInvitesForPhone_EmptyPhone(t *testing.T) {
	svc := newHouseholdSvc(newMockHouseholdRepo(), newMockMemberRepo(), newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	_, err := svc.ListInvitesForPhone("")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// ── AcceptInvite ──────────────────────────────────────────────────────────────

func TestHouseholdService_AcceptInvite_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	inviteRepo := newMockInviteRepo()
	invitee := &domain.Member{ID: uuid.New(), Name: "Beth", Phone: "+4445556666"}
	memberRepo.seed(invitee)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), inviteRepo, newMockInviteLinkRepo(), newMockTaskRepo())

	inv, _ := svc.CreateInviteByPhone(admin.ID, "+4445556666", "Beth")

	updatedInv, updatedMember, err := svc.AcceptInvite(invitee.ID, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedInv.Status != domain.InviteAccepted {
		t.Errorf("got status %q, want accepted", updatedInv.Status)
	}
	if updatedMember.HouseholdID == nil || *updatedMember.HouseholdID != h.ID {
		t.Error("invitee should now belong to the household")
	}
}

// ── RejectInvite ──────────────────────────────────────────────────────────────

func TestHouseholdService_RejectInvite_Success(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	invitee := &domain.Member{ID: uuid.New(), Name: "Carl", Phone: "+7778889999"}
	memberRepo.seed(invitee)
	inviteRepo := newMockInviteRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), inviteRepo, newMockInviteLinkRepo(), newMockTaskRepo())

	inv, _ := svc.CreateInviteByPhone(admin.ID, "+7778889999", "Carl")

	rejected, err := svc.RejectInvite(invitee.ID, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rejected.Status != domain.InviteRejected {
		t.Errorf("got status %q, want rejected", rejected.Status)
	}
}

// ── JoinByInviteToken_Idempotent ──────────────────────────────────────────────

// ── DeleteHousehold ───────────────────────────────────────────────────────────

func TestHouseholdService_DeleteHousehold_Success(t *testing.T) {
	memberRepo, householdRepo, admin, h := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	err := svc.DeleteHousehold(admin.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := householdRepo.households[h.ID]; ok {
		t.Error("household should have been deleted")
	}
}

func TestHouseholdService_DeleteHousehold_NotAdmin(t *testing.T) {
	memberRepo, householdRepo, _, h := seedAdmin(t)
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	memberID := uuid.New()
	member := &domain.Member{ID: memberID, Name: "Regular", HouseholdID: &h.ID, Role: domain.MemberRoleMember}
	memberRepo.seed(member)

	err := svc.DeleteHousehold(memberID)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}
}

func TestHouseholdService_DeleteHousehold_NoHousehold(t *testing.T) {
	memberRepo := newMockMemberRepo()
	householdRepo := newMockHouseholdRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), newMockInviteLinkRepo(), newMockTaskRepo())

	memberID := uuid.New()
	member := &domain.Member{ID: memberID, Name: "Lone", HouseholdID: nil, Role: domain.MemberRoleAdmin}
	memberRepo.seed(member)

	err := svc.DeleteHousehold(memberID)
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput, got %v", err)
	}
}

func TestHouseholdService_JoinByInviteToken_AlreadyInSameHousehold(t *testing.T) {
	memberRepo, householdRepo, admin, _ := seedAdmin(t)
	inviteLinkRepo := newMockInviteLinkRepo()
	svc := newHouseholdSvc(householdRepo, memberRepo, newMockJoinRepo(), newMockInviteRepo(), inviteLinkRepo, newMockTaskRepo())

	token, _, _ := svc.CreateInviteLink(admin.ID)

	// Joining the same household you already belong to is idempotent — returns member, nil.
	member, err := svc.JoinByInviteToken(admin.ID, token)
	if err != nil {
		t.Fatalf("expected nil error for same-household join (idempotent), got: %v", err)
	}
	if member == nil {
		t.Fatal("expected member returned for same-household join (idempotent), got nil")
	}
}
