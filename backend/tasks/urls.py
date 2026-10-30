# backend/tasks/urls.py

from django.urls import path
from .views import (
    TaskListCreateView, 
    TaskDetailView, 
    TaskActionView, 
    TaskAuditLogListView, 
    DailyCommitmentView, 
    SubmitTaskDelayReasonView,
    AuthorityReasonReviewView,
    SupervisorTeamOverviewView,
    AdminDepartmentsSummaryView,
    SubmitCommitmentNoActionReasonView,
    IdleMonitoringStatusView,
    TriggerManualMidnightSweepView,
)

urlpatterns = [
    path('', TaskListCreateView.as_view(), name='task_list_create'),
    path('<int:pk>/', TaskDetailView.as_view(), name='task_detail'),
    path('<int:pk>/action/', TaskActionView.as_view(), name='task_action'),
    path('<int:pk>/delay-report/', SubmitTaskDelayReasonView.as_view(), name='task-delay-report'),
    path('reason-reviews/', AuthorityReasonReviewView.as_view(), name='authority-reason-reviews'),
    path('reason-reviews/<int:pk>/action/', AuthorityReasonReviewView.as_view(), name='authority-reason-action'),
    path('audit-logs/', TaskAuditLogListView.as_view(), name='task-audit-logs'),
    path('daily-commitments/', DailyCommitmentView.as_view(), name='daily-commitments'),
    path('dashboard/team-overview/', SupervisorTeamOverviewView.as_view(), name='supervisor-team-overview'),
    path('dashboard/departments-summary/', AdminDepartmentsSummaryView.as_view(), name='admin-departments-summary'),
    path('<int:pk>/no-action-reason/', SubmitCommitmentNoActionReasonView.as_view(), name='task-no-action-reason'),
    path('idle-status/', IdleMonitoringStatusView.as_view(), name='task-idle-status'),
    path('run-midnight-sweep/', TriggerManualMidnightSweepView.as_view(), name='task-midnight-sweep'),
]