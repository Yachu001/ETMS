from django.urls import path
from .views import (
    TaskListCreateView, 
    TaskDetailView, 
    TaskActionView, 
    TaskAuditLogListView, 
    DailyCommitmentView, 
    TaskDelayReportView,
    SupervisorTeamOverviewView,
    AdminDepartmentsSummaryView,
)

urlpatterns = [
    path('', TaskListCreateView.as_view(), name='task_list_create'),
    path('<int:pk>/', TaskDetailView.as_view(), name='task_detail'),
    path('<int:pk>/action/', TaskActionView.as_view(), name='task_action'),
    path('audit-logs/', TaskAuditLogListView.as_view(), name='task-audit-logs'),
    path('daily-commitments/', DailyCommitmentView.as_view(), name='daily-commitments'),
    path('<int:pk>/delay-report/', TaskDelayReportView.as_view(), name='task-delay-report'),
    path('dashboard/team-overview/', SupervisorTeamOverviewView.as_view(), name='supervisor-team-overview'),
    path('dashboard/departments-summary/', AdminDepartmentsSummaryView.as_view(), name='admin-departments-summary'),
]