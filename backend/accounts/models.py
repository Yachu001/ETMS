import random
from datetime import timedelta, time
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone


# ==========================================
# 1. BUSINESS ENTITY (COMPANIES / OPERATING UNITS)
# ==========================================
class Business(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)  # e.g., 'B1', 'B2', 'CORP'
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Business"
        verbose_name_plural = "Businesses"
        ordering = ['name']

    def delete(self, *args, **kwargs):
        # Prevent deletion if active users belong to this business
        if self.members.filter(is_active=True).exists():
            raise ValidationError(
                f"Cannot delete Business '{self.name}'. There are active users currently assigned to it. "
                "Reassign or disable those users first, or set this business to disabled/inactive."
            )
        super().delete(*args, **kwargs)

    def __str__(self):
        status = "" if self.is_active else " [Disabled]"
        return f"{self.name} ({self.code}){status}"


# ==========================================
# 2. DEPARTMENTS & SUB-DEPARTMENTS
# ==========================================
class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_departments'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Department"
        verbose_name_plural = "Departments"
        ordering = ['name']

    def delete(self, *args, **kwargs):
        # Prevent deletion if active users belong to this department
        if self.department_users.filter(user__is_active=True).exists():
            raise ValidationError(
                f"Cannot delete Department '{self.name}'. There are active users mapped to it. "
                "Reassign users to another department or disable the department instead."
            )
        super().delete(*args, **kwargs)

    def __str__(self):
        status = "" if self.is_active else " [Disabled]"
        if self.parent:
            return f"{self.parent.name} / {self.name}{status}"
        return f"{self.name}{status}"


# ==========================================
# 3. MATRIX JUNCTION: BUSINESS <-> DEPARTMENT
# ==========================================
class BusinessDepartment(models.Model):
    """
    Cross-matrix junction linking a department within an operating business.
    Example: Business 1 has Marketing & Finance; Marketing operates across Business 1 & 2.
    """
    business = models.ForeignKey(
        Business, 
        on_delete=models.CASCADE, 
        related_name='business_departments'
    )
    department = models.ForeignKey(
        Department, 
        on_delete=models.CASCADE, 
        related_name='department_businesses'
    )
    supervisor = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervised_matrix_branches'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('business', 'department')
        verbose_name = "Business Department Matrix"
        verbose_name_plural = "Business Department Matrices"

    def __str__(self):
        status = "" if self.is_active else " [Disabled]"
        lead = (
            f" [Lead: {self.supervisor.full_name or self.supervisor.username}]"
            if self.supervisor else " [Unassigned Lead]"
        )
        return f"{self.business.code} - {self.department.name}{lead}{status}"


# ==========================================
# 4. CUSTOM USER MODEL
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

    # Relational Dimensions
    businesses = models.ManyToManyField(
        Business,
        related_name='members',
        blank=True
    )
    departments = models.ManyToManyField(
        Department,
        through='UserDepartment',
        related_name='members',
        blank=True
    )
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

    def delete(self, *args, **kwargs):
        # Prevent deletion if user has active tasks in flight
        active_task_statuses = [
            'REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 
            'ON_HOLD', 'AWAITING_VERIFICATION'
        ]
        if hasattr(self, 'assigned_tasks'):
            has_active_tasks = self.assigned_tasks.filter(status__in=active_task_statuses).exists()
            if has_active_tasks:
                raise ValidationError(
                    f"Cannot delete user '{self.username}'. They have active or pending tasks assigned. "
                    "Reassign or cancel these tasks, or disable the user account instead."
                )
        super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        # 1. Fallback full_name to username if blank
        if not self.full_name and self.username:
            self.full_name = self.username

        # 2. Guaranteed-Unique Auto-Generated employee_code
        if not self.employee_code or self.employee_code.strip() == '':
            # Fetch all existing EID codes to inspect the highest numeric value
            existing_codes = list(
                User.objects.filter(employee_code__startswith='EID')
                .values_list('employee_code', flat=True)
            )

            highest_num = 0
            for code in existing_codes:
                if code:
                    # Extract only the digits from the code (handles EID01, EID-02, EID003 safely)
                    digits = ''.join(filter(str.isdigit, code))
                    if digits:
                        try:
                            val = int(digits)
                            if val > highest_num:
                                highest_num = val
                        except ValueError:
                            pass

            candidate_num = highest_num + 1

            # Proactively check the database in a loop to ensure no collision exists
            while True:
                candidate_code = f"EID{candidate_num:02d}"
                # Exclude self if updating existing instance
                qs = User.objects.filter(employee_code=candidate_code)
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                
                if not qs.exists():
                    self.employee_code = candidate_code
                    break
                candidate_num += 1

        # 3. Superuser role sync
        if self.is_superuser and self.role != 'SUPER_ADMIN':
            self.role = 'SUPER_ADMIN'

        super().save(*args, **kwargs)

    def __str__(self):
        name_display = self.full_name or self.username
        return f"{name_display} [{self.get_role_display()}] - {self.designation or 'Staff'}"


# ==========================================
# 5. JUNCTION TABLE: USER <-> DEPARTMENT
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
# 6. JUNCTION TABLE: REPORTING HIERARCHY
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
# 7. ATTENDANCE RECORD
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
# 8. EMAIL OTP FOR PASSWORD RECOVERY
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