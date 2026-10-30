# backend/notifications/views.py

from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """
    Returns user notifications sorted by newest first.
    Supports filtering by ?is_read=false or ?type=TASK_ASSIGNED.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(recipient=user).select_related('sender', 'task')

        is_read_param = self.request.query_params.get('is_read')
        if is_read_param is not None:
            if is_read_param.lower() in ['true', '1']:
                qs = qs.filter(is_read=True)
            elif is_read_param.lower() in ['false', '0']:
                qs = qs.filter(is_read=False)

        type_param = self.request.query_params.get('type')
        if type_param:
            qs = qs.filter(notification_type=type_param)

        return qs[:100]  # Limit to 100 most recent


class MarkNotificationReadView(APIView):
    """
    Marks a single notification as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'success', 'id': notification.id, 'is_read': True})


class MarkAllNotificationsReadView(APIView):
    """
    Marks all notifications for the current user as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(
            recipient=request.user, 
            is_read=False
        ).update(is_read=True)
        return Response({'status': 'success', 'marked_read_count': updated_count})


class UnreadNotificationCountView(APIView):
    """
    Lightweight endpoint polled by the top navigation bar bell icon.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unread_count = Notification.objects.filter(
            recipient=request.user, 
            is_read=False
        ).count()
        return Response({'unread_count': unread_count})