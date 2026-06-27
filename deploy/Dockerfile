# Production image for the Advocates CRM (Django + gunicorn serves API + frontend).
# Build context is the repository root (see deploy/docker-compose.yml).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN chmod +x deploy/entrypoint.sh

EXPOSE 8001
CMD ["/app/deploy/entrypoint.sh"]
