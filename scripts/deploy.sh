#!/usr/bin/env bash
#
# One-command production deploy for the Advocates CRM VPS.
#   npm run deploy
#
# It logs into the server over SSH (key-based, no password — see the one-time
# setup in scripts/deploy-setup.md), pulls `main`, and rebuilds the Docker stack.
#
# Override host/dir if needed:
#   CRM_DEPLOY_HOST=root@1.2.3.4 CRM_DEPLOY_DIR=/opt/crm npm run deploy
#
set -euo pipefail

HOST="${CRM_DEPLOY_HOST:-crm}"          # ssh alias from ~/.ssh/config (see setup doc)
REMOTE_DIR="${CRM_DEPLOY_DIR:-/opt/crm}"

# --- Preflight: can we log in WITHOUT a password? -------------------------------
if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "${HOST}" true 2>/dev/null; then
  cat <<'MSG'
✖ Не вдалося зайти на сервер без пароля.

  Одноразове налаштування (детально: scripts/deploy-setup.md):

    # 1) ключ (пропусти, якщо ~/.ssh/id_ed25519 вже є)
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

    # 2) віддати публічний ключ серверу — спитає пароль сервера ОДИН раз
    ssh-copy-id root@212.227.22.42

    # 3) зручний alias "crm"
    printf '\nHost crm\n  HostName 212.227.22.42\n  User root\n  IdentityFile ~/.ssh/id_ed25519\n' >> ~/.ssh/config

  Після цього: npm run deploy
MSG
  exit 1
fi

# --- Deploy --------------------------------------------------------------------
echo "▶ Deploy → ${HOST}:${REMOTE_DIR}"
ssh "${HOST}" "set -e; \
  cd '${REMOTE_DIR}'; \
  echo '— git pull —'; git pull origin main; \
  cd deploy; \
  echo '— docker compose up --build —'; docker compose up -d --build; \
  docker compose restart web; \
  echo '— status —'; docker compose ps"

echo ""
echo "✅ Deploy завершено. Відкрий https://advokatcrm.com (Cmd+Shift+R, щоб скинути кеш)."
