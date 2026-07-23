from django.contrib import admin
from django.conf import settings
from django.http import JsonResponse
from django.urls import path, re_path
from django.views.static import serve

from .api import ai_assistant_detail_api, ai_assistants_api, ai_chat_api, ai_chat_stream_api, ai_document_review_api, ai_usage_api, ai_export_docx_api, ai_save_draft_api, ai_document_index_api, ai_document_text_api, ai_docx_from_text_api, ai_knowledge_api, ai_knowledge_detail_api, ai_skill_detail_api, ai_skill_questions_api, ai_skills_api, audit_logs_api, bootstrap_api, case_detail_api, cases_api, change_password_api, client_communication_detail_api, client_communications_api, client_detail_api, clients_api, demo_data_api, document_detail_api, document_file_api, document_onlyoffice_callback_api, document_onlyoffice_config_api, documents_api, document_archive_folders_api, document_templates_api, document_template_detail_api, document_assemble_api, document_template_from_ai_api, event_detail_api, events_api, finance_operation_detail_api, finance_operations_api, finance_summary_api, salaries_api, salary_detail_api, login_api, logout_api, mailing_automation_rule_detail_api, mailing_automation_rules_api, mailing_campaign_detail_api, mailing_campaign_send_api, mailing_campaigns_api, mailing_delivery_detail_api, mailing_template_detail_api, mailing_templates_api, mailings_api, profile_api, session_api, settings_api, settings_provider_status_api, task_detail_api, tasks_api, user_detail_api, users_api


FRONTEND_ROOT = settings.BASE_DIR.parent / "frontend"


def healthcheck(_request):
    return JsonResponse({"status": "ok", "service": "advocates-bureau-crm"})


def frontend_index(request):
    return frontend_file(request, "index.html")


def frontend_file(request, path):
    response = serve(request, path, document_root=FRONTEND_ROOT)
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", healthcheck),
    path("api/session/", session_api),
    path("api/auth/login/", login_api),
    path("api/auth/logout/", logout_api),
    path("api/auth/change-password/", change_password_api),
    path("api/profile/", profile_api),
    path("api/bootstrap/", bootstrap_api),
    path("api/settings/", settings_api),
    path("api/settings/provider-status/", settings_provider_status_api),
    path("api/demo-data/", demo_data_api),
    path("api/audit-logs/", audit_logs_api),
    path("api/users/", users_api),
    path("api/users/<int:user_id>/", user_detail_api),
    path("api/clients/", clients_api),
    path("api/clients/<int:client_id>/", client_detail_api),
    path("api/clients/<int:client_id>/communications/", client_communications_api),
    path("api/client-communications/<int:communication_id>/", client_communication_detail_api),
    path("api/cases/", cases_api),
    path("api/ai/chat/", ai_chat_api),
    path("api/ai/chat/stream/", ai_chat_stream_api),
    path("api/ai/skills/", ai_skills_api),
    path("api/ai/skills/<str:area_key>/questions/", ai_skill_questions_api),
    path("api/ai/skills/<str:area_key>/", ai_skill_detail_api),
    path("api/ai/knowledge/", ai_knowledge_api),
    path("api/ai/knowledge/<int:doc_id>/", ai_knowledge_detail_api),
    path("api/ai/export/docx/", ai_export_docx_api),
    path("api/ai/documents/draft/", ai_save_draft_api),
    path("api/ai/documents/docx/", ai_docx_from_text_api),
    path("api/ai/documents/index/", ai_document_index_api),
    path("api/ai/documents/<int:document_id>/text/", ai_document_text_api),
    path("api/ai/assistants/", ai_assistants_api),
    path("api/ai/assistants/<path:case_number>/", ai_assistant_detail_api),
    path("api/ai/usage/", ai_usage_api),
    re_path(r"^api/cases/(?P<case_number>.+)/$", case_detail_api),
    path("api/tasks/", tasks_api),
    path("api/tasks/<int:task_id>/", task_detail_api),
    path("api/documents/", documents_api),
    path("api/documents/templates/", document_templates_api),
    path("api/documents/templates/from-document/", document_template_from_ai_api),
    path("api/documents/templates/<int:document_id>/", document_template_detail_api),
    path("api/documents/assemble/", document_assemble_api),
    path("api/documents/<int:document_id>/", document_detail_api),
    path("api/documents/<int:document_id>/file/", document_file_api, name="document_file"),
    path("api/documents/<int:document_id>/ai-review/", ai_document_review_api),
    path("api/documents/<int:document_id>/onlyoffice/config/", document_onlyoffice_config_api, name="document_onlyoffice_config"),
    path("api/documents/<int:document_id>/onlyoffice/callback/", document_onlyoffice_callback_api, name="document_onlyoffice_callback"),
    path("api/calendar/events/", events_api),
    path("api/calendar/events/<int:event_id>/", event_detail_api),
    path("api/finance/operations/", finance_operations_api),
    path("api/finance/operations/<str:operation_id>/", finance_operation_detail_api),
    path("api/finance/summary/", finance_summary_api),
    path("api/finance/salaries/", salaries_api),
    path("api/finance/salaries/<str:salary_id>/", salary_detail_api),
    path("api/documents/archive-folders/", document_archive_folders_api),
    path("api/mailings/", mailings_api),
    path("api/mailings/templates/", mailing_templates_api),
    path("api/mailings/templates/<int:template_id>/", mailing_template_detail_api),
    path("api/mailings/campaigns/", mailing_campaigns_api),
    path("api/mailings/campaigns/<int:campaign_id>/send/", mailing_campaign_send_api),
    path("api/mailings/campaigns/<int:campaign_id>/", mailing_campaign_detail_api),
    path("api/mailings/deliveries/<int:delivery_id>/", mailing_delivery_detail_api),
    path("api/mailings/automation-rules/", mailing_automation_rules_api),
    path("api/mailings/automation-rules/<int:rule_id>/", mailing_automation_rule_detail_api),
    path("", frontend_index),
    re_path(r"^(?P<path>(?:app\.js|styles\.css|design-tokens\.css|js/.*|assets/.*|data/.*))$", frontend_file),
]
