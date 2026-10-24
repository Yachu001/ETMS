from django.contrib import admin
from .models import Task, DailyWorkSelection, TaskActivityLog


class TaskActivityLogInline(admin.TabularInline):
    model = TaskActivityLog
    extra = 0
    readonly_fields = ('actor', 'old_status', 'new_status', 'old_progress', 'new_progress', 'remarks', 'timestamp')
    can_delete = False


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'assigned_to', 'created_by', 'priority', 'status', 'progress_percentage', 'due_date', 'is_disabled')
    list_filter = ('status', 'priority', 'is_disabled', 'due_date')
    search_fields = ('title', 'description', 'assigned_to__username', 'created_by__username')
    inlines = [TaskActivityLogInline]


@admin.register(DailyWorkSelection)
class DailyWorkSelectionAdmin(admin.ModelAdmin):
    list_display = ('user', 'task', 'date', 'has_status_changed_today', 'is_overdue')
    list_filter = ('date', 'has_status_changed_today', 'is_overdue')


@admin.register(TaskActivityLog)
class TaskActivityLogAdmin(admin.ModelAdmin):
    list_display = ('task', 'actor', 'old_status', 'new_status', 'old_progress', 'new_progress', 'timestamp')
    readonly_fields = ('task', 'actor', 'old_status', 'new_status', 'old_progress', 'new_progress', 'remarks', 'timestamp')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False