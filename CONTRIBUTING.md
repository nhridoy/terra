# Contributing to TermVault

Thank you for your interest in contributing to TermVault! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 18+
- Go 1.21+
- Rust (for Tauri)
- Docker (optional)

### Frontend (Client)

```bash
cd client
npm install
npm run dev
```

### Backend (Server)

```bash
cd server
go mod download
go run cmd/termvault-server/main.go
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Code Style

### TypeScript/React

- Use functional components with hooks
- Follow ESLint configuration
- Use Zustand for state management
- Prefer named exports

### Go

- Follow `gofmt` conventions
- Use meaningful variable names
- Add comments for exported functions
- Handle errors explicitly

### Rust (Tauri)

- Follow `rustfmt` conventions
- Use `clippy` lints
- Handle errors with `Result`

## Testing

```bash
# Client tests
cd client && npm test

# Server tests
cd server && go test ./...

# Mobile tests
cd mobile && npm test
```

## Pull Request Process

1. Fork and create feature branch
2. Make changes with clear commit messages
3. Add/update tests
4. Update documentation if needed
5. Ensure CI passes
6. Request review

## Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Specify OS and versions
- Add error messages/screenshots

## License

By contributing, you agree that your contributions will be licensed under MIT License.
