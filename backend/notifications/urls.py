# backend/notifications/urls.py

from django.urls import path
from .views import (
    NotificationListView,
    MarkNotificationReadView,
    MarkAllNotificationsReadView,
    UnreadNotificationCountView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', UnreadNotificationCountView.as_view(), name='notification-unread-count'),
    path('mark-all-read/', MarkAllNotificationsReadView.as_view(), name='notification-mark-all-read'),
    path('<int:pk>/read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
]