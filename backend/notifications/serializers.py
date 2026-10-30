# backend/notifications/serializers.py

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'title',
            'message',
            'data',
            'is_read',
            'created_at',
            'sender',
            'sender_name',
            'task',
        ]

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.full_name or obj.sender.username
        return "System"