import random
from datetime import timedelta, time
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# Create your models here.
class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_departments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} / {self.name}"
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('ADMIN', 'Admin'),
        ('SUPERVISOR', 'Supervisor'),
        ('EMPLOYEE', 'Employee'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    designation = models.CharField(max_length=100, null=True, blank=True)

    reminder_enabled = models.BooleanField(default=True)
    reminder_time = models.TimeField(default=time(17, 50, 0))

    departments = models.ManyToManyField(
        Department,
        through='UserDepartment',
        related_name='members', 
        blank=True)

    reporting_managers = models.ManyToManyField(
        'self',
        through='UserReporting',
        symmetrical=False,
        related_name='subordinates',
        blank=True
    )

    @property
    def is_super_admin(self):
        return self.role == 'SUPER_ADMIN'

    @property
    def is_org_admin(self):
        return self.role in ['ADMIN', 'SUPER_ADMIN']

    @property
    def is_supervisor_user(self):
        return self.role == 'SUPERVISOR'

    @property
    def is_standard_employee(self):
        return self.role == 'EMPLOYEE'

    def __str__(self):
        return f"{self.username} [{self.get_role_display()}] - {self.designation or 'Staff'}"


class UserDepartment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_departments')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='department_users')
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'department')


class UserReporting(models.Model):
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reporting_assignments')
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_assignments')
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ('employee', 'manager')


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
