### Task 3: Email package — SMTP sender with console fallback

**Files:**
- Create: `server/internal/email/sender.go`
- Create: `server/internal/email/sender_test.go`

**Interfaces:**
- Produces:
  - `type Sender struct { Host string; Port int; Username, Password, From string }`
  - `func New(host string, port int, username, password, from string) *Sender`
  - `func (s *Sender) Enabled() bool` — true iff `Host != ""`.
  - `func (s *Sender) SendOtp(to, code string) error` — disabled: logs `slog.Info("verification otp", "email", to, "code", code)` and returns nil; enabled: `net/smtp.SendMail` with `smtp.PlainAuth` (only when Username set), plain-text + minimal HTML body "Your TermVault verification code is: <code>".

- [ ] **Step 1: Write the failing tests**

```go
package email

import "testing"

func TestSendOtp_DisabledLogsAndSucceeds(t *testing.T) {
    s := New("", 587, "", "", "")
    if s.Enabled() {
        t.Fatal("expected disabled sender when host empty")
    }
    if err := s.SendOtp("user@example.com", "123456"); err != nil {
        t.Fatalf("disabled sender should not error: %v", err)
    }
}

func TestNew_DefaultPort(t *testing.T) {
    s := New("smtp.example.com", 587, "u", "p", "no-reply@example.com")
    if !s.Enabled() {
        t.Fatal("expected enabled sender when host set")
    }
    if s.Port != 587 || s.Username != "u" || s.From != "no-reply@example.com" {
        t.Fatalf("sender fields not preserved: %+v", s)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/email/ -count=1`
Expected: FAIL — package `email` does not exist / functions undefined.

- [ ] **Step 3: Implement**

```go
package email

import (
    "fmt"
    "log/slog"
    "net/smtp"
)

type Sender struct {
    Host     string
    Port     int
    Username string
    Password string
    From     string
}

func New(host string, port int, username, password, from string) *Sender {
    return &Sender{Host: host, Port: port, Username: username, Password: password, From: from}
}

func (s *Sender) Enabled() bool {
    return s.Host != ""
}

func (s *Sender) SendOtp(to, code string) error {
    subject := "Your TermVault verification code"
    plain := fmt.Sprintf("Your TermVault verification code is: %s\n\nIt expires in 15 minutes.", code)
    html := fmt.Sprintf("<p>Your TermVault verification code is:</p><p style=\"font-size:24px;font-weight:bold\">%s</p><p>It expires in 15 minutes.</p>", code)

    if !s.Enabled() {
        slog.Info("verification otp", "email", to, "code", code)
        return nil
    }

    msg := []byte("From: " + s.From + "\r\n" +
        "To: " + to + "\r\n" +
        "Subject: " + subject + "\r\n" +
        "MIME-Version: 1.0\r\n" +
        "Content-Type: text/html; charset=UTF-8\r\n" +
        "\r\n" +
        html)

    addr := fmt.Sprintf("%s:%d", s.Host, s.Port)
    var auth smtp.Auth
    if s.Username != "" {
        auth = smtp.PlainAuth("", s.Username, s.Password, s.Host)
    }
    if err := smtp.SendMail(addr, auth, s.From, []string{to}, msg); err != nil {
        return fmt.Errorf("send verification email: %w", err)
    }
    return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/email/ -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/email/
git commit -m "feat: smtp email sender with console fallback"
```

---
