from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.contrib.auth import get_user_model
from .models import Business, Department, UserDepartment, UserReporting, AttendanceRecord, PasswordResetOTP

User = get_user_model()


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'full_name', 'role', 'designation')


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'


class UserDepartmentInline(admin.TabularInline):
    model = UserDepartment
    extra = 1


class UserReportingInline(admin.TabularInline):
    model = UserReporting
    fk_name = 'employee'
    extra = 1


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

    fieldsets = UserAdmin.fieldsets + (
        ('Employee Profile Details', {
            'fields': ('full_name', 'employee_code', 'phone', 'role', 'designation', 'date_of_joining', 'businesses')
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
                'password1', 'password2'
            ),
        }),
    )

    list_display = (
        'username', 'full_name', 'email', 'role', 'designation',
        'employee_code', 'date_of_joining', 'is_active', 'is_staff'
    )
    list_filter = ('role', 'is_active', 'is_staff', 'businesses')
    search_fields = ('username', 'full_name', 'email', 'employee_code', 'designation')
    ordering = ('username',)
    filter_horizontal = ('businesses',)
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


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'is_present', 'marked_at')
    list_filter = ('is_present', 'date')


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp_code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used',)