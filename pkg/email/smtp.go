package email

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/konveyor/release-tools/pkg/config"
	"github.com/sirupsen/logrus"
	"github.com/wneessen/go-mail"
)

// EmailSender handles SMTP email sending with retry logic
type EmailSender struct {
	config   config.SMTPConfig
	username string
	password string
}

// NewEmailSender creates a new SMTP email sender
func NewEmailSender(smtpConfig config.SMTPConfig) (*EmailSender, error) {
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")

	if username == "" || password == "" {
		return nil, fmt.Errorf("SMTP_USERNAME and SMTP_PASSWORD environment variables must be set")
	}

	return &EmailSender{
		config:   smtpConfig,
		username: username,
		password: password,
	}, nil
}

// SendEmail sends an email with HTML and plain text parts
func (s *EmailSender) SendEmail(to, subject, htmlBody, textBody string, cc []string) error {
	m := mail.NewMsg()

	// Set From
	if err := m.From(fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail)); err != nil {
		return fmt.Errorf("failed to set From address: %w", err)
	}

	// Set To
	if err := m.To(to); err != nil {
		return fmt.Errorf("failed to set To address: %w", err)
	}

	// Set CC if provided
	if len(cc) > 0 {
		if err := m.Cc(cc...); err != nil {
			logrus.WithError(err).Warn("Failed to set CC addresses")
		}
	}

	// Set Subject
	m.Subject(subject)

	// Set body
	m.SetBodyString(mail.TypeTextPlain, textBody)
	m.AddAlternativeString(mail.TypeTextHTML, htmlBody)

	// Create client
	client, err := mail.NewClient(s.config.Server,
		mail.WithPort(s.config.Port),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(s.username),
		mail.WithPassword(s.password),
		mail.WithTLSPolicy(mail.TLSMandatory),
	)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}

	// Retry logic: 3 attempts with exponential backoff
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if err := client.DialAndSend(m); err != nil {
			lastErr = err
			logrus.WithError(err).WithFields(logrus.Fields{
				"attempt": attempt,
				"to":      to,
			}).Warn("Failed to send email, retrying...")

			if attempt < 3 {
				// Exponential backoff: 2s, 4s
				backoff := time.Duration(attempt*2) * time.Second
				time.Sleep(backoff)
				continue
			}
		} else {
			logrus.WithFields(logrus.Fields{
				"to":      to,
				"subject": subject,
				"attempt": attempt,
			}).Info("Email sent successfully")
			return nil
		}
	}

	return fmt.Errorf("failed to send email after 3 attempts: %w", lastErr)
}

// TestConnection tests the SMTP connection without sending an email
func (s *EmailSender) TestConnection() error {
	client, err := mail.NewClient(s.config.Server,
		mail.WithPort(s.config.Port),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(s.username),
		mail.WithPassword(s.password),
		mail.WithTLSPolicy(mail.TLSMandatory),
	)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.DialWithContext(ctx); err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}

	client.Close()
	logrus.Info("SMTP connection test successful")
	return nil
}
