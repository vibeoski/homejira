package firebase

import (
	"context"
	"fmt"

	firebasesdk "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

// Client wraps the Firebase Auth client.
type Client struct {
	auth *auth.Client
}

// New initialises a Firebase app from either:
//   - credentialsJSON: raw JSON string (used in production via env var)
//   - credentialsFile: path to a service-account JSON file (used in dev)
//
// credentialsJSON takes precedence when non-empty.
func New(credentialsJSON, credentialsFile string) (*Client, error) {
	var opt option.ClientOption
	if credentialsJSON != "" {
		opt = option.WithCredentialsJSON([]byte(credentialsJSON))
	} else {
		opt = option.WithCredentialsFile(credentialsFile)
	}
	app, err := firebasesdk.NewApp(context.Background(), nil, opt)
	if err != nil {
		return nil, fmt.Errorf("firebase: init app: %w", err)
	}
	authClient, err := app.Auth(context.Background())
	if err != nil {
		return nil, fmt.Errorf("firebase: init auth client: %w", err)
	}
	return &Client{auth: authClient}, nil
}

// VerifyIDToken verifies a Firebase ID token and returns the phone number
// embedded in the token's phone_number claim.
func (c *Client) VerifyIDToken(ctx context.Context, idToken string) (string, error) {
	token, err := c.auth.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", fmt.Errorf("firebase: verify id token: %w", err)
	}
	phone, ok := token.Claims["phone_number"].(string)
	if !ok || phone == "" {
		return "", fmt.Errorf("firebase: token has no phone_number claim")
	}
	return phone, nil
}
