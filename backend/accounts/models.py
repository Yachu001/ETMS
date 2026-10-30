import random
from datetime import time, timedelta
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


# ==========================================
# 1. CORE ORGANIZATIONAL ENTITIES
# ==========================================

class Business(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def delete(self, *args, **kwargs):
        if self.business_users.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Business '{self.name}'. Active users are assigned to it.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_departments'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def delete(self, *args, **kwargs):
        if self.department_users.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Department '{self.name}'. Active users are mapped to it.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name


class BusinessDepartment(models.Model):
    """
    The Matrix Unit: Business + Department + Assigned Incharge (Supervisor).
    """
    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='business_departments'
    )
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name='department_businesses'
    )
    supervisor = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incharge_matrix'
    )
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_matrices'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('business', 'department')
        verbose_name = "Business Department Matrix"
        verbose_name_plural = "Business Department Matrices"

    @property
    def effective_incharge(self):
        return self.supervisor or self.created_by

    def __str__(self):
        lead = self.effective_incharge
        lead_name = (lead.full_name or lead.username) if lead else "Unassigned Incharge"
        return f"{self.business.code} - {self.department.name} [Incharge: {lead_name}]"


# ==========================================
# 2. CUSTOM USER (SINGLE MATRIX ARCHITECTURE)
# ==========================================

class User(AbstractUser):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('ADMIN', 'Admin'),
        ('BUSINESS_ADMIN', 'Business Admin'),
        ('DEPT_HEAD', 'Department Admin'),
        ('SUPERVISOR', 'Supervisor'),
        ('EMPLOYEE', 'Base Employee'),
    )

    full_name = models.CharField(max_length=150, blank=True, default='')
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='EMPLOYEE')
    employee_code = models.CharField(max_length=50, blank=True, null=True, unique=True)
    designation = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    date_of_joining = models.DateField(default=timezone.now)

    # Shift boundaries
    shift_start_time = models.TimeField(default=time(9, 0, 0))
    shift_end_time = models.TimeField(default=time(18, 0, 0))
    reminder_enabled = models.BooleanField(default=True)
    reminder_time = models.TimeField(default=time(17, 45, 0))
    
    #Idle Timers
    self_idle_timer_start = models.TimeField(
        default="10:00", 
        help_text="Time after which self idle notifications can trigger"
    )
    team_idle_timer_start = models.TimeField(
        null=True, 
        blank=True, 
        help_text="Time after which team idle alerts trigger for supervisors/admins"
    )

    # Single-Object Relationships (NO ARRAYS, NO IS_PRIMARY)
    matrix = models.ForeignKey(
        BusinessDepartment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matrix_members'
    )
    business = models.ForeignKey(
        Business,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='business_users'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='department_users'
    )
    reports_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_subordinates'
    )

    # Role Properties
    @property
    def is_super_admin(self):
        return self.role == 'SUPER_ADMIN' or self.is_superuser

    @property
    def is_org_admin(self):
        return self.role in ['ADMIN', 'SUPER_ADMIN']

    @property
    def is_business_admin(self):
        return self.role == 'BUSINESS_ADMIN'

    @property
    def is_dept_head(self):
        return self.role == 'DEPT_HEAD'

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
        if not self.full_name and self.username:
            self.full_name = self.username

        if not self.employee_code:
            try:
                last_user = User.objects.filter(employee_code__startswith='EID').order_by('-id').first()
                seq = 1
                if last_user and last_user.employee_code:
                    digits = ''.join(filter(str.isdigit, last_user.employee_code))
                    seq = int(digits) + 1 if digits else (User.objects.count() + 1)
                else:
                    seq = User.objects.count() + 1
                self.employee_code = f"EID{seq:03d}"
            except Exception:
                self.employee_code = f"EID{timezone.now().strftime('%y%m%d%H%M%S')}"

        if self.is_superuser and self.role != 'SUPER_ADMIN':
            self.role = 'SUPER_ADMIN'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} [{self.get_role_display()}]"


# ==========================================
# 3. ATTENDANCE & PASSWORD RESET
# ==========================================

class AttendanceRecord(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField(default=timezone.now)
    is_present = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        status = "Present" if self.is_present else "Absent"
        return f"{self.user.username} - {self.date} [{status}]"


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


# ==========================================
# 4. DYNAMIC INCHARGE SYNC SIGNAL
# ==========================================

@receiver(post_save, sender=BusinessDepartment)
def sync_matrix_incharge_to_members(sender, instance, **kwargs):
    """
    When a Matrix Incharge (supervisor) changes,
    automatically update reports_to for all base employees in that Matrix.
    """
    new_incharge = instance.supervisor
    instance.matrix_members.filter(role='EMPLOYEE').update(reports_to=new_incharge)