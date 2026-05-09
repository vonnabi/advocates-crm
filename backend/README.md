Принесёшь дома# Backend

Здесь будет Django backend.

Пока backend не создан, потому что текущий этап — быстрый UI-прототип. После согласования экранов здесь появится Django-проект.

## Планируемая структура Django

```text
backend/
  manage.py
  config/
    settings.py
    urls.py
    wsgi.py
    asgi.py
  apps/
    accounts/
    clients/
    cases/
    calendar_app/
    tasks/
    finance/
    communications/
    documents/
    analytics/
    ai_assistants/
```

## Почему Django

Django хорошо подходит для этой CRM, потому что из коробки дает:

- пользователей;
- админку;
- ORM для базы данных;
- миграции;
- права доступа;
- формы;
- безопасность;
- быстрый старт backend-части.

