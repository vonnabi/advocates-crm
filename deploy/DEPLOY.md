# Deploy the Advocates CRM on a VPS (Ubuntu 24.04 + Docker)

Self-contained stack: **Caddy** (auto HTTPS) + **Django/gunicorn** + **PostgreSQL** + **ONLYOFFICE Document Server**.

## 0. Prerequisites
- Ubuntu 24.04 VPS, root SSH access.
- Docker + Docker Compose installed (see the one-shot server prep block below).
- DNS A-records pointing at the server IP for:
  - `advokatcrm.com`
  - `www.advokatcrm.com`
  - `office.advokatcrm.com`  ← needed so ONLYOFFICE gets its own HTTPS certificate

## 1. One-time server prep
```bash
export DEBIAN_FRONTEND=noninteractive
sed -i "s/#\$nrconf{restart}.*/\$nrconf{restart} = 'a';/" /etc/needrestart/needrestart.conf 2>/dev/null || true
apt update && apt -y upgrade
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt -y install ufw git
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
curl -fsSL https://get.docker.com | sh
```

## 2. Get the code
```bash
git clone https://github.com/vonnabi/advocates-crm.git /opt/crm
cd /opt/crm/deploy
```

## 3. Create the `.env` with generated secrets
```bash
cp .env.example .env
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
DB_PASS=$(python3 -c "import secrets; print(secrets.token_hex(16))")
OO_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(24))")
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|" .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env
sed -i "s|^ONLYOFFICE_JWT_SECRET=.*|ONLYOFFICE_JWT_SECRET=${OO_SECRET}|" .env
```
(Edit `.env` by hand if your domain differs.)

## 4. Launch
```bash
docker compose up -d --build
```
First run downloads images and builds the app (a few minutes). ONLYOFFICE needs ~2–5 min to initialize. Caddy issues SSL certificates automatically once DNS resolves.

Check status / logs:
```bash
docker compose ps
docker compose logs -f caddy      # watch certificate issuance
docker compose logs -f web        # watch Django start
```

## 5. First login
1. Open **https://advokatcrm.com**.
2. Log in with the seeded admin: `ivanenko@advocates.crm` / `demo12345`.
3. **Immediately change the admin password** (profile → change password).
4. Optionally clear the demo data: Settings → demo data → clear (keeps your admin, removes sample cases).

## 6. Updating later
```bash
cd /opt/crm && git pull
cd deploy && docker compose up -d --build
```

## 7. Backups (run from the server)
Database dump:
```bash
docker compose exec -T db pg_dump -U advokat advokat_crm | gzip > /root/crm-db-$(date +%F).sql.gz
```
Uploaded files live in the `media` Docker volume. A daily cron + off-site copy is recommended.

## Notes
- IONOS blocks outbound SMTP port 25. To send real email later, use an SMTP relay on port 587 (set via the CRM's Email integration settings) — not port 25.
- ONLYOFFICE and the CRM share this server: the CRM is at `advokatcrm.com`, the editor at `office.advokatcrm.com`, both public, so document editing works end-to-end.
