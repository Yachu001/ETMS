from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from .models import User, Department, UserDepartment, UserReporting, PasswordResetOTP


class CustomUserCreationForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'role', 'designation')


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class UserDepartmentInline(admin.TabularInline):
    model = UserDepartment
    extra = 1


class UserReportingInline(admin.TabularInline):
    model = UserReporting
    fk_name = 'employee'
    extra = 1


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

    # Detail / Edit page field groupings
    fieldsets = UserAdmin.fieldsets + (
        ('Role & System Settings', {
            'fields': ('role', 'designation')
        }),
        ('Reminder Preferences', {
            'fields': ('reminder_enabled', 'reminder_time')
        }),
    )

    # Initial "+ Add User" form fields
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role & System Settings', {
            'fields': ('email', 'role', 'designation')
        }),
    )

    list_display = ('username', 'email', 'role', 'designation', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'email', 'designation')
    ordering = ('username',)
    inlines = [UserDepartmentInline, UserReportingInline]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'created_at')
    search_fields = ('name',)
    list_filter = ('parent',)


@admin.register(UserDepartment)
class UserDepartmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'department', 'is_primary')
    list_filter = ('is_primary', 'department')


@admin.register(UserReporting)
class UserReportingAdmin(admin.ModelAdmin):
    list_display = ('employee', 'manager', 'is_primary')
    list_filter = ('is_primary',)


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp_code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used',)