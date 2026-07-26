# Деплой в одну команду (без пароля)

Після одноразового налаштування SSH-ключа деплой на прод робиться так:

```bash
npm run deploy
```

Скрипт зайде на сервер, зробить `git pull origin main` і пересбирає Docker-стек
(`docker compose up -d --build` + `restart web`), покаже статус контейнерів.

---

## Одноразове налаштування (≈2 хвилини)

Виконати **на своєму Mac**, по одному разу.

### 1. SSH-ключ

Якщо файлу `~/.ssh/id_ed25519` ще нема — створити:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
```

(`-N ""` — без пароля на сам ключ, щоб деплой був неінтерактивним.)

### 2. Віддати ключ серверу

Ця команда **один раз** спитає пароль сервера (`I82g0BTg04lp7`) і після цього
паролі більше не знадобляться:

```bash
ssh-copy-id root@212.227.22.42
```

> Якщо `ssh-copy-id` не встановлено:
> ```bash
> cat ~/.ssh/id_ed25519.pub | ssh root@212.227.22.42 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
> ```

### 3. Зручний alias `crm`

```bash
printf '\nHost crm\n  HostName 212.227.22.42\n  User root\n  IdentityFile ~/.ssh/id_ed25519\n' >> ~/.ssh/config
```

Тепер `ssh crm` заходить на сервер без пароля, а `npm run deploy` — деплоїть.

---

## Перевірка

```bash
ssh crm true && echo OK        # має надрукувати OK без запиту пароля
npm run deploy                 # повний деплой
```

Після деплою відкрити https://advokatcrm.com і зробити **Cmd+Shift+R**
(жорстке оновлення, щоб браузер підхопив свіжі JS/CSS).

---

## Якщо треба інший сервер/шлях

```bash
CRM_DEPLOY_HOST=root@1.2.3.4 CRM_DEPLOY_DIR=/opt/crm npm run deploy
```
