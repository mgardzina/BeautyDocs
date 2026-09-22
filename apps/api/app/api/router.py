from fastapi import APIRouter

from app.api.routes.account_mfa import router as account_mfa_router
from app.api.routes.admin_clients import router as admin_clients_router
from app.api.routes.admin_forms import router as admin_forms_router
from app.api.routes.admin_notifications import router as admin_notifications_router
from app.api.routes.admin_team import router as admin_team_router
from app.api.routes.admin_tenant import router as admin_tenant_router
from app.api.routes.admin_visits import router as admin_visits_router
from app.api.routes.auth import router as auth_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.chat import router as chat_router
from app.api.routes.consumer import router as consumer_router
from app.api.routes.consumer_mfa import router as consumer_mfa_router
from app.api.routes.context import router as context_router
from app.api.routes.public_submissions import router as public_submissions_router
from app.api.routes.public_tenant import router as public_tenant_router
from app.api.routes.registration import router as registration_router
from app.api.routes.salon_directory import router as salon_directory_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(registration_router)
api_router.include_router(admin_tenant_router)
api_router.include_router(admin_team_router)
api_router.include_router(admin_clients_router)
api_router.include_router(admin_forms_router)
api_router.include_router(admin_notifications_router)
api_router.include_router(admin_visits_router)
api_router.include_router(account_mfa_router)
api_router.include_router(context_router)
api_router.include_router(chat_router)
api_router.include_router(catalog_router)
api_router.include_router(consumer_router)
api_router.include_router(consumer_mfa_router)
api_router.include_router(public_tenant_router)
api_router.include_router(public_submissions_router)


api_router.include_router(salon_directory_router)
