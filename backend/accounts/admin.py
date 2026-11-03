# backend/accounts/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.contrib.auth import get_user_model
from django.db import transaction

from .models import (
    Business,
    Department,
    BusinessDepartment,
    AttendanceRecord,
    PasswordResetOTP,
    SystemAuditLog,
)

User = get_user_model()


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'full_name', 'role', 'designation', 'matrix')


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'


# ==========================================
# 1. BUSINESS ADMIN
# ==========================================
@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'incharge', 'created_by', 'is_active', 'created_at')
    search_fields = ('name', 'code', 'incharge__username', 'incharge__full_name')
    list_filter = ('is_active', 'created_at')
    readonly_fields = ('created_at',)

    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user
        if not obj.incharge:
            obj.incharge = request.user
        with transaction.atomic():
            # Signals handle 1-to-1 relieving and bi-directional user sync
            super().save_model(request, obj, form, change)


# ==========================================
# 2. DEPARTMENT ADMIN
# ==========================================
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'parent', 'incharge', 'created_by', 'is_active', 'created_at')
    search_fields = ('name', 'code', 'incharge__username', 'incharge__full_name')
    list_filter = ('is_active', 'parent', 'created_at')
    readonly_fields = ('created_at',)

    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user
        if not obj.incharge:
            obj.incharge = request.user
        with transaction.atomic():
            # Signals handle 1-to-1 relieving and bi-directional user sync
            super().save_model(request, obj, form, change)


# ==========================================
# 3. MATRIX (BUSINESS-DEPARTMENT) ADMIN
# ==========================================
@admin.register(BusinessDepartment)
class BusinessDepartmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'code', 'name', 'business', 'department', 
        'supervisor', 'get_effective_incharge', 'is_active', 'created_at'
    )
    list_filter = ('business', 'department', 'is_active')
    search_fields = (
        'name', 'code', 'business__name', 'business__code',
        'department__name', 'supervisor__username', 'supervisor__full_name'
    )
    readonly_fields = ('created_at', 'effective_incharge_display')

    def get_effective_incharge(self, obj):
        lead = obj.effective_incharge
        return lead.full_name or lead.username if lead else 'Unassigned'
    get_effective_incharge.short_description = 'Effective Incharge'

    def effective_incharge_display(self, obj):
        lead = obj.effective_incharge
        return f"{lead.full_name or lead.username} ({lead.get_role_display()})" if lead else 'None'
    effective_incharge_display.short_description = 'Computed Hierarchical Incharge'

    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user
        with transaction.atomic():
            # Signals handle supervisor relieving, sync, and member cascade
            super().save_model(request, obj, form, change)


# ==========================================
# 4. CUSTOM USER ADMIN
# ==========================================
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
            'fields': (
                'shift_start_time', 'shift_end_time', 
                'reminder_enabled', 'reminder_time',
                'self_idle_timer_start', 'team_idle_timer_start'
            )
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


# ==========================================
# 5. ATTENDANCE & RESET OTPS
# ==========================================
@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'is_present', 'marked_at')
    list_filter = ('is_present', 'date')
    search_fields = ('user__username', 'user__full_name')


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp_code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used', 'expires_at')
    search_fields = ('user__username', 'user__email', 'otp_code')


# ==========================================
# 6. SYSTEM AUDIT LOG (IMMUTABLE)
# ==========================================
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