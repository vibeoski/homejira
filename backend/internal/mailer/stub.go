package mailer

import (
	"fmt"
	"log"
)

// StubMailer logs emails to stdout instead of sending them.
// Replace with ResendMailer once an API key is configured.
type StubMailer struct{}

func NewStubMailer() *StubMailer { return &StubMailer{} }

func (m *StubMailer) SendEmailVerification(toEmail, toName, verifyURL string) error {
	log.Printf("[MAILER] To: %s <%s> | Verify URL: %s", toName, toEmail, verifyURL)
	fmt.Printf("\n📧 Email verification link for %s:\n%s\n\n", toEmail, verifyURL)
	return nil
}
