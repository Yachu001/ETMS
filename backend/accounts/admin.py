from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.contrib.auth import get_user_model
from .models import Business, Department, BusinessDepartment, AttendanceRecord, PasswordResetOTP, SystemAuditLog

User = get_user_model()


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'full_name', 'role', 'designation', 'matrix')


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'is_active', 'created_at')
    search_fields = ('name',)
    list_filter = ('is_active', 'parent')


@admin.register(BusinessDepartment)
class BusinessDepartmentAdmin(admin.ModelAdmin):
    list_display = ('business', 'department', 'supervisor', 'is_active', 'created_at')
    list_filter = ('business', 'department', 'is_active')
    search_fields = ('business__name', 'business__code', 'department__name', 'supervisor__username', 'supervisor__full_name')


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

    fieldsets = UserAdmin.fieldsets + (
        ('Employee Profile Details', {
            'fields': (
                'full_name', 'employee_code', 'phone', 'role', 'designation',
                'date_of_joining', 'matrix', 'business', 'department', 'reports_to'
            )
        }),
        ('Shift & Duty Boundaries', {
            'fields': ('shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time')
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username', 'email', 'full_name', 'role', 'designation',
                'matrix', 'password1', 'password2'
            ),
        }),
    )

    list_display = (
        'username', 'full_name', 'email', 'role', 'designation',
        'matrix', 'business', 'department', 'reports_to', 'is_active'
    )
    list_filter = ('role', 'is_active', 'matrix', 'business', 'department')
    search_fields = ('username', 'full_name', 'email', 'employee_code', 'designation')
    ordering = ('username',)


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'is_present', 'marked_at')
    list_filter = ('is_present', 'date')


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp_code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used',)

@admin.register(SystemAuditLog)
class SystemAuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'module', 'action_type', 'actor', 'target_user', 'entity_name')
    list_filter = ('module', 'action_type', 'timestamp')
    search_fields = ('action_type', 'remarks', 'actor__username', 'target_user__username', 'entity_name')
    readonly_fields = [f.name for f in SystemAuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False