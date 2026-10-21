from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserCreateView,
    DepartmentListCreateView,
    RequestPasswordResetOTPView,
    ResetPasswordWithOTPView,
    MySubordinatesListView,
    OrgHierarchyTreeView,
    AssignReportingView,
)

urlpatterns = [
    # Auth & Tokens
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # User Profile & Down-tree User Creation
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserCreateView.as_view(), name='user_create'),
    path('departments/', DepartmentListCreateView.as_view(), name='department_list_create'),

    # Recovery
    path('password-reset/otp/', RequestPasswordResetOTPView.as_view(), name='request_otp'),
    path('password-reset/verify/', ResetPasswordWithOTPView.as_view(), name='verify_otp'),

    # Reporting & Hierarchy
    path('org/my-subordinates/', MySubordinatesListView.as_view(), name='my-subordinates'),
    path('org/tree/', OrgHierarchyTreeView.as_view(), name='org-tree'),
    path('org/assign-reporting/', AssignReportingView.as_view(), name='assign-reporting'),
]