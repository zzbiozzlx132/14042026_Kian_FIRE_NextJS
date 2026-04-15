# Kian FIRE — Deploy Guide

## Server Info

| Key | Value |
|-----|-------|
| **Domain** | `https://fire.kiantr.com` |
| **Server IP** | `222.255.238.138` |
| **SSH User** | `root` |
| **SSH Password** | `RaQ362nZi86mwMPxlipk` |
| **Project Path** | `/root/14042026_Kian_FIRE_NextJS` |
| **Web Port** | `3001` (mapped to container `3000`) |
| **DB Port** | `5432` |
| **Container Web** | `kian-fire-web` |
| **Container DB** | `kian-fire-db` |

## Quick Deploy (1 Command)

```bash
cd /Users/kian/Documents/Code/14042026\ Kian_FIRE/kian-fire
expect deploy-final.exp
```

This script will:
1. SSH into server
2. `git pull origin main`
3. `docker compose down && docker compose up -d --build`
4. Wait 10s and show container status + logs

## Manual Deploy Steps

```bash
# 1. Commit & push
git add -A && git commit -m "your message" && git push origin main

# 2. SSH into server
ssh root@222.255.238.138
# Password: RaQ362nZi86mwMPxlipk

# 3. On server
cd /root/14042026_Kian_FIRE_NextJS
git pull origin main
docker compose down && docker compose up -d --build

# 4. Check status
docker ps -a
docker logs kian-fire-web --tail 30
```

## Environment Variables (docker-compose.yml)

```yaml
- DATABASE_URL=postgresql://postgres:kianfire2026@fire-db:5432/kianfire?schema=public
- NEXTAUTH_URL=https://fire.kiantr.com
- NEXTAUTH_SECRET=kian-fire-vps-super-secret-key-18022026
- AUTH_SECRET=kian-fire-vps-super-secret-key-18022026
- AUTH_TRUST_HOST=true
```

## Admin Login

| Field | Value |
|-------|-------|
| Email | `admin@kiantr.com` |
| Password | `Kian@2026` |

## Troubleshooting

```bash
# View logs
docker logs kian-fire-web --tail 50 -f

# Restart only web
docker restart kian-fire-web

# Rebuild from scratch
docker compose down && docker compose up -d --build

# Check nginx (reverse proxy)
cat /etc/nginx/sites-enabled/fire.kiantr.com
systemctl reload nginx
```

## Tech Stack
- **Framework**: Next.js 16.2.3
- **DB**: PostgreSQL 16 (Docker)
- **Auth**: NextAuth v5
- **ORM**: Prisma
- **Reverse Proxy**: Nginx → port 3001
