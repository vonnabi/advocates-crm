from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderResult:
    ok: bool
    status: str
    error: str = ""
    provider: str = "mock"


class MockMessagingProvider:
    provider = "mock"

    def __init__(self, integrations=None, integration_settings=None):
        self.integrations = integrations or {}
        self.integration_settings = integration_settings or {}

    def send(self, delivery):
        channel = delivery.channel
        if not self.integrations.get(channel, True):
            return ProviderResult(False, "error", f"Інтеграцію {channel} вимкнено.", self.provider)
        setup_error = channel_setup_error(channel, self.integration_settings)
        if setup_error:
            return ProviderResult(False, "error", setup_error, self.provider)

        client = delivery.client
        if channel == "Telegram" and not (client.telegram_connected or client.telegram_username or client.telegram_chat_id):
            return ProviderResult(False, "error", "Немає Telegram контакту.", self.provider)
        if channel == "SMS" and not client.phone:
            return ProviderResult(False, "error", "Немає номера телефону.", self.provider)
        if channel == "Email" and not client.email:
            return ProviderResult(False, "error", "Немає email адреси.", self.provider)
        return ProviderResult(True, "sent", "", self.provider)


REQUIRED_CHANNEL_FIELDS = {
    "Telegram": (("botToken", "Bot token"), ("chatId", "Тестовий chat ID")),
    "SMS": (("provider", "Провайдер"), ("sender", "Відправник"), ("apiKey", "API key")),
    "Email": (("senderEmail", "Email відправника"), ("smtpHost", "SMTP host"), ("smtpPort", "SMTP port")),
}


def missing_channel_fields(channel, integration_settings=None):
    values = (integration_settings or {}).get(channel) or {}
    return [
        label
        for key, label in REQUIRED_CHANNEL_FIELDS.get(channel, ())
        if not str(values.get(key) or "").strip()
    ]


def channel_setup_error(channel, integration_settings=None):
    missing = missing_channel_fields(channel, integration_settings)
    if not missing:
        return ""
    return f"Заповніть параметри підключення: {', '.join(missing)}."


def send_delivery_with_provider(delivery, integrations=None, integration_settings=None):
    return MockMessagingProvider(integrations, integration_settings).send(delivery)


def provider_status_payload(integrations=None, integration_settings=None):
    integrations = integrations or {}
    integration_settings = integration_settings or {}
    rows = []
    for channel in ("Telegram", "SMS", "Email"):
        enabled = integrations.get(channel, True)
        setup_error = channel_setup_error(channel, integration_settings) if enabled else ""
        status = "ready" if enabled and not setup_error else "setup" if enabled else "disabled"
        rows.append({
            "channel": channel,
            "provider": MockMessagingProvider.provider,
            "enabled": enabled,
            "status": status,
            "label": "Готово" if status == "ready" else "Налаштувати" if status == "setup" else "Вимкнено",
            "detail": "Mock-провайдер приймає тестові відправки." if status == "ready" else setup_error or f"Інтеграцію {channel} вимкнено в налаштуваннях.",
        })
    return rows


def test_provider_channel(channel, integrations=None, integration_settings=None):
    integrations = integrations or {}
    if channel not in {"Telegram", "SMS", "Email"}:
        return ProviderResult(False, "error", "Невідомий канал.", MockMessagingProvider.provider)
    if not integrations.get(channel, True):
        return ProviderResult(False, "error", f"Інтеграцію {channel} вимкнено.", MockMessagingProvider.provider)
    setup_error = channel_setup_error(channel, integration_settings)
    if setup_error:
        return ProviderResult(False, "error", setup_error, MockMessagingProvider.provider)
    return ProviderResult(True, "sent", "Тестова mock-відправка успішна.", MockMessagingProvider.provider)
