package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/homejira/api/internal/domain"
)

type MemberService struct {
	members domain.MemberRepository
}

func NewMemberService(members domain.MemberRepository) *MemberService {
	return &MemberService{members: members}
}

func (s *MemberService) ListMembers() ([]domain.Member, error) {
	return s.members.FindAll()
}

func (s *MemberService) ListByHousehold(householdID uuid.UUID) ([]domain.Member, error) {
	return s.members.FindByHousehold(householdID)
}

func (s *MemberService) GetMember(id uuid.UUID) (*domain.Member, error) {
	return s.members.FindByID(id)
}

func (s *MemberService) CreateMember(name, avatar, color string) (*domain.Member, error) {
	return s.members.Create(name, avatar, color)
}

func (s *MemberService) UpdateProfile(memberID uuid.UUID, name, avatar, color string) (*domain.Member, error) {
	if name == "" {
		return nil, fmt.Errorf("%w: name required", domain.ErrInvalidInput)
	}
	if len(name) > 200 {
		return nil, fmt.Errorf("%w: name must be 200 characters or fewer", domain.ErrInvalidInput)
	}
	return s.members.UpdateProfile(memberID, name, avatar, color)
}
