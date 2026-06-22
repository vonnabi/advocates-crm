# CRM Deployment

Use this local skill when preparing CRM for production deployment.

## Target

Ubuntu 24.04 VPS, Docker, Docker Compose, PostgreSQL, Nginx or Caddy, SSL with Let's Encrypt, backups, firewall, environment variables.

## Rules

- Do not commit secrets.
- Use `.env` files.
- Keep database private.
- Use HTTPS.
- Add backup strategy.
- Add deployment README.
- Prefer controlled production setup.

