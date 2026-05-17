# Backend

Django backend для Advocates Bureau CRM. Сейчас это первый рабочий слой: модели, миграции, Django Admin, импорт демо-данных, read API для всех базовых экранов и write API для пользователей/ролей, клиентов, коммуникаций клиента, справ, задач, документов, событий календаря и финансовых операций.

## Запуск

Из корня проекта:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py seed_demo --clear
../.venv/bin/python manage.py runserver 127.0.0.1:8001
```

Backend и frontend будут доступны на `http://127.0.0.1:8001/`. Когда интерфейс открыт с этого адреса, он автоматически берет стартовые данные из `/api/bootstrap/`.

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
- `preDeployCommand`: `python manage.py migrate`;
- `initialDeployHook`: `python manage.py seed_demo`;
- `startCommand`: Gunicorn для `config.wsgi:application`.

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

Если frontend открыт отдельно через `npm run serve` на `http://127.0.0.1:8000/`, можно вручную включить API-режим в консоли браузера:

```js
localStorage.setItem("crmApiBase", "http://127.0.0.1:8001");
location.reload();
```

Чтобы вернуться к JSON-демо-данным:

```js
localStorage.removeItem("crmApiBase");
location.reload();
```

## Что дальше

- Закрыть write API по ролям и добавить ограничения в интерфейсе для помощника/бухгалтера/адвоката.
- Перенести рассылки, AI-помощников, OSINT и аналитику на backend-модели.
