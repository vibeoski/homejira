package domain

import (
	"time"

	"github.com/google/uuid"
)

type EmailVerification struct {
	ID        uuid.UUID
	MemberID  uuid.UUID
	Token     string
	ExpiresAt time.Time
	Used      bool
	CreatedAt time.Time
}

type VerificationRepository interface {
	CreateEmailToken(memberID uuid.UUID, token string, expiresAt time.Time) (*EmailVerification, error)
	FindEmailToken(token string) (*EmailVerification, error)
	MarkEmailTokenUsed(id uuid.UUID) error
}

// Mailer is the interface for sending emails — allows swapping in Resend later.
type Mailer interface {
	SendEmailVerification(toEmail, toName, verifyURL string) error
}
