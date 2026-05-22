# Backend

Django backend для Advocates Bureau CRM. Сейчас это первый рабочий слой: модели, миграции, Django Admin, импорт демо-данных, read API для всех базовых экранов и write API для пользователей/ролей, клиентов, коммуникаций клиента, справ, задач, документов, событий календаря, финансовых операций, настроек и рассылок.

## Запуск

Из корня проекта:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run serve
```

Backend и frontend будут доступны на `http://127.0.0.1:8001/`. Когда интерфейс открыт с этого адреса, он автоматически берет стартовые данные из `/api/bootstrap/`.

`8001` — основной локальный адрес проекта. Отдельный frontend-сервер для ежедневной работы не нужен.

## Проверка

```bash
cd backend
../.venv/bin/python manage.py check
../.venv/bin/python manage.py seed_demo --clear
```

После сидинга ожидаемые демо-данные: 4 клиента, 4 справы, 9 задач, 6 событий.

## Деплой на Render

В корне проекта есть `render.yaml` и `scripts/render-build.sh`. Render поднимает Django web service и PostgreSQL базу из GitHub:

- `buildCommand`: установка зависимостей и `collectstatic`;
- `startCommand`: `scripts/render-start.sh`;
- `render-start.sh`: применяет миграции, импортирует демо-данные только если база пустая, затем запускает Gunicorn для `config.wsgi:application`.

Для локальной проверки production-настроек:

```bash
SECRET_KEY=local-check-secret-key-with-more-than-fifty-characters-123456 DJANGO_DEBUG=false DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost DJANGO_SECURE_SSL_REDIRECT=true ../.venv/bin/python manage.py check --deploy
```

Демо-вход после первого seed:

```text
ivanenko@advocates.crm
demo12345
```

## API

- `GET /api/health/` — проверка сервиса.
- `GET /api/session/` — текущий демо-пользователь и базовые права доступа.
- `POST /api/auth/login/` — вход по email/username и паролю, создание Django-сессии.
- `POST /api/auth/logout/` — завершение Django-сессии и возврат в демо-режим.
- `GET /api/bootstrap/` — полный стартовый набор данных для frontend.
- `GET /api/users/` — пользователи бюро и роли.
- `POST /api/users/` — создать пользователя/приглашение.
- `GET /api/users/<id>/` — открыть пользователя.
- `PUT /api/users/<id>/` — обновить роль и уровень доступа.
- `DELETE /api/users/<id>/` — деактивировать пользователя.
- `GET /api/clients/` — клиенты.
- `POST /api/clients/` — создать клиента.
- `GET /api/clients/<id>/` — открыть клиента.
- `PUT /api/clients/<id>/` — обновить клиента.
- `DELETE /api/clients/<id>/` — удалить клиента вместе со связанными демо-справами, задачами и событиями.
- `GET /api/clients/<id>/communications/` — коммуникации клиента.
- `POST /api/clients/<id>/communications/` — зафиксировать звонок, Telegram/SMS/email или CRM-контакт клиента.
- `GET /api/client-communications/<id>/` — открыть коммуникацию клиента.
- `PUT /api/client-communications/<id>/` — обновить коммуникацию клиента.
- `DELETE /api/client-communications/<id>/` — удалить коммуникацию клиента.
- `GET /api/cases/` — справы с документами и задачами.
- `POST /api/cases/` — создать справу.
- `GET /api/cases/<number>/` — открыть справу.
- `PUT /api/cases/<number>/` — обновить справу.
- `DELETE /api/cases/<number>/` — удалить справу вместе с дочерними демо-задачами, документами и событиями.
- `GET /api/tasks/` — задачи.
- `POST /api/tasks/` — создать задачу.
- `GET /api/tasks/<id>/` — открыть задачу.
- `PUT /api/tasks/<id>/` — обновить задачу, подзадачи, планер и напоминания.
- `DELETE /api/tasks/<id>/` — удалить задачу.
- `GET /api/documents/` — документы по всем справам.
- `POST /api/documents/` — создать документ.
- `GET /api/documents/<id>/` — открыть документ.
- `PUT /api/documents/<id>/` — обновить статус, сроки, папку, ссылку и комментарий документа.
- `DELETE /api/documents/<id>/` — удалить документ.
- `GET /api/calendar/events/` — события календаря.
- `POST /api/calendar/events/` — создать событие календаря.
- `GET /api/calendar/events/<id>/` — открыть событие календаря.
- `PUT /api/calendar/events/<id>/` — обновить время, статус, напоминания и описание события.
- `DELETE /api/calendar/events/<id>/` — удалить событие календаря.
- `GET /api/finance/operations/` — финансовые операции: платежи, расходы, счета и акты.
- `POST /api/finance/operations/` — создать финансовую операцию и связать ее со справой.
- `DELETE /api/finance/operations/<id>/` — удалить финансовую операцию.
- `GET /api/finance/summary/` — финансовая сводка по справам.
- `GET /api/mailings/` — шаблоны и кампании рассылок.
- `GET /api/mailings/templates/` — шаблоны сообщений.
- `POST /api/mailings/templates/` — создать шаблон сообщения.
- `PUT /api/mailings/templates/<id>/` — обновить шаблон сообщения.
- `DELETE /api/mailings/templates/<id>/` — удалить шаблон сообщения.
- `GET /api/mailings/campaigns/` — кампании рассылок.
- `POST /api/mailings/campaigns/` — создать тестовую или запланированную кампанию.
- `POST /api/mailings/campaigns/<id>/send/` — запустить mock-отправку очереди доставок с учетом включенных интеграций Telegram/SMS/Email.
- `PUT /api/mailings/campaigns/<id>/` — обновить кампанию.
- `DELETE /api/mailings/campaigns/<id>/` — удалить кампанию.
- `GET /api/mailings/deliveries/<id>/` — открыть доставку кампании и обновлённую карточку кампании.
- `PUT /api/mailings/deliveries/<id>/` — изменить статус доставки: `queued`, `sent`, `delivered` или `error`.
- `GET /api/mailings/automation-rules/` — правила автоматизации рассылок.
- `POST /api/mailings/automation-rules/` — создать правило автоматизации.
- `PUT /api/mailings/automation-rules/<id>/` — обновить канал или статус правила автоматизации.
- `DELETE /api/mailings/automation-rules/<id>/` — удалить правило автоматизации.
- `GET /api/settings/` — текущие настройки бюро, интеграций, параметров подключения и уведомлений.
- `PUT /api/settings/` — сохранить настройки бюро, интеграций, параметров подключения и уведомлений.
- `GET /api/settings/provider-status/` — статусы mock-провайдера для Telegram/SMS/Email.
- `POST /api/settings/provider-status/` — тестовая проверка канала интеграции: тело `{ "channel": "Telegram" }`.
- `GET /api/audit-logs/` — журнал действий CRM.
- `DELETE /api/audit-logs/` — очистить журнал действий CRM.

## Что дальше

- Довести рассылки до реального провайдера отправки Telegram/SMS/Email.
- Перенести AI-помощников, OSINT и аналитику на backend-модели.
