package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/homejira/api/internal/domain"
)

// AuthService handles username+mPIN authentication and JWT issuance.
type AuthService struct {
	members   domain.MemberRepository
	coins     *CoinService
	jwtSecret []byte
	jwtTTL    time.Duration
	flags     *FeatureFlagService // may be nil (skips flag checks)
}

func NewAuthService(members domain.MemberRepository, coins *CoinService, jwtSecret string, flags *FeatureFlagService) *AuthService {
	return &AuthService{
		members:   members,
		coins:     coins,
		jwtSecret: []byte(jwtSecret),
		jwtTTL:    7 * 24 * time.Hour,
	}
}

// CheckUsername returns the member if the username is registered, ErrNotFound otherwise.
func (s *AuthService) CheckUsername(username string) (*domain.Member, error) {
	return s.members.FindByUsername(username)
}

// Login verifies the mPIN and returns a JWT + member on success.
func (s *AuthService) Login(username, mpin string) (string, *domain.Member, error) {
	m, err := s.members.FindByUsername(username)
	if err != nil {
		return "", nil, domain.ErrUnauthorized
	}
	if err := bcrypt.CompareHashAndPassword([]byte(m.MpinHash), []byte(mpin)); err != nil {
		return "", nil, domain.ErrWrongMpin
	}
	token, err := s.issueToken(m)
	if err != nil {
		return "", nil, err
	}
	return token, m, nil
}

// Register creates a new member with username+mPIN credentials and returns a JWT.
func (s *AuthService) Register(input domain.RegisterInput) (string, *domain.Member, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Mpin), bcrypt.DefaultCost)
	if err != nil {
		return "", nil, fmt.Errorf("hash mPIN: %w", err)
	}

	// Auto-assign color based on current member count
	all, err := s.members.FindAll()
	if err != nil {
		return "", nil, err
	}
	color := domain.MemberColorPalette[len(all)%len(domain.MemberColorPalette)]

	m, err := s.members.CreateWithAuth(input.Name, input.Avatar, color, input.Username, string(hash))
	if err != nil {
		return "", nil, err
	}

	// Award referral coins — non-fatal if token is invalid
	if s.coins != nil {
		s.coins.ProcessReferral(input.ReferralToken, m.ID)
	}

	token, err := s.issueToken(m)
	if err != nil {
		return "", nil, err
	}
	return token, m, nil
}

// ValidateToken parses and verifies a JWT, returning the embedded claims.
func (s *AuthService) ValidateToken(tokenStr string) (*domain.Claims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, domain.ErrUnauthorized
	}

	mapClaims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, domain.ErrUnauthorized
	}

	claimStr := func(key string) (string, bool) {
		v, ok := mapClaims[key].(string)
		return v, ok
	}
	memberID, ok1 := claimStr("member_id")
	username, ok2 := claimStr("username")
	name, ok3 := claimStr("name")
	avatar, ok4 := claimStr("avatar")
	color, ok5 := claimStr("color")
	if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 {
		return nil, domain.ErrUnauthorized
	}
	claims := &domain.Claims{
		MemberID: memberID,
		Username: username,
		Name:     name,
		Avatar:   avatar,
		Color:    color,
	}
	if hh, ok := mapClaims["household_id"].(string); ok {
		claims.HouseholdID = hh
	}

	// Make sure the user actually exists in the DB (prevents 404s from deleted test users)
	memberUUID, err := uuid.Parse(claims.MemberID)
	if err != nil {
		return nil, domain.ErrUnauthorized
	}
	if _, err := s.members.FindByID(memberUUID); err != nil {
		return nil, domain.ErrUnauthorized
	}

	return claims, nil
}

// Refresh fetches the current member state from the DB and issues a fresh JWT.
// Used after household approval so the new token contains the updated household_id.
func (s *AuthService) Refresh(memberID uuid.UUID) (string, *domain.Member, error) {
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return "", nil, err
	}
	token, err := s.issueToken(m)
	if err != nil {
		return "", nil, err
	}
	return token, m, nil
}

// ChangeMpin verifies the current mPIN, then replaces it with the new one.
func (s *AuthService) ChangeMpin(memberID uuid.UUID, currentMpin, newMpin string) error {
	if len(newMpin) != 4 {
		return fmt.Errorf("%w: new mPIN must be 4 digits", domain.ErrInvalidInput)
	}
	m, err := s.members.FindByID(memberID)
	if err != nil {
		return err
	}
	// Fetch full member (with mpin_hash) via username
	full, err := s.members.FindByUsername(m.Username)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(full.MpinHash), []byte(currentMpin)); err != nil {
		return domain.ErrWrongMpin
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newMpin), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash mPIN: %w", err)
	}
	return s.members.UpdateMpin(memberID, string(hash))
}

func (s *AuthService) issueToken(m *domain.Member) (string, error) {
	claims := jwt.MapClaims{
		"member_id": m.ID.String(),
		"username":  m.Username,
		"name":      m.Name,
		"avatar":    m.Avatar,
		"color":     m.Color,
		"exp":       time.Now().Add(s.jwtTTL).Unix(),
		"iat":       time.Now().Unix(),
	}
	if m.HouseholdID != nil {
		claims["household_id"] = m.HouseholdID.String()
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
