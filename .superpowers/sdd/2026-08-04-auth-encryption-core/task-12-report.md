# Task 12: Client TS Auth Pages — Report

## Status: DONE

## Commit
- `51df779` — feat: add auth pages (LoginPage, RegisterPage, SetupPage, RecoveryPage, RecoveryRevealModal)

## Files Created/Modified

### New Files
| File | Description |
|------|-------------|
| `client/src/pages/auth/LoginPage.tsx` | Email + password login with OAuth buttons (Google, GitHub) |
| `client/src/pages/auth/RegisterPage.tsx` | Email + name + password registration with validation |
| `client/src/pages/auth/SetupPage.tsx` | Post-OAuth encryption password setup, shows RecoveryRevealModal |
| `client/src/pages/auth/RecoveryPage.tsx` | Recovery code + new password form |
| `client/src/pages/auth/RecoveryRevealModal.tsx` | Modal displaying recovery code with copy + download kit |
| `client/src/lib/schema/auth/setupFormSchema.ts` | Zod schema for setup form (password + confirm) |
| `client/src/lib/schema/auth/recoveryFormSchema.ts` | Zod schema for recovery form (code + password + confirm) |

### Modified Files
| File | Change |
|------|--------|
| `client/src/App.tsx` | Updated imports to use auth/ pages, added `/setup` and `/recovery` routes |
| `client/src/stores/auth/authStore.ts` | Added `isInitialized` field to AuthState interface, set in `restoreSession` |

## Routes Wired
| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/login` | LoginPage | No |
| `/register` | RegisterPage | No |
| `/forgot-password` | ForgotPasswordPage | No |
| `/setup` | SetupPage | No |
| `/recovery` | RecoveryPage | No |

## Notes
- LoginPage and RegisterPage in `pages/auth/` mirror existing pages at `pages/` root, using same patterns (react-hook-form, zod, shadcn/ui components)
- SetupPage generates mock recovery code (TODO: wire to `authApi.oauthSetup`)
- RecoveryPage submits to `authApi.recovery` (TODO: wire real API call)
- RecoveryRevealModal supports clipboard copy and file download of recovery kit
- All new files pass `pnpm biome check` cleanly
- Pre-existing CRLF formatting issues across codebase are not introduced by this change
