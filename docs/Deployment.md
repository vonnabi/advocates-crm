# Deployment

## Target Notes

Production deployment can use VPS or Render depending on final project decision.

## Render + ONLYOFFICE

Render provides `RENDER_EXTERNAL_URL` and `RENDER_EXTERNAL_HOSTNAME` for web
services. CRM uses them to build public ONLYOFFICE file and callback URLs, so
Docs Cloud does not receive local `127.0.0.1` links.

Required Render Environment variables for ONLYOFFICE Cloud:

- `ONLYOFFICE_DOCUMENT_SERVER_URL` — Docs Cloud URL.
- `ONLYOFFICE_JWT_SECRET` — Docs Cloud secret, keep it secret.
- `CRM_PUBLIC_URL` — optional custom CRM domain; if empty, Render's URL is used.

## VPS Option

- Ubuntu 24.04
- Docker
- Docker Compose
- PostgreSQL
- Nginx or Caddy
- SSL with Let's Encrypt
- Firewall
- Backups
- Environment variables
- Logs and monitoring

## Rules

- Do not commit secrets.
- Keep database private.
- Use HTTPS.
- Store backups outside the application directory.
- Document restore process before pilot.
