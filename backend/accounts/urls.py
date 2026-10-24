from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserCreateView,
    BusinessViewSet,
    DepartmentListCreateView,
    DepartmentManagementView,
    AssignUserDepartmentView,
    EmployeeManagementViewSet,
    UserCockpitDetailView,
    DailyAttendanceToggleView,
    RequestPasswordResetOTPView,
    ResetPasswordWithOTPView,
    MySubordinatesListView,
    OrgHierarchyTreeView,
    AssignReportingView,
)

router = DefaultRouter()
router.register(r'employees/manage', EmployeeManagementViewSet, basename='employee_manage')
router.register(r'businesses', BusinessViewSet, basename='businesses')

urlpatterns = [
    # Auth & Tokens
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # User Profile & Provisioning
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserCreateView.as_view(), name='user_create'),

    # Entity Management
    path('departments/', DepartmentListCreateView.as_view(), name='department_list_create'),
    path('departments/manage/', DepartmentManagementView.as_view(), name='department-manage'),
    path('departments/assign/', AssignUserDepartmentView.as_view(), name='department-assign-user'),

    # User Cockpit Detail
    path('user-detail/<int:user_id>/', UserCockpitDetailView.as_view(), name='user-cockpit-detail'),

    # Attendance & Routine
    path('attendance/today/', DailyAttendanceToggleView.as_view(), name='daily-attendance-today'),

    # Password Recovery
    path('password-reset/otp/', RequestPasswordResetOTPView.as_view(), name='request_otp'),
    path('password-reset/verify/', ResetPasswordWithOTPView.as_view(), name='verify_otp'),

    # Organization Hierarchy
    path('org/my-subordinates/', MySubordinatesListView.as_view(), name='my-subordinates'),
    path('org/tree/', OrgHierarchyTreeView.as_view(), name='org-tree'),
    path('org/assign-reporting/', AssignReportingView.as_view(), name='assign-reporting'),

    # ViewSet Router endpoints
    path('', include(router.urls)),
]