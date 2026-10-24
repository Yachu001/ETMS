import random
from datetime import timedelta, time
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ==========================================
# 1. BUSINESS ENTITY (COMPANIES / CHILD UNITS)
# ==========================================
class Business(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)  # e.g., 'B1', 'B2', 'CORP'
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Business"
        verbose_name_plural = "Businesses"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


# ==========================================
# 2. DEPARTMENTS & SUB-DEPARTMENTS
# ==========================================
class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    # Self-referencing link for optional sub-departments (e.g., Accounts under Finance)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_departments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} / {self.name}"
        return self.name


# ==========================================
# 3. CUSTOM USER MODEL
# ==========================================
class User(AbstractUser):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('DEPT_HEAD', 'Department Head (C-Level / CMO / CFO)'),
        ('BUSINESS_ADMIN', 'Business Admin'),
        ('ADMIN', 'General Admin'),
        ('SUPERVISOR', 'Supervisor'),
        ('EMPLOYEE', 'Base Employee'),
    )

    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='EMPLOYEE')
    designation = models.CharField(max_length=150, blank=True, null=True)

    # Master Profile Attributes
    full_name = models.CharField(max_length=150, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, null=True)
    employee_code = models.CharField(max_length=50, blank=True, null=True, unique=True)
    date_of_joining = models.DateField(default=timezone.now)

    # Duty / Shift Boundaries (Defaults: 9:00 AM to 6:00 PM)
    shift_start_time = models.TimeField(default=time(9, 0, 0))
    shift_end_time = models.TimeField(default=time(18, 0, 0))

    # Workday check-out reminder settings
    reminder_enabled = models.BooleanField(default=True)
    reminder_time = models.TimeField(default=time(17, 45, 0))

    # Business Association
    businesses = models.ManyToManyField(
        Business,
        related_name='members',
        blank=True
    )

    # Department Association via Junction Table
    departments = models.ManyToManyField(
        Department,
        through='UserDepartment',
        related_name='members',
        blank=True
    )

    # Reporting Hierarchy via Junction Table
    reporting_managers = models.ManyToManyField(
        'self',
        through='UserReporting',
        symmetrical=False,
        related_name='subordinates',
        blank=True
    )

    # Role Helpers
    @property
    def is_super_admin(self):
        return self.role == 'SUPER_ADMIN'

    @property
    def is_dept_head(self):
        return self.role == 'DEPT_HEAD'

    @property
    def is_business_admin(self):
        return self.role == 'BUSINESS_ADMIN'

    @property
    def is_org_admin(self):
        return self.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']

    @property
    def is_supervisor_user(self):
        return self.role == 'SUPERVISOR'

    @property
    def is_standard_employee(self):
        return self.role == 'EMPLOYEE'

    @property
    def is_present(self):
        today = timezone.now().date()
        rec = self.attendance_records.filter(date=today).first()
        return rec.is_present if rec else False

    def save(self, *args, **kwargs):
        # 1. Fallback full_name to username if empty
        if not self.full_name and self.username:
            self.full_name = self.username

        # 2. Auto-generate employee_code if not provided (Pattern: EID01, EID02, ...)
        if not self.employee_code:
            last_emp = User.objects.filter(employee_code__startswith='EID').order_by('-id').first()
            if last_emp and last_emp.employee_code:
                try:
                    num_str = last_emp.employee_code.replace('EID', '')
                    next_num = int(num_str) + 1
                except ValueError:
                    next_num = User.objects.count() + 1
            else:
                next_num = 1
            self.employee_code = f"EID{next_num:02d}"

        # 3. Superuser role sync
        if self.is_superuser and self.role != 'SUPER_ADMIN':
            self.role = 'SUPER_ADMIN'

        super().save(*args, **kwargs)

    def __str__(self):
        name_display = self.full_name or self.username
        return f"{name_display} [{self.get_role_display()}] - {self.designation or 'Staff'}"


# ==========================================
# 4. JUNCTION TABLE: USER <-> DEPARTMENT
# ==========================================
class UserDepartment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_departments')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='department_users')
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'department')
        verbose_name = "User Department Mapping"
        verbose_name_plural = "User Department Mappings"

    def __str__(self):
        tag = " [Primary]" if self.is_primary else ""
        return f"{self.user.username} -> {self.department.name}{tag}"


# ==========================================
# 5. JUNCTION TABLE: REPORTING HIERARCHY
# ==========================================
class UserReporting(models.Model):
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reporting_assignments')
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_assignments')
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ('employee', 'manager')
        verbose_name = "User Reporting Hierarchy"
        verbose_name_plural = "User Reporting Hierarchies"

    def __str__(self):
        tag = " [Primary Lead]" if self.is_primary else ""
        return f"{self.employee.username} reports to {self.manager.username}{tag}"


# ==========================================
# 6. ATTENDANCE & ON-DUTY TRACKING
# ==========================================
class AttendanceRecord(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField(default=timezone.now)
    is_present = models.BooleanField(default=True)
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'date')
        verbose_name = "Attendance Record"
        verbose_name_plural = "Attendance Records"

    def __str__(self):
        status = "Present" if self.is_present else "On Leave"
        return f"{self.user.username} - {self.date} ({status})"


# ==========================================
# 7. EMAIL OTP FOR PASSWORD RECOVERY
# ==========================================
class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_otps')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.otp_code:
            self.otp_code = f"{random.randint(100000, 999999)}"
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at

    def __str__(self):
        status = "Used" if self.is_used else "Active"
        return f"OTP for {self.user.username} [{status}]"