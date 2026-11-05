# backend/accounts/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserCreateView,
    BusinessViewSet,
    DepartmentViewSet,
    BusinessDepartmentViewSet,
    EmployeeManagementViewSet,
    UserCockpitDetailView,
    DailyAttendanceToggleView,
    RequestPasswordResetOTPView,
    ResetPasswordWithOTPView,
    MySubordinatesListView,
    OrgHierarchyTreeView,
    SystemAuditLogListView,
    SystemAuditLogMetaView,  # <--- Added import
)
from .serializers import CustomTokenRefreshSerializer


class CustomTokenRefreshView(TokenRefreshView):
    """
    Prevents 500 server crashes when stale tokens are refreshed after user/database changes.
    """
    serializer_class = CustomTokenRefreshSerializer


router = DefaultRouter()
router.register(r'businesses', BusinessViewSet, basename='businesses')
router.register(r'departments', DepartmentViewSet, basename='departments')
router.register(r'departments/matrix', DepartmentViewSet, basename='departments_matrix')
router.register(r'business-departments', BusinessDepartmentViewSet, basename='business_departments')
router.register(r'employees/manage', EmployeeManagementViewSet, basename='employee_manage')

urlpatterns = [
    # Auth & Tokens
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),

    # Profile & Users
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserCreateView.as_view(), name='user_create'),

    # Attendance
    path('attendance/today/', DailyAttendanceToggleView.as_view(), name='daily-attendance-today'),

    # User Cockpit Detail (Task Inspector)
    path('user-detail/<int:user_id>/', UserCockpitDetailView.as_view(), name='user-cockpit-detail'),

    # Password Recovery
    path('password-reset/otp/', RequestPasswordResetOTPView.as_view(), name='request_otp'),
    path('password-reset/verify/', ResetPasswordWithOTPView.as_view(), name='verify_otp'),

    # Org Tree & Reporting Hierarchy
    path('org/my-subordinates/', MySubordinatesListView.as_view(), name='my-subordinates'),
    path('org/tree/', OrgHierarchyTreeView.as_view(), name='org-tree'),

    # Audit Logs & Dynamic Days Metadata
    path('audit-logs/', SystemAuditLogListView.as_view(), name='system-audit-logs'),
    path('audit-logs/meta/', SystemAuditLogMetaView.as_view(), name='system-audit-logs-meta'),  # <--- Added route

    # Router Endpoints
    path('', include(router.urls)),
]