# ONLYOFFICE Document Server — локальный запуск

Полноценный Word/Excel/PowerPoint/PDF-редактор внутри CRM. Когда сервер поднят,
кнопка «ONLYOFFICE» / открытие документа грузит настоящий редактор; если сервер
недоступен — CRM откатывается на встроенный текстовый редактор.

## Запуск (Mac, Colima + Docker)

```bash
# 1. Поднять Docker-движок (если не запущен)
colima start --cpu 2 --memory 4

# 2. Поднять ONLYOFFICE Document Server
docker compose -f docker-compose.onlyoffice.yml up -d

# 3. Дождаться готовности (вернёт true через ~30–120 с)
curl -s http://127.0.0.1:8082/healthcheck
```

CRM запускается как обычно: `npm run serve` (Django на :8001).

## Как это связано

- Document Server слушает **:8082** (контейнер, порт 80 → 8082).
- Редактор скачивает файл и шлёт сохранённую версию обратно в CRM по
  **`host.docker.internal:8001`** (см. `serverAccessUrl` в настройках CRM) —
  именно так контейнер достукивается до Django на хосте.
- Callback-эндпоинт: `POST /api/documents/<id>/onlyoffice/callback/`
  (CSRF-exempt, возвращает `{"error":0}`).
- Настройки интеграции (URL'ы) хранятся в CRMSettings (бэкенд), раздел
  «Налаштування → Інтеграції».

## Остановка / обслуживание

```bash
docker compose -f docker-compose.onlyoffice.yml stop     # пауза
docker compose -f docker-compose.onlyoffice.yml down      # удалить контейнер (тома сохраняются)
docker logs -f advocates-crm-onlyoffice                   # логи
```

После перезагрузки Mac нужно снова `colima start` — контейнер с
`restart: unless-stopped` поднимется сам, как только заработает Docker.

## Прод

- JWT сейчас выключен (`JWT_ENABLED: "false"` в compose) — ок для локалки.
  На проде включить JWT и задать `ONLYOFFICE_JWT_SECRET` + `jwtSecret` в настройках.
- Document Server требует ~2 ГБ RAM — на бесплатных хостингах обычно не помещается;
  нужен отдельный сервер/инстанс, доступный CRM по сети.

## Render + ONLYOFFICE Docs Cloud

Для ONLYOFFICE Cloud локальные адреса (`127.0.0.1`, `localhost`) не работают:
облачный Document Server должен сам скачать файл из CRM и отправить callback назад.

На Render CRM автоматически использует публичный URL сервиса:

- сначала `CRM_PUBLIC_URL`, если он задан вручную;
- затем стандартный `RENDER_EXTERNAL_URL`;
- затем `https://$RENDER_EXTERNAL_HOSTNAME`.

Этим URL автоматически заполняются:

- `serverAccessUrl`;
- `callbackUrl`;
- URL файла в server-side ONLYOFFICE config.

В Render Environment нужно задать:

```text
ONLYOFFICE_DOCUMENT_SERVER_URL=https://<адрес>.docs.onlyoffice.com
ONLYOFFICE_JWT_SECRET=<секретный ключ из панели Docs Cloud>
CRM_PUBLIC_URL=https://<ваш-домен>   # опционально, если используете custom domain
```

`ONLYOFFICE_JWT_SECRET` нельзя коммитить в репозиторий. В `render.yaml` он объявлен
как `sync: false`, поэтому значение вводится в Render Dashboard.

## Важно: два пути хранения текста

- **ONLYOFFICE** редактирует и сохраняет сам **файл** документа (`.docx` и т.п.).
- **Встроенный редактор** (fallback) сохраняет поле **`content`** в БД.

Это разные хранилища. Если документ редактировали обоими способами, они могут
разойтись. Договорённость: при поднятом сервере основной редактор — ONLYOFFICE;
встроенный — только запасной для localhost/демо без Docker.
