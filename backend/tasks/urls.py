# backend/tasks/urls.py

from django.urls import path
from .views import (
    TaskListCreateView, 
    TaskDetailView, 
    TaskActionView, 
    TaskAuditLogListView, 
    AuditLogMetaView,
    DailyCommitmentView, 
    SubmitTaskDelayReasonView,
    AuthorityReasonReviewView,
    SupervisorTeamOverviewView,
    TeamIdleRosterView,
    TeamOverdueTasksView,
    AdminDepartmentsSummaryView,
    SubmitCommitmentNoActionReasonView,
    IdleMonitoringStatusView,
    TriggerManualMidnightSweepView,
    MatrixOverviewView,
    AdminRootTablesSummaryView,   
)

urlpatterns = [
    # Core Task CRUD & State Actions
    path('', TaskListCreateView.as_view(), name='task_list_create'),
    path('<int:pk>/', TaskDetailView.as_view(), name='task_detail'),
    path('<int:pk>/action/', TaskActionView.as_view(), name='task_action'),
    path('<int:pk>/delay-report/', SubmitTaskDelayReasonView.as_view(), name='task-delay-report'),
    path('<int:pk>/no-action-reason/', SubmitCommitmentNoActionReasonView.as_view(), name='task-no-action-reason'),

    # Reason Review & Managerial Resolution (Reschedule / Cancel)
    path('reason-reviews/', AuthorityReasonReviewView.as_view(), name='authority-reason-reviews'),
    path('reason-reviews/<int:pk>/action/', AuthorityReasonReviewView.as_view(), name='authority-reason-action'),

    # Audit Logs & Dynamic Boundary Metadata
    path('audit-logs/', TaskAuditLogListView.as_view(), name='task-audit-logs'),
    path('audit-logs/meta/', AuditLogMetaView.as_view(), name='task-audit-logs-meta'),

    # Daily Commitments & Work Planner
    path('daily-commitments/', DailyCommitmentView.as_view(), name='daily-commitments'),

    # Dashboard & Team Hubs
    path('dashboard/team-overview/', SupervisorTeamOverviewView.as_view(), name='supervisor-team-overview'),
    path('dashboard/idle-roster/', TeamIdleRosterView.as_view(), name='team-idle-roster'),
    path('dashboard/team-overdue-tasks/', TeamOverdueTasksView.as_view(), name='team-overdue-tasks'),
    path('dashboard/departments-summary/', AdminDepartmentsSummaryView.as_view(), name='admin-departments-summary'),
    path('dashboard/admin-root-tables/', AdminRootTablesSummaryView.as_view(), name='admin-root-tables'),

    # Real-Time Monitoring & Sweeps
    path('idle-status/', IdleMonitoringStatusView.as_view(), name='task-idle-status'),
    path('run-midnight-sweep/', TriggerManualMidnightSweepView.as_view(), name='task-midnight-sweep'),
    path('matrix-overview/', MatrixOverviewView.as_view(), name='task-matrix-overview'),
]