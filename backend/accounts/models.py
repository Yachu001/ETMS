# backend/accounts/models.py

import random
from datetime import time, timedelta
from django.db import models
from django.conf import settings
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
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default='')
    incharge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_businesses'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_businesses'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Businesses'

    def clean(self):
        # Incharge can only be BUSINESS_ADMIN, ADMIN, or SUPER_ADMIN
        if self.incharge and self.incharge.role not in ['BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN']:
            raise ValidationError({
                'incharge': f"Cannot assign {self.incharge.role} as Business Incharge. Must be Business Admin, Admin, or Super Admin."
            })

    def delete(self, *args, **kwargs):
        if self.business_users.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Business '{self.name}'. Active users are currently assigned to it.")
        if self.business_departments.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Business '{self.name}'. Active matrix branches are currently linked to it.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Department(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=50, unique=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_departments'
    )
    incharge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_departments'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_departments'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def clean(self):
        # Incharge can only be DEPT_HEAD, ADMIN, or SUPER_ADMIN
        if self.incharge and self.incharge.role not in ['DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN']:
            raise ValidationError({
                'incharge': f"Cannot assign {self.incharge.role} as Department Incharge. Must be Department Admin, Admin, or Super Admin."
            })

    def delete(self, *args, **kwargs):
        if self.department_users.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Department '{self.name}'. Active users are currently mapped to it.")
        if self.department_businesses.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Department '{self.name}'. Active matrix branches are currently linked to it.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"


class BusinessDepartment(models.Model):
    """
    The Matrix Unit: Business + Department + Assigned Incharge (Supervisor).
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
    name = models.CharField(max_length=150, blank=True, null=True)
    code = models.CharField(max_length=50, blank=True, null=True)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incharge_matrix'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_matrices'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('business', 'department')
        ordering = ['business__name', 'department__name']
        verbose_name = "Business Department Matrix"
        verbose_name_plural = "Business Department Matrices"

    def clean(self):
        # Supervisor must be SUPERVISOR, ADMIN, SUPER_ADMIN, BUSINESS_ADMIN, or DEPT_HEAD
        if self.supervisor and self.supervisor.role not in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
            raise ValidationError({
                'supervisor': f"Matrix Incharge must be Supervisor or a higher management tier (cannot be {self.supervisor.role})."
            })

    def delete(self, *args, **kwargs):
        if self.matrix_members.filter(is_active=True).exists():
            raise ValidationError(f"Cannot delete Matrix '{self}'. Active members are currently assigned to this branch.")
        super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        if not self.code and self.business_id and self.department_id:
            self.code = f"{self.business.code}-{self.department.code}"
        if not self.name and self.business_id and self.department_id:
            self.name = f"{self.business.name} - {self.department.name}"
        super().save(*args, **kwargs)

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

    # Idle Timers
    self_idle_timer_start = models.TimeField(
        default="10:00",
        help_text="Time after which self idle notifications can trigger"
    )
    team_idle_timer_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Time after which team idle alerts trigger for supervisors/admins"
    )

    # Single-Object Relationships
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

    class Meta:
        ordering = ['username']

    def clean(self):
        # Base employee cannot manage anyone
        if self.reports_to and self.reports_to.role == 'EMPLOYEE':
            raise ValidationError({'reports_to': "Base employees cannot be designated as reporting managers."})
        # Prevent self-reporting
        if self.reports_to and self.pk and self.reports_to.pk == self.pk:
            raise ValidationError({'reports_to': "A user cannot report to themselves."})

    @property
    def effective_business(self):
        """
        Resolves the business scope for the user:
        1. Explicit direct link on user.business
        2. Reverse relation if the user is incharge of a Business
        3. Matrix branch's business
        """
        if self.business:
            return self.business
        if self.role == 'BUSINESS_ADMIN':
            return self.managed_businesses.filter(is_active=True).first()
        if self.matrix and self.matrix.business:
            return self.matrix.business
        return None

    @property
    def effective_department(self):
        """
        Resolves the department scope for the user:
        1. Explicit direct link on user.department
        2. Reverse relation if the user is incharge of a Department
        3. Matrix branch's department
        """
        if self.department:
            return self.department
        if self.role == 'DEPT_HEAD':
            return self.managed_departments.filter(is_active=True).first()
        if self.matrix and self.matrix.department:
            return self.matrix.department
        return None

    def get_dual_reporting_leads(self):
        """
        Supervisor Dual Direct Reporting:
        Returns:
        1. Business Admin of the Matrix's Business
        2. Department Admin of the Matrix's Department
        """
        if self.role != 'SUPERVISOR':
            return []

        leads = []
        biz = self.business or (self.matrix.business if self.matrix else None)
        dept = self.department or (self.matrix.department if self.matrix else None)

        if biz:
            b_admin = biz.incharge or User.objects.filter(role='BUSINESS_ADMIN', business=biz, is_active=True).first()
            if b_admin and b_admin.id != self.id:
                leads.append({
                    'type': 'Business Admin',
                    'id': b_admin.id,
                    'name': b_admin.full_name or b_admin.username,
                    'scope': biz.name
                })

        if dept:
            d_admin = dept.incharge or User.objects.filter(role='DEPT_HEAD', department=dept, is_active=True).first()
            if d_admin and d_admin.id != self.id:
                leads.append({
                    'type': 'Department Admin',
                    'id': d_admin.id,
                    'name': d_admin.full_name or d_admin.username,
                    'scope': dept.name
                })

        return leads

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
# 4. DYNAMIC INCHARGE & ENTITY SYNC SIGNALS
# ==========================================

@receiver(post_save, sender=BusinessDepartment)
def sync_matrix_incharge_to_members(sender, instance, **kwargs):
    """
    When a Matrix Incharge (supervisor) changes,
    automatically repoint reports_to for all base employees in that Matrix branch.
    """
    new_incharge = instance.supervisor
    instance.matrix_members.filter(role='EMPLOYEE').update(reports_to=new_incharge)


@receiver(post_save, sender=Business)
def sync_business_incharge_to_user(sender, instance, **kwargs):
    """
    When a Business incharge is designated or changed in Business management,
    automatically synchronize user.business on that incharge user.
    """
    if instance.incharge and instance.incharge.role == 'BUSINESS_ADMIN':
        if instance.incharge.business_id != instance.id:
            User.objects.filter(id=instance.incharge_id).update(business=instance)


@receiver(post_save, sender=Department)
def sync_department_incharge_to_user(sender, instance, **kwargs):
    """
    When a Department incharge is designated or changed in Department management,
    automatically synchronize user.department on that incharge user.
    """
    if instance.incharge and instance.incharge.role == 'DEPT_HEAD':
        if instance.incharge.department_id != instance.id:
            User.objects.filter(id=instance.incharge_id).update(department=instance)


# ==========================================
# 5. UNIFIED SYSTEM AUDIT TRAIL
# ==========================================

class SystemAuditLog(models.Model):
    MODULE_CHOICES = (
        ('TASK', 'Task Management'),
        ('USER', 'User Administration'),
        ('MATRIX', 'Matrix & Hierarchy'),
        ('ORGANIZATION', 'Business & Department'),
        ('FORM', 'Reason Forms & Approvals'),
        ('AUTH', 'Authentication & Access'),
    )

    action_type = models.CharField(max_length=50)
    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='USER')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='actions_performed'
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_records'
    )

    entity_id = models.IntegerField(null=True, blank=True)
    entity_name = models.CharField(max_length=255, blank=True, null=True)

    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    remarks = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['module', 'action_type']),
            models.Index(fields=['actor', 'timestamp']),
            models.Index(fields=['target_user', 'timestamp']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Audit log records are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Audit log records cannot be deleted.")

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'SYSTEM'
        return f"[{self.module}] {self.action_type} by {actor_name} at {self.timestamp}"