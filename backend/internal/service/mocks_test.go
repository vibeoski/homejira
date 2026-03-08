package service

import (
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/homejira/api/internal/domain"
)

// ── Stub mailer ───────────────────────────────────────────────────────────────

type stubMailer struct{}

func (s *stubMailer) SendEmailVerification(_, _, _ string) error { return nil }

// ── Stub verification repo ────────────────────────────────────────────────────

type stubVerificationRepo struct{}

func (r *stubVerificationRepo) CreateEmailToken(memberID uuid.UUID, token string, expiresAt time.Time) (*domain.EmailVerification, error) {
	return &domain.EmailVerification{
		ID: uuid.New(), MemberID: memberID, Token: token, ExpiresAt: expiresAt,
		Used: false, CreatedAt: time.Now(),
	}, nil
}

func (r *stubVerificationRepo) FindEmailToken(token string) (*domain.EmailVerification, error) {
	return nil, domain.ErrNotFound
}

func (r *stubVerificationRepo) MarkEmailTokenUsed(id uuid.UUID) error { return nil }

// ── Member mock ───────────────────────────────────────────────────────────────

type mockMemberRepo struct {
	members map[uuid.UUID]*domain.Member
	byPhone map[string]*domain.Member
}

func newMockMemberRepo() *mockMemberRepo {
	return &mockMemberRepo{
		members: make(map[uuid.UUID]*domain.Member),
		byPhone: make(map[string]*domain.Member),
	}
}

func (m *mockMemberRepo) seed(member *domain.Member) {
	m.members[member.ID] = member
	if member.Phone != "" {
		m.byPhone[member.Phone] = member
	}
}

func (m *mockMemberRepo) FindAll() ([]domain.Member, error) {
	out := make([]domain.Member, 0, len(m.members))
	for _, v := range m.members {
		out = append(out, *v)
	}
	return out, nil
}

func (m *mockMemberRepo) FindByHousehold(householdID uuid.UUID) ([]domain.Member, error) {
	var out []domain.Member
	for _, v := range m.members {
		if v.HouseholdID != nil && *v.HouseholdID == householdID {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (m *mockMemberRepo) FindByID(id uuid.UUID) (*domain.Member, error) {
	if v, ok := m.members[id]; ok {
		cp := *v
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockMemberRepo) Create(name, avatar, color string) (*domain.Member, error) {
	mem := &domain.Member{ID: uuid.New(), Name: name, Avatar: avatar, Color: color, CreatedAt: time.Now()}
	m.members[mem.ID] = mem
	return mem, nil
}

func (m *mockMemberRepo) FindByPhone(phone string) (*domain.Member, error) {
	if v, ok := m.byPhone[phone]; ok {
		cp := *v
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockMemberRepo) CreateWithAuth(name, avatar, color, phone, mpinHash string) (*domain.Member, error) {
	mem := &domain.Member{
		ID: uuid.New(), Name: name, Avatar: avatar, Color: color,
		Phone: phone, MpinHash: mpinHash, CreatedAt: time.Now(),
	}
	m.members[mem.ID] = mem
	m.byPhone[phone] = mem
	return mem, nil
}

func (m *mockMemberRepo) UpdateHouseholdAndRole(id uuid.UUID, householdID *uuid.UUID, role domain.MemberRole) (*domain.Member, error) {
	mem, err := m.FindByID(id)
	if err != nil {
		return nil, err
	}
	mem.HouseholdID = householdID
	mem.Role = role
	m.members[id] = mem
	if mem.Phone != "" {
		m.byPhone[mem.Phone] = mem
	}
	return mem, nil
}

func (m *mockMemberRepo) ClearHousehold(id uuid.UUID) (*domain.Member, error) {
	return m.UpdateHouseholdAndRole(id, nil, "")
}

func (m *mockMemberRepo) UpdateProfile(id uuid.UUID, name, avatar, color string) (*domain.Member, error) {
	mem, err := m.FindByID(id)
	if err != nil {
		return nil, err
	}
	mem.Name = name
	mem.Avatar = avatar
	mem.Color = color
	m.members[id] = mem
	return mem, nil
}

func (m *mockMemberRepo) UpdateMpin(id uuid.UUID, mpinHash string) error {
	mem, err := m.FindByID(id)
	if err != nil {
		return err
	}
	mem.MpinHash = mpinHash
	m.members[id] = mem
	if mem.Phone != "" {
		m.byPhone[mem.Phone] = mem
	}
	return nil
}

func (m *mockMemberRepo) UpdateEmail(id uuid.UUID, email string) (*domain.Member, error) {
	mem, err := m.FindByID(id)
	if err != nil {
		return nil, err
	}
	mem.Email = email
	m.members[id] = mem
	return mem, nil
}

func (m *mockMemberRepo) SetPhoneVerified(id uuid.UUID) error {
	mem, err := m.FindByID(id)
	if err != nil {
		return err
	}
	mem.PhoneVerified = true
	m.members[id] = mem
	return nil
}

func (m *mockMemberRepo) SetEmailVerified(id uuid.UUID) error {
	mem, err := m.FindByID(id)
	if err != nil {
		return err
	}
	mem.EmailVerified = true
	m.members[id] = mem
	return nil
}

// ── Household mock ────────────────────────────────────────────────────────────

type mockHouseholdRepo struct {
	households map[uuid.UUID]*domain.Household
	byCodes    map[string]*domain.Household
}

func newMockHouseholdRepo() *mockHouseholdRepo {
	return &mockHouseholdRepo{
		households: make(map[uuid.UUID]*domain.Household),
		byCodes:    make(map[string]*domain.Household),
	}
}

func (r *mockHouseholdRepo) Create(name string, kind domain.HouseholdKind, createdBy uuid.UUID, joinCode string) (*domain.Household, error) {
	h := &domain.Household{ID: uuid.New(), Name: name, Kind: kind, CreatedBy: createdBy, JoinCode: joinCode, CreatedAt: time.Now()}
	r.households[h.ID] = h
	r.byCodes[joinCode] = h
	return h, nil
}

func (r *mockHouseholdRepo) FindByID(id uuid.UUID) (*domain.Household, error) {
	if h, ok := r.households[id]; ok {
		cp := *h
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (r *mockHouseholdRepo) FindByJoinCode(code string) (*domain.Household, error) {
	if h, ok := r.byCodes[code]; ok {
		cp := *h
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (r *mockHouseholdRepo) Delete(id uuid.UUID) error {
	delete(r.households, id)
	return nil
}

// ── Join request mock ─────────────────────────────────────────────────────────

type mockJoinRepo struct {
	requests map[uuid.UUID]*domain.HouseholdJoinRequest
}

func newMockJoinRepo() *mockJoinRepo {
	return &mockJoinRepo{requests: make(map[uuid.UUID]*domain.HouseholdJoinRequest)}
}

func (r *mockJoinRepo) Create(householdID, requesterID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	req := &domain.HouseholdJoinRequest{
		ID: uuid.New(), HouseholdID: householdID, RequesterID: requesterID,
		Status: domain.JoinRequestPending, CreatedAt: time.Now(),
	}
	r.requests[req.ID] = req
	return req, nil
}

func (r *mockJoinRepo) FindPendingByHousehold(householdID uuid.UUID) ([]domain.HouseholdJoinRequest, error) {
	var out []domain.HouseholdJoinRequest
	for _, v := range r.requests {
		if v.HouseholdID == householdID && v.Status == domain.JoinRequestPending {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (r *mockJoinRepo) FindPendingByRequester(requesterID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	for _, v := range r.requests {
		if v.RequesterID == requesterID && v.Status == domain.JoinRequestPending {
			cp := *v
			return &cp, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (r *mockJoinRepo) FindByID(id uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	if v, ok := r.requests[id]; ok {
		cp := *v
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (r *mockJoinRepo) UpdateStatus(id uuid.UUID, status domain.JoinRequestStatus, decidedBy uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	req, err := r.FindByID(id)
	if err != nil {
		return nil, err
	}
	req.Status = status
	req.DecidedBy = &decidedBy
	now := time.Now()
	req.DecidedAt = &now
	r.requests[id] = req
	return req, nil
}

func (r *mockJoinRepo) DeleteByID(id uuid.UUID) error {
	delete(r.requests, id)
	return nil
}

// ── Invite mock ───────────────────────────────────────────────────────────────

type mockInviteRepo struct {
	invites map[uuid.UUID]*domain.HouseholdInvite
}

func newMockInviteRepo() *mockInviteRepo {
	return &mockInviteRepo{invites: make(map[uuid.UUID]*domain.HouseholdInvite)}
}

func (r *mockInviteRepo) Create(householdID uuid.UUID, invitedPhone, invitedName string, createdBy uuid.UUID) (*domain.HouseholdInvite, error) {
	inv := &domain.HouseholdInvite{
		ID: uuid.New(), HouseholdID: householdID, InvitedPhone: invitedPhone,
		InvitedName: invitedName, Status: domain.InvitePending, CreatedBy: createdBy, CreatedAt: time.Now(),
	}
	r.invites[inv.ID] = inv
	return inv, nil
}

func (r *mockInviteRepo) FindPendingForPhone(phone string) ([]domain.HouseholdInvite, error) {
	var out []domain.HouseholdInvite
	for _, v := range r.invites {
		if v.InvitedPhone == phone && v.Status == domain.InvitePending {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (r *mockInviteRepo) FindByID(id uuid.UUID) (*domain.HouseholdInvite, error) {
	if v, ok := r.invites[id]; ok {
		cp := *v
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (r *mockInviteRepo) UpdateStatus(id uuid.UUID, status domain.InviteStatus) (*domain.HouseholdInvite, error) {
	inv, err := r.FindByID(id)
	if err != nil {
		return nil, err
	}
	inv.Status = status
	r.invites[id] = inv
	return inv, nil
}

// ── Invite link mock ──────────────────────────────────────────────────────────

type mockInviteLinkRepo struct {
	links map[string]*domain.HouseholdInviteLink
}

func newMockInviteLinkRepo() *mockInviteLinkRepo {
	return &mockInviteLinkRepo{links: make(map[string]*domain.HouseholdInviteLink)}
}

func (r *mockInviteLinkRepo) Create(householdID, createdBy uuid.UUID, token string, expiresAt time.Time) (*domain.HouseholdInviteLink, error) {
	l := &domain.HouseholdInviteLink{
		ID: uuid.New(), HouseholdID: householdID, CreatedBy: createdBy,
		Token: token, ExpiresAt: expiresAt, CreatedAt: time.Now(),
	}
	r.links[token] = l
	return l, nil
}

func (r *mockInviteLinkRepo) FindByToken(token string) (*domain.HouseholdInviteLink, error) {
	if l, ok := r.links[token]; ok {
		if l.ExpiresAt.After(time.Now()) {
			cp := *l
			return &cp, nil
		}
	}
	return nil, domain.ErrNotFound
}

// ── Task mock ─────────────────────────────────────────────────────────────────

type mockTaskRepo struct {
	tasks    map[uuid.UUID]*domain.Task
	comments map[uuid.UUID]*domain.Comment
}

func newMockTaskRepo() *mockTaskRepo {
	return &mockTaskRepo{
		tasks:    make(map[uuid.UUID]*domain.Task),
		comments: make(map[uuid.UUID]*domain.Comment),
	}
}

func (r *mockTaskRepo) FindAll(_ domain.TaskFilter) ([]domain.Task, error) {
	out := make([]domain.Task, 0, len(r.tasks))
	for _, v := range r.tasks {
		out = append(out, *v)
	}
	return out, nil
}

func (r *mockTaskRepo) FindByID(id uuid.UUID) (*domain.Task, error) {
	if v, ok := r.tasks[id]; ok {
		cp := *v
		return &cp, nil
	}
	return nil, domain.ErrNotFound
}

func (r *mockTaskRepo) Create(input domain.CreateTaskInput) (*domain.Task, error) {
	now := time.Now()
	t := &domain.Task{
		ID: uuid.New(), Title: input.Title, Notes: input.Notes,
		Category: input.Category, Priority: input.Priority,
		AssigneeID: input.AssigneeID, HouseholdID: input.HouseholdID,
		CreatedAt: now, UpdatedAt: now,
	}
	r.tasks[t.ID] = t
	return t, nil
}

func (r *mockTaskRepo) Update(id uuid.UUID, input domain.UpdateTaskInput) (*domain.Task, error) {
	t, err := r.FindByID(id)
	if err != nil {
		return nil, err
	}
	if input.Title != nil {
		t.Title = *input.Title
	}
	if input.Done != nil {
		t.Done = *input.Done
		if *input.Done {
			now := time.Now()
			t.DoneAt = &now
		}
	}
	if input.Category != nil {
		t.Category = *input.Category
	}
	if input.Priority != nil {
		t.Priority = *input.Priority
	}
	r.tasks[id] = t
	return t, nil
}

func (r *mockTaskRepo) Delete(id uuid.UUID) error {
	delete(r.tasks, id)
	return nil
}

func (r *mockTaskRepo) AddComment(taskID, authorID uuid.UUID, body string) (*domain.Comment, error) {
	c := &domain.Comment{ID: uuid.New(), TaskID: taskID, AuthorID: authorID, Body: body, CreatedAt: time.Now()}
	r.comments[c.ID] = c
	return c, nil
}

func (r *mockTaskRepo) ReassignTasks(_, _, _ uuid.UUID) error { return nil }

// ── Activity mock ─────────────────────────────────────────────────────────────

type mockActivityRepo struct {
	activities []domain.Activity
}

func (r *mockActivityRepo) Create(taskID uuid.UUID, actorID *uuid.UUID, kind domain.ActivityKind, meta map[string]string) (*domain.Activity, error) {
	a := domain.Activity{ID: uuid.New(), TaskID: taskID, ActorID: actorID, Kind: kind, Meta: meta, CreatedAt: time.Now()}
	r.activities = append(r.activities, a)
	return &a, nil
}

func (r *mockActivityRepo) FindByTask(taskID uuid.UUID) ([]domain.Activity, error) {
	var out []domain.Activity
	for _, a := range r.activities {
		if a.TaskID == taskID {
			out = append(out, a)
		}
	}
	return out, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func mustHashMpin(mpin string) string {
	h, err := bcrypt.GenerateFromPassword([]byte(mpin), bcrypt.MinCost)
	if err != nil {
		panic(err)
	}
	return string(h)
}

func ptr[T any](v T) *T { return &v }
