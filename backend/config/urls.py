from django.contrib import admin
from django.conf import settings
from django.http import JsonResponse
from django.urls import path, re_path
from django.views.static import serve

from .api import bootstrap_api, case_detail_api, cases_api, client_communication_detail_api, client_communications_api, client_detail_api, clients_api, demo_data_api, document_detail_api, documents_api, event_detail_api, events_api, finance_operation_detail_api, finance_operations_api, finance_summary_api, login_api, logout_api, session_api, task_detail_api, tasks_api, user_detail_api, users_api


FRONTEND_ROOT = settings.BASE_DIR.parent / "frontend"


def healthcheck(_request):
    return JsonResponse({"status": "ok", "service": "advocates-bureau-crm"})


def frontend_index(request):
    return serve(request, "index.html", document_root=FRONTEND_ROOT)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", healthcheck),
    path("api/session/", session_api),
    path("api/auth/login/", login_api),
    path("api/auth/logout/", logout_api),
    path("api/bootstrap/", bootstrap_api),
    path("api/demo-data/", demo_data_api),
    path("api/users/", users_api),
    path("api/users/<int:user_id>/", user_detail_api),
    path("api/clients/", clients_api),
    path("api/clients/<int:client_id>/", client_detail_api),
    path("api/clients/<int:client_id>/communications/", client_communications_api),
    path("api/client-communications/<int:communication_id>/", client_communication_detail_api),
    path("api/cases/", cases_api),
    re_path(r"^api/cases/(?P<case_number>.+)/$", case_detail_api),
    path("api/tasks/", tasks_api),
    path("api/tasks/<int:task_id>/", task_detail_api),
    path("api/documents/", documents_api),
    path("api/documents/<int:document_id>/", document_detail_api),
    path("api/calendar/events/", events_api),
    path("api/calendar/events/<int:event_id>/", event_detail_api),
    path("api/finance/operations/", finance_operations_api),
    path("api/finance/operations/<str:operation_id>/", finance_operation_detail_api),
    path("api/finance/summary/", finance_summary_api),
    path("", frontend_index),
    re_path(r"^(?P<path>(?:app\.js|styles\.css|js/.*|assets/.*|data/.*))$", serve, {"document_root": FRONTEND_ROOT}),
]
