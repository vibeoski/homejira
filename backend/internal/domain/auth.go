package domain

import "errors"

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrWrongMpin    = errors.New("wrong mPIN")
)

// MemberColorPalette is the auto-assignment pool for new member colors.
var MemberColorPalette = []string{
	"#f97316", // orange (brand)
	"#0ea5e9", // sky
	"#22c55e", // green
	"#ef4444", // red
	"#a855f7", // purple
	"#eab308", // yellow
	"#ec4899", // pink
	"#14b8a6", // teal
}

// RegisterInput is the payload for new member creation via the auth flow.
type RegisterInput struct {
	Phone         string
	Name          string
	Avatar        string
	Mpin          string // raw 4-digit PIN; hashed inside AuthService
	ReferralToken string // optional — if set, the referrer earns 10 coins
	FirebaseToken string // optional Firebase ID token; when present, phone ownership is verified against it
}

// Claims holds the data embedded in a JWT token.
type Claims struct {
	MemberID    string
	Phone       string
	Name        string
	Avatar      string
	Color       string
	HouseholdID string
}
