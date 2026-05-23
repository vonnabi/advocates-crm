# Advocates Bureau CRM Prototype

Рабочий прототип CRM для юридического бюро по ТЗ из WhatsApp-чата и скринов.

## Как открыть проект в VS Code

1. Откройте Visual Studio Code.
2. Нажмите `File -> Open Folder`.
3. Выберите папку:

```text
/Users/vovaladyga/Desktop/WhatsApp Chat - Влад И София/crm-prototype
```

## Как запустить CRM локально

Основной локальный режим проекта — Django backend на `8001`. Через него открывается frontend, API, база данных, пользователи, роли, журнал действий и сохранение данных.

Из корня проекта:

```bash
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py seed_demo --clear
../.venv/bin/python manage.py runserver 127.0.0.1:8001
```

Короткая команда из корня проекта:

```bash
npm run serve
```

После этого откройте:

```text
http://127.0.0.1:8001/
```

Если виртуального окружения еще нет, один раз выполните:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Как проверить интерфейс

В проект установлен Playwright для быстрой проверки основных экранов и модальных окон:

```bash
npm run test:smoke
```

Smoke-тест запускается против `http://127.0.0.1:8001/`, но включает стабильный статический demo-mode для сценариев интерфейса. Отдельный frontend-сервер для проверки не нужен.

На GitHub этот же тест запускается автоматически перед публикацией GitHub Pages. Если проверка падает, сайт не публикуется с поломанным интерфейсом.

## Как запустить ONLYOFFICE для документов

Для полноценного редактирования `.docx` в CRM нужен отдельный ONLYOFFICE Document Server. Локально его можно поднять через Docker:

```bash
docker compose -f docker-compose.onlyoffice.yml up -d
```

В локальном compose включен `ALLOW_PRIVATE_IP_ADDRESS=true`, чтобы ONLYOFFICE мог забрать файл из CRM через `host.docker.internal`. На боевом сервере лучше использовать публичный HTTPS-адрес CRM вместо private IP.

После запуска Document Server будет доступен здесь:

```text
http://127.0.0.1:8082/
```

В CRM откройте `Налаштування -> Інтеграції -> ONLYOFFICE` и укажите:

```text
Document Server URL: http://127.0.0.1:8082
CRM URL для Document Server: http://host.docker.internal:8001
Callback URL CRM: http://127.0.0.1:8001/api/documents/{id}/onlyoffice/callback/
```

`Document Server URL` открывает редактор в браузере, а `CRM URL для Document Server` нужен самому контейнеру ONLYOFFICE, чтобы забрать DOCX-файл и вернуть сохраненную версию в CRM.

Для боевого сервера Document Server должен быть доступен по HTTPS и видеть URL файлов CRM. CRM отдает DOCX через `/api/documents/<id>/file/`, а ONLYOFFICE возвращает сохраненную версию в callback.

## Как опубликовать ссылку для заказчика

Проект подготовлен для GitHub Pages. После пуша в GitHub workflow из `.github/workflows/pages.yml` опубликует папку `frontend` как сайт.

Ссылка будет в формате:

```text
https://<github-username>.github.io/<repository-name>/
```

В настройках репозитория GitHub откройте `Settings -> Pages` и выберите источник `GitHub Actions`.

Важно: GitHub Pages публикует только интерфейс из папки `frontend`. Внутренние материалы, ТЗ и демо-данные не нужны заказчику для просмотра сайта.

## Как опубликовать полноценное демо с логином

Для просмотра заказчиком с настоящим входом, ролями и сохранением данных используем Render Blueprint:

1. Откройте Render Dashboard.
2. Создайте `New Blueprint Instance`.
3. Подключите GitHub-репозиторий `vonnabi/advocates-crm`.
4. Render прочитает `render.yaml` и создаст:
   - Django web service `advocates-crm`;
   - PostgreSQL database `advocates-crm-db`;
   - переменные окружения `DATABASE_URL`, `SECRET_KEY`, `DJANGO_DEBUG=false`.
5. При первом запуске сервис выполнит миграции и импорт демо-данных, если база еще пустая.

Тестовый вход после деплоя:

```text
ivanenko@advocates.crm
demo12345
```

В этом варианте заказчик открывает ссылку вида `https://advocates-crm.onrender.com/` и видит не статический макет, а CRM через Django backend.

## Структура проекта

```text
crm-prototype/
  README.md
  frontend/       # текущий кликабельный интерфейс
  backend/        # Django backend, API, миграции и seed демо-данных
  data/           # демо-данные и будущие seed-файлы
  materials/      # исходное ТЗ, WhatsApp-чат и картинки по проекту
  docs/           # описание модулей, архитектуры и плана работ
  design/         # скрины, референсы, UI-заметки
  integrations/   # Telegram, SMS, Email, AI
  scripts/        # команды запуска и вспомогательные скрипты
```

## Что уже есть

- Кликабельная CRM-оболочка.
- Боковое меню как на скринах.
- Разделы: дашборд, справи, база клиентов, календарь, планер, рассылка, AI, финансы, аналитика.
- Демо-данные по клиентам, делам, событиям и финансам.
- Добавление клиента через форму.
- Добавление события в календарь через форму.
- Поиск по клиентам.
- Предпросмотр рассылки с переменной `{{client_name}}`.

## Главные документы

- `materials/README.md` — исходные материалы проекта: ТЗ и картинки.
- `docs/PROJECT_MAP.md` — карта папок проекта.
- `docs/MODULES.md` — описание модулей CRM.
- `docs/CLIENTS_MODULE.md` — описание раздела клиентов и будущей модели.
- `docs/CASES_MODULE.md` — описание раздела дел и будущей модели.
- `docs/ROADMAP.md` — общий план разработки.
- `docs/NEXT_STEPS.md` — ближайшие практические шаги.
- `backend/README.md` — запуск Django backend, API и импорт демо-данных.

## Куда двигаемся дальше

Django backend уже используется как основной рабочий слой:

- SQLite на старте;
- модели клиентов, дел, документов, задач, событий, финансов и рассылок;
- Django Admin для ручной проверки данных;
- API для клиентов, справ, задач, документов, календаря, финансов, пользователей и журнала действий;
- команда импорта текущих демо-данных из `frontend/data`.

Дальше нужно усилить:

- ограничения по ролям в интерфейсе;
- Telegram/SMS/Email-интеграции;
- AI-помощники по делам.
