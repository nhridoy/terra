# Deployment

## Docker Deployment (Recommended)

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/termvault.git
cd termvault

# Create environment file
cp .env.example .env
# Edit .env with your settings

# Start the server
docker-compose up -d

# Check status
docker-compose ps
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  termvault:
    image: termvault/server:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=sqlite:///data/termvault.db
      - JWT_SECRET=${JWT_SECRET}
      - OAUTH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - OAUTH_GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - OAUTH_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - OAUTH_GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    volumes:
      - termvault-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  termvault-data:
```

### Environment Variables

```bash
# Server
TERMVAULT_PORT=8080
TERMVAULT_HOST=0.0.0.0

# Database
DATABASE_URL=sqlite:///data/termvault.db
# DATABASE_URL=postgres://user:pass@localhost:5432/termvault
# DATABASE_URL=mysql://user:pass@localhost:3306/termvault

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h

# OAuth
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
```

## Manual Deployment

### Server

```bash
# Install Go 1.21+
# Build the server
cd server
go build -o termvault-server cmd/termvault-server/main.go

# Run the server
./termvault-server
```

### Desktop Client

```bash
# Install Node.js 20+ and Rust
cd client

# Install dependencies
npm install

# Build for production
npm run tauri build

# The installer will be in src-tauri/target/release/bundle/
```

### Mobile

```bash
# Install Node.js 20+ and Expo CLI
cd mobile

# Install dependencies
npm install

# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android
```

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 80;
    server_name termvault.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```
termvault.yourdomain.com {
    reverse_proxy localhost:8080
}
```

## SSL/TLS Configuration

### Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d termvault.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Database Migration

```bash
# SQLite (automatic)
# Tables are created on first run

# PostgreSQL/MySQL
cd server
go run cmd/migrate/main.go
```

## Backup

### Database Backup

```bash
# SQLite
cp /data/termvault.db /backup/termvault-$(date +%Y%m%d).db

# PostgreSQL
pg_dump termvault > /backup/termvault-$(date +%Y%m%d).sql

# MySQL
mysqldump termvault > /backup/termvault-$(date +%Y%m%d).sql
```

### Automated Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backup/termvault"
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# SQLite
cp /data/termvault.db $BACKUP_DIR/termvault-$DATE.db

# Compress
gzip $BACKUP_DIR/termvault-$DATE.db

# Remove old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected"
}
```

### Logs

```bash
# Docker logs
docker-compose logs -f termvault

# System logs
journalctl -u termvault -f
```

## Security Hardening

### Firewall

```bash
# UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### Fail2Ban

```ini
[termvault]
enabled = true
port = http,https
filter = termvault
logpath = /var/log/termvault/access.log
maxretry = 5
bantime = 3600
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  termvault:
    image: termvault/server:latest
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
  redis:
    image: redis:alpine
```

### Load Balancer

```nginx
upstream termvault {
    server termvault1:8080;
    server termvault2:8080;
    server termvault3:8080;
}

server {
    listen 80;
    server_name termvault.yourdomain.com;

    location / {
        proxy_pass http://termvault;
    }
}
```
