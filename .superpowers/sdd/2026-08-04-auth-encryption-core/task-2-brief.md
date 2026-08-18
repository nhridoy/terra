# Task 2: Server Responses + JWT + Verifier

**Files:**
- Create: `server/internal/auth/responses.go`
- Create: `server/internal/auth/jwt.go`
- Create: `server/internal/auth/verifier.go`

**Interfaces:**
- Produces: `auth.Success(c, status, data)`, `auth.Error(c, status, code, msg)`, `auth.GenerateTokenPair(userID, deviceID, cfg)`, `auth.ConstantTimeCompare(a, b)`

## Steps

1. Write `server/internal/auth/responses_test.go`:
```go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/gin-gonic/gin"
)

func TestSuccessResponse(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	Success(c, http.StatusOK, gin.H{"id": "123"})
	if w.Code != 200 { t.Fatalf("expected 200, got %d", w.Code) }
	// verify envelope structure: {"data": {"id": "123"}, "meta": {"request_id": ""}}
}
```

2. Implement `server/internal/auth/responses.go`:
```go
package auth

import "github.com/gin-gonic/gin"

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, gin.H{"data": data, "meta": gin.H{"request_id": c.GetString("request_id")}})
}

func Error(c *gin.Context, status int, code string, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message, "request_id": c.GetString("request_id")}})
}
```

3. Run response tests → PASS

4. Write `server/internal/auth/jwt_test.go`:
- Test: GenerateTokenPair returns access + refresh
- Test: VerifyAccessToken returns claims
- Test: expired token fails verification

5. Implement `server/internal/auth/jwt.go`:
- GenerateTokenPair(userID uuid.UUID, deviceID string, cfg *config.Config) → (accessToken, refreshToken string, err error)
- VerifyAccessToken(tokenString string, cfg *config.Config) → (*Claims, error)
- Use `github.com/golang-jwt/jwt/v5`, HS256, claims: sub, device_id, jti, iat, exp

6. Write `server/internal/auth/verifier_test.go`:
- Test: GenerateProof(V, nonce) == HMAC-SHA256(V, nonce)
- Test: ConstantTimeCompare works for equal and unequal inputs

7. Implement `server/internal/auth/verifier.go`:
- GenerateProof(verifier []byte, nonce []byte) []byte → HMAC-SHA256(verifier, nonce)
- ConstantTimeCompare(a, b []byte) bool → crypto/subtle.ConstantTimeCompare

8. Run all server tests → PASS

9. Commit
