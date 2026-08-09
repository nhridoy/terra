# TermVault — Blackbox Authentication Test Plan

**Date:** 2026-08-09
**Perspective:** Blackbox tester. Only two observation channels are used — **what the app shows you** (UI/UX) and **what the HTTP API answers** (status + body, via browser dev tools or curl). You never look inside the server, the database, or the code.
**How to use:** cases are grouped; run them in order. For every case write your verdict (`PASS` / `FAIL`) + what you saw + date in the **Result** line. If a case fails, also record: what the screen/message showed, and the response (status + message) from the request in dev tools.

**Test setup (done once, by whoever starts the server):**
1. Start the backend on a known URL (e.g. `http://localhost:8080`). For this run the server runs with **email verification switched ON** and in **dev delivery mode** — the one-time codes are printed at the bottom of the server's terminal (this is the only "out-of-band" channel you read; treat it like an email inbox).
2. Start the app (or `cd client && pnpm dev` → http://127.0.0.1:1420 for browser).
3. At the end of the session, the same matrix is valid with verification switched **OFF** (first round can be done with OFF if you prefer; note which you ran).

**Test accounts to be created during this run** (use unique emails per run, e.g. `alice.b12@example.com`):

| Label | Email | Purpose |
|-------|-------|---------|
| A1 | `alice.<suffix>@example.com` | main user, password auth |
| A2 | `bob.<suffix>@example.com` | second user (multi-device, change-password victim) |
| A3 | `carol.<suffix>@example.com` | third user (recovery test) |
| A4 | — | **does not exist** (ghost email) |

---

## A‑1 — Registration (sign up)

### A1 Sign-up with valid data → app session starts
- **Steps:**
  1. Open the app → go to **Create account**.
  2. Enter valid email (A1), name, password and confirm.
  3. Submit.
- **Expected (verification OFF):** You land inside the app (no email step). You can see empty host list / home screen.
- **Expected (verification ON):** You are taken to a **"check your email" / enter code** screen, you are NOT inside the app yet. The code appears in the server terminal.
- **Result:** PASS
- Except when registration with the same email, I do not see any error about "already exists" when REQUIRE_EMAIL_VERIFICATION=true. and user is unverified, instead going to the token screen. but during registration with the same email, I should see error about "already exists" for any scenario, whether REQUIRE_EMAIL_VERIFICATION=true or false or user is verified or unverified. either with same password or different password.

### A2 Re-submit the exact same registration (same email + same password) right after
- **Expected:** You do NOT get two accounts or an error about "already exists" (idempotent retry). Either the code screen (ON) or the success (OFF) appears — same as A1.
- **Result:** I should see error about "already exists" for any scenario, whether REQUIRE_EMAIL_VERIFICATION=true or false or user is verified or unverified. either with same password or different password.

### A3 Same email, deliberately **different password** in second attempt
- **Expected:** The server refuses: error message "email already registered" (verification OFF) or — with verification ON — you still land on the code screen but the code you get does NOT unlock a new account, and the attempt is not treated as a fresh sign-up (the message/step you see is indistinguishable from A1 with ON).
- **Result:** I should see error about "already exists" for any scenario, whether REQUIRE_EMAIL_VERIFICATION=true or false or user is verified or unverified. either with same password or different password.

### A4 Invalid inputs — do all of these, one at a time
- **Expected:** each of these shows a clear **validation message** next to the field / top of form and nothing is created:
  - empty fields, invalid email, password too short, password ≠ confirm, missing full name
- **Result:** Currently the full name does not support spaces, so I cannot enter a full name with spaces. I should be able to enter a full name with spaces.

### A5 Network down during registration
- **Steps:** stop the backend, then register.
- **Expected:** friendly error ("cannot reach server" style), app does not freeze; restart server, retry works.
- **Result:** Getting "Failed to fetch" error in the app. app does not freeze, but I should see a more friendly error message like "cannot reach server" instead of "Failed to fetch". after restarting the server, no auto retry happens, I have to manually retry the registration. which I don't mind.

### A6 App closed mid-registration (verification ON) — reopen later and register same email
- **Expected:** The flow behaves consistently — the same verify screen appears where you left off, no duplicate accounts create a confusing state; after entering the code from the email you get in.
- **Result:** See A3. I should see error about "already exists" for any scenario, whether REQUIRE_EMAIL_VERIFICATION=true or false or user is verified or unverified. either with same password or different password.

## B — Email verification (only when delivery mode: verification ON)

### B1 Correct code on first attempt
- **Steps:** as A1-ON; read OTP from terminal/email; enter it.
- **Expected:** success — you're taken inside the app.
- **Result:** PASS

### B2 Still on the code screen before verifying: try a **wrong** code
- **Steps:** enter a wrong 6 digits, e.g. `000000`.
- **Expected:** clear error like "invalid or expired code", stays on code screen, code is NOT consumed.
- **Result:** PASS. shows: "verification code expired or missing". All small case.

### B3 Now the correct code
- **Expected:** enters app fine (wrong attempt didn't break it).
- **Result:** PASS

### B4 Verifying **again** on an already-verified account
- **Steps:** (middle of session) request the code screen again for A1 — e.g. logout + click "didn't receive code?" or the resend button.
- **Expected:** the same generic error "invalid or expired code" for the outdated code — and **not** something that tells an attacker "this email was already verified".
- **Result:** PASS. shows: "verification code expired or missing". All small case. but I should not be able to register with the same email again, whether the account is verified or unverified. I should see error about "already exists" for any scenario, whether REQUIRE_EMAIL_VERIFICATION=true or false or user is verified or unverified. either with same password or different password. see A3.

### B5 Verify a code for an email that was never registered (A4 ghost)
- **Steps:** on the code screen type a made-up email with any code.
- **Expected:** identical error text as B2 — no difference in message, so no emails can be probed.
- **Result:** PASS. API response: {"error":{"code":"INVALID_VERIFICATION_CODE","message":"invalid verification code","request_id":"e30cd5b4-9395-4afe-87fb-b84e53746a12"}}

### B6 Resend code — wait shows
- **Steps:** click resend / "didn't receive code?".
- **Expected:** success message "(re)sent", then a **cooldown** (longer than ~1 min) response if spammed quickly; a new code arrives that works (old one stops working).
- **Result:** PASS, but user does not gets any toast or message that the code was resent. I should see a toast or message that the code was resent.

### B7 Expired code (wait > delivery window)
- **Steps:** request resend, then submit the old code after the wait.
- **Expected:** "expired/invalid code" message; can resend and succeeds.
- **Result:** PASS. shows: "invalid verification code". All small case. should be "verification code expired or missing" instead of "invalid verification code".

## C — Login (password)

### C1 Correct credentials
- **Expected:** inside app (verification ON: only if verified).
- **Result:** PASS

### C2 Wrong password
- **Expected:** generic error "invalid credentials" (or similar) — no extra hint.
- **Result:** PASS. shows: "invalid credentials". All small case.

### C3 Unknown email (A4)
- **Expected:** *same* error message as C2 — you cannot tell which one failed.
- **Result:** PASS. shows: "invalid credentials". All small case.

### C4 Unverified account (verification ON only)
- **Steps:** login with an account that registered but never verified (create quick A2, skip code → logout)
- **Expected:** you are directed to the verification screen — accounts stay safe.
- **Result:** PASS. redirected to the verification screen.

### C5 Login immediately after a password change on another device (P-section)
- **Expected:** with old password → error message, with new password → success.
- **Result:** PASS

## D — Multi-device & session persistence (password-auth)

### D1 Two devices, same account, both online
- **Steps:** login A1 on app instance #1 (browser tab 1) and #2 (tab 2 / second window). Do some action on #1 (create a host).
- **Expected:** both stay signed in; each sees own screens.
- **Result:** COULD NOT TEST. I only have one device. This is not a web app.

### D2 Change password on device 1 (see P1 below)
- **Expected:** device 2 — if you interact → you get signed out to the login screen automatically (right away or on next activity), no lingering "signed in" state.
- **Result:** COULD NOT TEST. I only have one device. But this should work. I should be able to test this with two devices.

### D3 Refresh behavior — long idle
- **Steps:** leave app open > elapsed half-hour idle (token expiry in ~15 min), then act without full login.
- **Expected:** action succeeds without prompting for email/password — the app renews silently; you should not see error.
- **Result:** PASS

### D4 Stop the server, keep using the app 20 min later, restart server, act
- **Expected:** after restart work continues — no "session lost" if refresh works; app errors presented gracefully if server unreachable (no crash).
- **Result:** Partially Working. PASS: Server down -> 20 min later -> server restarted -> app restart -> session restored and land on the home screen. FAIL: Server down -> app restart -> session lost and land on the login screen. I should be able to keep using the app even when the server is down, Otherwise we lost the offline first feature. I should be able to use the app even when the server is down, just like termius.

## E. Logout & session clear

### E1 Logout from menu
- **Expected:** back to login; layout reset (no host list visible for that account).
- **Result:** PASS

### E2 Logout and **immediately close & reopen** the app
- **Expected:** opens on the login screen (state persisted = logged out).
- **Result:** PASS

### E3 Logout while server is down
- **Steps:** stop server, logout.
- **Expected:** logout still completes locally (goes to login screen), no frozen state; restart later login works.
- **Result:** PASS

## F. Unlock (master password on the device)

### F1 After login, device asks for unlock (master password) once
- **Steps:** when the first prompt appears type wrong one.
- **Expected:** visible "wrong master password" error; still locked; correct one then works.
- **Result:** PASS. The app should ask for the master password only for oauth Users on every Login (Working). No need to ask for unlock password for email/password users on every login because they already have a password (Working).

### F2 Restarting the app with "keep me unlocked" enabled
- **Expected:** after restart, app opens **unlocked** (no master prompt).
- **Result:** PASS

### F3 Restart with **Always require my password** toggle ON
- **Expected:** despite save, app asks for the master password on launch — even though logged in.
- **Result:** PASS. For every user, whether oauth or email/password, the app should ask for the master password on every login if "Always require my password" toggle is ON (Working).

## G. Change password

### G1 Change it correctly (current + new)
- **Steps:** Settings → profile/security → change password: current password A1 + new.
- **Expected:** confirmation "password changed", and:
  - login with **old** password → error "invalid credentials"
  - login with **new** → success
- **Result:** PASS

### G2 Change with **wrong current** password
- **Expected:** error "current password incorrect"; no other effect.
- **Result:** PASS

### G3 Halfway change (close app right after submitting, before success screen) — open again next time login
- **Expected:** app opens cleanly; some coherent state — either the old password works and you must retry, or the new one works; never "you can get into a broken account".
- **Result:** …

### G4 Change while server down
- **Expected:** meaningful error, no partial change visible afterwards; retry succeeds when server back.
- **Result:** PASS. Showing "Failed to fetch" error in the app. app does not freeze, but I should see a more friendly error message like "cannot reach server" instead of "Failed to fetch". after restarting the server, no auto retry happens, I have to manually retry the change password. which I don't mind.

## H. Forgot password — Recovery kit

> **Note:** There is NO "email me a reset link" flow. The only recovery is the **Recovery Kit** taken at signup (a download + 30-char code).

### H1 Ask for forgot password on login
- **Expected:** screen that asks for your **recovery code** (not "email me a link"). Typing garbage → "invalid code" error; nothing else disclosed.
- **Result:** PASS

### H2 Complete with valid code
- **Steps:** earlier acquired A3's kit (or create one — see H4), enter code → set a new password.
- **Expected:** success; login works with that new password; **old password fails**.
- **Result:** FAIL.
- **Network calls in order:**
1. curl --url 'http://localhost:8080/api/v1/auth/recovery/prefetch' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:1420' \
  -H 'Referer: http://localhost:1420/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"recovery_code":"LB9PTOVfvABZHyTgV6iZew"}'

  Response (200): {
    "data": {
        "dek_wrapped_by_recovery": "{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"182Mz9SaqT5WfkEEV1zW3PXMJp8YxgAc\",\"ct\":\"PWlsFtx0cql2igq9EGcq/COwOSb6BYLbrsxIeMs2sPGUOtwFoN/LCIblCJ9aiVQQ\",\"aad\":\"ZGVr\"}",
        "email": "alice.03@example.com",
        "kdf": {
            "m": 32768,
            "p": 1,
            "t": 2
        },
        "nonce": "PytGE2qI4N3bgaZB+lgg9ri6xKmQZChZrjuZe4oxpNs",
        "salt_cl": "z9d/yVhaXkK3PO3CahQgvg",
        "server_salt": "+X/F5Bbh3+jxVodzGLSwpFyntnaGZtE+zxXu9eIWhXQ"
    },
    "meta": {
        "request_id": "5e5cc947-9d97-4b25-b9d6-ece1dbd558aa"
    }
}

2. curl --url 'http://ipc.localhost/recovery_unwrap_dek' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 11914552' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 1307504088' \
  -H 'content-type: application/json' \
  --data-raw '{"recoveryCode":"LB9PTOVfvABZHyTgV6iZew","saltCl":"z9d/yVhaXkK3PO3CahQgvg","wrapped":"{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"182Mz9SaqT5WfkEEV1zW3PXMJp8YxgAc\",\"ct\":\"PWlsFtx0cql2igq9EGcq/COwOSb6BYLbrsxIeMs2sPGUOtwFoN/LCIblCJ9aiVQQ\",\"aad\":\"ZGVr\"}"}'

  Response (200): null

3. curl --url 'http://ipc.localhost/derive_kek' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 3148031239' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 927075757' \
  -H 'content-type: application/json' \
  --data-raw '{"password":"Admin@1234#","saltCl":"z9d/yVhaXkK3PO3CahQgvg"}'

  Response (200): null

4. curl --url 'http://ipc.localhost/generate_recovery_code' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 945966645' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 4086819774' \
  -H 'content-type: application/json' \
  --data-raw '{}'

  Response (200): "hy5LAvY3V5AP59sVSb8mbw"

5. curl --url 'http://ipc.localhost/build_keyring_rows' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 2011042056' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 2121635830' \
  -H 'content-type: application/json' \
  --data-raw '{"recoveryCode":"hy5LAvY3V5AP59sVSb8mbw"}'

  Response (200): {
    "dek_wrapped_by_kek": "{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"wKFtahUvTvhfOGdPdz0gEC4+wWZOo97E\",\"ct\":\"tv9Ber2Uv6LbarosiL1p9D29Qop9LfTtNEi1sO5IjlFQwV4kLcZzj1/xDBttu7KF\",\"aad\":\"ZGVr\"}",
    "dek_wrapped_by_recovery": "{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"icG3/yvL/DiAE97jxmQJ7LmxAgI7YDRA\",\"ct\":\"TOMkVE7hxCdajdHBoCQj8dSRxqSICEG063GfSsKvRrESfUWFIX9UZ2rwTZIn9qHK\",\"aad\":\"ZGVr\"}",
    "private_key_wrapped_by_dek": "{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"sn9aXA4Dei9aQYCHM9mhgURFWQqnPqOU\",\"ct\":\"6mRGpbKp+MkD80s9CzbrXTykCQnmf1UY7TFq3m96u9p+oaYjHP2d7MlR1QeErFGw\",\"aad\":\"cHJpdmF0ZV9rZXk\"}"
}

6. curl --url 'http://ipc.localhost/compute_login_proof' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 2974207585' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 1403785072' \
  -H 'content-type: application/json' \
  --data-raw '{"serverSalt":"+X/F5Bbh3+jxVodzGLSwpFyntnaGZtE+zxXu9eIWhXQ","nonce":"PytGE2qI4N3bgaZB+lgg9ri6xKmQZChZrjuZe4oxpNs"}'

  Response (200): {
    "verifier": "3dspgXJfB5OfQtiZhQzwtRAM5stBQbOeCzlzTpcoB/w",
    "proof": "ly3prot0vF/m9IAtQvwnbxEfD50h84ikkxJlaEt2xCM"
}

7. curl --url 'http://ipc.localhost/sign_challenge' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 3391073190' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 237280670' \
  -H 'content-type: application/json' \
  --data-raw '{"nonce":"PytGE2qI4N3bgaZB+lgg9ri6xKmQZChZrjuZe4oxpNs"}'

  Response (200): "NutvJ74E6K28hmpscF8/Josdi94z30sNYFR65/DLLCw"

8. curl --url 'http://localhost:8080/api/v1/auth/recovery' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:1420' \
  -H 'Referer: http://localhost:1420/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"recovery_code":"LB9PTOVfvABZHyTgV6iZew","signature":"NutvJ74E6K28hmpscF8/Josdi94z30sNYFR65/DLLCw","new_recovery_code":"hy5LAvY3V5AP59sVSb8mbw","new_verifier":"3dspgXJfB5OfQtiZhQzwtRAM5stBQbOeCzlzTpcoB/w","new_encrypted_dek":"{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"wKFtahUvTvhfOGdPdz0gEC4+wWZOo97E\",\"ct\":\"tv9Ber2Uv6LbarosiL1p9D29Qop9LfTtNEi1sO5IjlFQwV4kLcZzj1/xDBttu7KF\",\"aad\":\"ZGVr\"}","new_dek_wrapped_by_recovery":"{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"icG3/yvL/DiAE97jxmQJ7LmxAgI7YDRA\",\"ct\":\"TOMkVE7hxCdajdHBoCQj8dSRxqSICEG063GfSsKvRrESfUWFIX9UZ2rwTZIn9qHK\",\"aad\":\"ZGVr\"}","new_nonce":"PytGE2qI4N3bgaZB+lgg9ri6xKmQZChZrjuZe4oxpNs","new_kdf":{"m":32768,"t":2,"p":1},"new_server_salt":"+X/F5Bbh3+jxVodzGLSwpFyntnaGZtE+zxXu9eIWhXQ","new_salt_cl":"z9d/yVhaXkK3PO3CahQgvg"}'

  Response (401): {
    "error": {
        "code": "UNAUTHORIZED",
        "message": "invalid signature",
        "request_id": "7575eba9-d3ae-4ce0-bc51-a1edead3afb2"
    }
}

Also, lets say user is registered when REQUIRE_EMAIL_VERIFICATION=false and got the recovery kit, then server changed to REQUIRE_EMAIL_VERIFICATION=true, then user tries login, and failed and lands on the otp verification screen, then user click resend otp, got the otp, varify the otp. Till now everything is working fine. Then user tries to use the recovery kit, and failed with "Incorrect recovery code" error. Meaning the recovery kit he got during signup. 
Here is the network calls in order for this case:

1. curl --url 'http://localhost:8080/api/v1/auth/recovery/prefetch' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:1420' \
  -H 'Referer: http://localhost:1420/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-raw '{"recovery_code":"xsmL61xMfiffnquw0zaf3A"}'

  Response (200): {
    "data": {
        "dek_wrapped_by_recovery": "{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"Q1NJOpatqdlePrhppuLd50hQaV720zVF\",\"ct\":\"rhDCSKPWn2MIX2cQfJCoGRPSci56SjcJb0yFkpTtI66dBwiDYrYs4uYin6nbpino\",\"aad\":\"ZGVr\"}",
        "email": "alice.01@example.com",
        "kdf": {
            "m": 32768,
            "p": 1,
            "t": 2
        },
        "nonce": "ncv70SG6TCPo+ZUB87QsCcVc73pBSnxklkZW/WSyBDc",
        "salt_cl": "mNfEtrv8hor8RRsLDqK0BA",
        "server_salt": "WynMQGbs4Rw2PPzVf87dIA"
    },
    "meta": {
        "request_id": "e33b74f7-7150-4b0a-abe4-d99b5e432ca1"
    }
}

2. curl --url 'http://ipc.localhost/recovery_unwrap_dek' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'Referer: http://localhost:1420/' \
  -H 'sec-ch-ua: "Chromium";v="151", "Not=A?Brand";v="99", "Microsoft Edge WebView2";v="151", "Microsoft Edge";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'tauri-invoke-key: AZ}{Ujz]KJ3kyCmNeQUd' \
  -H 'tauri-error: 4061072912' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0' \
  -H 'tauri-callback: 4257556989' \
  -H 'content-type: application/json' \
  --data-raw '{"recoveryCode":"xsmL61xMfiffnquw0zaf3A","saltCl":"mNfEtrv8hor8RRsLDqK0BA","wrapped":"{\"v\":1,\"alg\":\"xchacha20poly1305\",\"nonce\":\"Q1NJOpatqdlePrhppuLd50hQaV720zVF\",\"ct\":\"rhDCSKPWn2MIX2cQfJCoGRPSci56SjcJb0yFkpTtI66dBwiDYrYs4uYin6nbpino\",\"aad\":\"ZGVr\"}"}'

  Response (200): "Incorrect recovery code"

### H3 Using the same code a second time
- **Expected:** rejected: "invalid or already used" — recovery code is single-use.
- **Result:** COULD NOT TEST. I was not able to use the recovery kit even once. I should be able to use the recovery kit once, and then it should be invalid for any subsequent attempts.

### H4 Creating a recovery kit while logged in
- **Steps:** Settings → recovery kit → download.
- **Expected:** file downloads, you get a 30-char code, flow says "keep it safe".
- **Result:** NON EXISTENT FEATURE. Do not need.

### H5 Lost/partial code (few chars typo)
- **Expected:** simple "invalid code" error, no partial info revealed, retriable.
- **Result:** PASS

## I. Sign in with Google (and GitHub if configured)

### I1 First sign-in with a brand-new Google email
- **Expected:** final screen: "finish sign-up — create a password (needed to use desktop app)" **OR** auto-create account. You complete a password. Report what you saw.
- **Result:** PASS. After account is created, user is presented with the password creation screen. User can create a password and then login successfully.

### I2 Signing in again with a second Google (existing OAuth account)
- **Expected:** directly into app — you already have the account; login succeeds (possibly still requiring the password stay as-is).
- **Result:** PASS.

### I3 Cancel the Google consent page
- **Expected:** you're returned to the login page with an error/ nothing — no account created, no hang.
- **Result:** Closing the consent page does noting in the app for 120 seconds. After 120 seconds, the app shows a message "OAuth callback timed out after 120 seconds. Please try again.". Pressing Cancel in the google concent page makes the google login page keeps loading.

### I4 Google button with OAuth not configured (`OAuth disabled`)
- **Expected:** error like "provider not configured" shown on the login page.
- **Result:** FAIL. Does not show any error. Instead still redirects to google oauth screen. But since oauth is not configured, it shows "Missing required parameter: client_id Learn more about this error
If you are a developer of this app, see error details.
Error 400: invalid_request" in google oauth screen. The app should show an error like "provider not configured" on the login page instead of redirecting to google oauth screen. Same is for github oauth. The app should show an error like "provider not configured" on the login page instead of redirecting to github oauth screen.

## J. Security behavior (external observation)

### J1 Wrong-password hammering (run 12 failed logins in ~1 minute, single IP)
- **Expected:** around the 10th the server returns "too many requests" (429 in network tab); valid login after cool-down works again.
- **Result:** PASS. After 5 failed login attempts, the server returns "too many requests" (429 in network tab). After waiting for 1 minute, valid login works again.

### J2 Verify code: enter 5 wrong OTPs rapidly
- **Expected:** at some point the code becomes invalid AND even the correct one no longer works (« code exhausted ») — user must resend.
- **Result:** PASS

### J3 Non-JSON body paths by hand: POST weird text to `/api/v1/auth/prelogin` (via curl/devtools)
- **Expected:** HTTP 400 enter. No crash; server keeps serving.
- **Result:** PASS

### J4 Unknown route (`/api/v1/nope`)
- **Expected:** 404 JSON error.
- **Result:** PASS. getting: 404 page not found

### J5 Direct login without prelogin step (via API: POST login with a proof that was never issued)
- **Expected:** 401 invalid credentials — a server-side issued proof is mandatory.
- **Result:** PASS

### J6 Replay: capture a successful login request and re-send it identical (devtools copy as fetch)
- **Expected:** second one gets 401 (proof is single-use).
- **Result:** PASS

### J7 CORS from a foreign origin (in browser: open http://localhost:3000 and fetch the API)
- **Expected:** browser blocks the response / server refuses the origin (CORS error in console, JSON 403 allowed).
- **Result:** PASS

## K. Session behavior matrix (optional quick pass, verification OFF)

- **Source of truth — always in exact wording:**

| Over all of the above | verify that |
|------------------------|-------------|
| Every **success** screen shows | distinct informative view (inside app) |
| Every **failure** is a | message "Something went wrong"-type, never raw error dumps / stack traces through the UI |
| Request IDs | every response carries a `request_id` (JSON) in dev tools |
| Two devices reset | after changing pw the old device session terminates cleanly |

---

### Final bug funnel — after you finish every case:

| # | Case | Verdict | What you saw (attach terminal/network if possible) | Reproduction steps |
|---|------|---------|------------------------------------------------------|--------------------|
|  |  |  |  |  |

*Columns you fill per case above… only list FAILED Cases here plus anything unusual.*

I already filled FAILED cases in place.

Extra findings: Our app is suppose to be offline first, but it is not. When the server is down, the app should still be usable. But when the server is down, the app does not work at all. I should be able to use the app even when the server is down, just like termius. What I noticed is that app stores only refresh token in keyring, and on each app launch, it tries to refresh the token from the server. If the server is down, the app redirects user to the login screen. How does termius works? We need to implement the same offline first feature like termius. The app should be usable even when the server is down. I need suggestions on how to implement the offline first feature like termius.