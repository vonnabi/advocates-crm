"""Pre-production security middleware (Sprint 5).

Both behaviours are OFF by default so the demo (anonymous = admin, permissive CORS)
keeps working. Enable for real deployments via env:
  CRM_REQUIRE_AUTH=true            — reject anonymous /api/ requests with 401
  CRM_ALLOWED_ORIGINS=https://app  — restrict CORS to a comma-separated allow-list
"""
from django.conf import settings
from django.http import JsonResponse

# Endpoints that must stay reachable without a session even in secured mode.
OPEN_API_PREFIXES = ("/api/session", "/api/login", "/api/logout")


class RequireApiAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (getattr(settings, "CRM_REQUIRE_AUTH", False)
                and request.path.startswith("/api/")
                and request.method != "OPTIONS"
                and not request.user.is_authenticated
                and not request.path.startswith(OPEN_API_PREFIXES)
                # ONLYOFFICE document-server webhook is server-to-server (no session);
                # it is guarded separately by the SSRF check + document id.
                and "/onlyoffice-callback/" not in request.path):
            return JsonResponse({"error": "Unauthorized", "message": "Потрібен вхід у систему."}, status=401)
        return self.get_response(request)


class ApiCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not request.path.startswith("/api/"):
            return response
        origin = request.headers.get("Origin")
        allowed = getattr(settings, "CRM_ALLOWED_ORIGINS", []) or []
        if allowed:
            # Secured: only configured origins may use credentials.
            if origin in allowed:
                response["Access-Control-Allow-Origin"] = origin
                response["Access-Control-Allow-Credentials"] = "true"
                response["Vary"] = "Origin"
        elif origin:
            # Demo default: reflect the caller's origin (never the invalid "*" + credentials combo).
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Vary"] = "Origin"
        else:
            response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        return response
