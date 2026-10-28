from datetime import time
from django.utils import timezone
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import (
    Business,
    Department,
    BusinessDepartment,
    UserDepartment,
    UserReporting,
    PasswordResetOTP,
)

User = get_user_model()


# ==========================================
# 1. JWT CUSTOM CLAIMS SERIALIZER
# ==========================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds user role, employee code, full name, and designation into JWT claims and payload."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['full_name'] = user.full_name or user.username
        token['email'] = user.email
        token['role'] = user.role
        token['designation'] = user.designation or 'Staff'
        token['employee_code'] = getattr(user, 'employee_code', None)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'full_name': self.user.full_name or self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'designation': self.user.designation or 'Staff',
            'employee_code': getattr(self.user, 'employee_code', None),
        }
        return data


# ==========================================
# 2. ENTITY & MATRIX SERIALIZERS
# ==========================================
class BusinessSerializer(serializers.ModelSerializer):
    total_members = serializers.SerializerMethodField()
    active_departments_count = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'code', 'description', 'is_active',
            'created_at', 'total_members', 'active_departments_count'
        ]
        read_only_fields = ['id', 'created_at', 'total_members', 'active_departments_count']

    def get_total_members(self, obj):
        if hasattr(obj, 'members'):
            return obj.members.filter(is_active=True).count()
        if hasattr(obj, 'employees'):
            return obj.employees.filter(is_active=True).count()
        return 0

    def get_active_departments_count(self, obj):
        if hasattr(obj, 'business_departments'):
            return obj.business_departments.filter(is_active=True).count()
        return 0


class DepartmentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    total_members = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'parent', 'parent_name', 'is_active', 'created_at', 'total_members']
        read_only_fields = ['id', 'created_at', 'parent_name', 'total_members']

    def get_total_members(self, obj):
        return obj.department_users.filter(user__is_active=True).count()


class BusinessDepartmentSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_code = serializers.CharField(source='business.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    # Explicit definition prevents ImproperlyConfigured errors
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    supervisor_name = serializers.SerializerMethodField()
    assigned_members_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = BusinessDepartment
        fields = [
            'id',
            'business',
            'business_name',
            'business_code',
            'department',
            'department_name',
            'supervisor',
            'supervisor_name',
            'is_active',
            'created_at',
            'assigned_members_count',
            'members'
        ]
        read_only_fields = [
            'id',
            'created_at',
            'business_name',
            'business_code',
            'department_name',
            'supervisor_name',
            'assigned_members_count',
            'members'
        ]

    def get_supervisor_name(self, obj):
        if getattr(obj, 'supervisor', None):
            return obj.supervisor.full_name or obj.supervisor.username
        return 'Unassigned Lead'

    def get_assigned_members_count(self, obj):
        return User.objects.filter(
            is_active=True,
            businesses=obj.business,
            departments=obj.department
        ).distinct().count()

    def get_members(self, obj):
        supervisor_id = obj.supervisor_id if getattr(obj, 'supervisor_id', None) else 0
        users = User.objects.filter(
            is_active=True,
            businesses=obj.business,
            departments=obj.department
        ).exclude(id=supervisor_id).distinct()

        return [
            {
                'id': u.id,
                'username': u.username,
                'full_name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Staff',
                'is_present': getattr(u, 'is_present', False)
            }
            for u in users
        ]


# ==========================================
# 3. USER PROFILE SERIALIZER (Self / Cockpit)
# ==========================================
class UserProfileSerializer(serializers.ModelSerializer):
    businesses = serializers.SerializerMethodField()
    departments = serializers.SerializerMethodField()
    primary_department = serializers.SerializerMethodField()
    primary_manager = serializers.SerializerMethodField()
    reporting_managers = serializers.SerializerMethodField()
    is_present = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone', 'employee_code',
            'role', 'designation', 'date_of_joining', 'is_active', 'is_present',
            'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
            'businesses', 'departments', 'primary_department', 'primary_manager', 'reporting_managers'
        ]
        read_only_fields = ['id', 'role', 'employee_code', 'is_present', 'date_of_joining']

    def get_departments(self, obj):
        mappings = list(obj.user_departments.select_related('department').all())
        single = len(mappings) == 1
        return [
            {
                'id': m.department.id,
                'name': m.department.name,
                'is_primary': m.is_primary or single
            }
            for m in mappings
        ]

    def get_primary_department(self, obj):
        mapping = obj.user_departments.filter(is_primary=True).select_related('department').first()
        return mapping.department.name if mapping else "No Department"

    def get_primary_manager(self, obj):
        reporting = obj.reporting_assignments.filter(is_primary=True).select_related('manager').first()
        return reporting.manager.username if reporting else "None"

    def get_reporting_managers(self, obj):
        mappings = list(obj.reporting_assignments.select_related('manager').all())
        single = len(mappings) == 1
        return [
            {
                'id': m.manager.id,
                'username': m.manager.username,
                'full_name': m.manager.full_name or m.manager.username,
                'designation': m.manager.designation or 'Lead',
                'is_primary': m.is_primary or single
            }
            for m in mappings
        ]

    def get_businesses(self, obj):
        biz_list = list(obj.businesses.all())
        single = len(biz_list) == 1
        return [
            {
                'id': b.id,
                'name': b.name,
                'code': b.code,
                'is_primary': single or (index == 0)
            }
            for index, b in enumerate(biz_list)
        ]


# ==========================================
# 4. SUBORDINATE / ROSTER SERIALIZER
# ==========================================
class SubordinateUserSerializer(serializers.ModelSerializer):
    """Used for employee management tables and subordinate lists."""
    businesses = serializers.SerializerMethodField()
    departments = serializers.SerializerMethodField()
    reporting_managers = serializers.SerializerMethodField()
    primary_department = serializers.SerializerMethodField()
    primary_manager = serializers.SerializerMethodField()
    is_present = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'phone',
            'employee_code', 'role', 'designation', 'date_of_joining',
            'shift_start_time', 'shift_end_time', 'is_active', 'is_present',
            'businesses', 'departments', 'reporting_managers',
            'primary_department', 'primary_manager'
        ]

    def get_businesses(self, obj):
        biz_list = list(obj.businesses.all())
        single = len(biz_list) == 1
        return [
            {
                'id': b.id,
                'name': b.name,
                'code': b.code,
                'is_primary': single or (index == 0)
            }
            for index, b in enumerate(biz_list)
        ]

    def get_departments(self, obj):
        mappings = list(obj.user_departments.select_related('department').all())
        single = len(mappings) == 1
        return [
            {
                'id': m.department.id,
                'name': m.department.name,
                'is_primary': m.is_primary or single
            }
            for m in mappings
        ]

    def get_reporting_managers(self, obj):
        mappings = list(obj.reporting_assignments.select_related('manager').all())
        single = len(mappings) == 1
        return [
            {
                'id': m.manager.id,
                'username': m.manager.username,
                'full_name': m.manager.full_name or m.manager.username,
                'designation': m.manager.designation or 'Lead',
                'is_primary': m.is_primary or single
            }
            for m in mappings
        ]

    def get_primary_department(self, obj):
        mapping = obj.user_departments.filter(is_primary=True).select_related('department').first()
        return mapping.department.name if mapping else None

    def get_primary_manager(self, obj):
        reporting = obj.reporting_assignments.filter(is_primary=True).select_related('manager').first()
        return reporting.manager.full_name or reporting.manager.username if reporting else None


# ==========================================
# 5. USER CREATION WITH FALLBACK DEFAULTS
# ==========================================
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    department_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    business_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, allow_null=True
    )
    reports_to_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    employee_code = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'employee_code', 'password', 'role', 'designation', 'date_of_joining',
            'shift_start_time', 'shift_end_time', 'department_id',
            'business_ids', 'reports_to_id'
        ]

    def validate(self, data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        target_role = data.get('role', 'EMPLOYEE')
        reports_to_id = data.get('reports_to_id')
        dept_id = data.get('department_id')
        biz_ids = data.get('business_ids') or []

        # 1. Base Employee cannot be designated as a reporting manager
        if reports_to_id:
            manager = User.objects.filter(id=reports_to_id, is_active=True).first()
            if not manager:
                raise serializers.ValidationError({
                    "reports_to_id": "The specified reporting manager does not exist or is inactive."
                })
            if manager.role == 'EMPLOYEE':
                raise serializers.ValidationError({
                    "reports_to_id": "Base employees cannot be designated as reporting managers."
                })

        if not actor or not actor.is_authenticated:
            return data

        # 2. Supervisor Scoping Rules
        if getattr(actor, 'is_supervisor_user', False) or actor.role == 'SUPERVISOR':
            if target_role != 'EMPLOYEE':
                raise serializers.ValidationError({
                    "role": "Supervisors are only authorized to create standard Employee accounts."
                })
            # Supervisor always manages created user
            data['reports_to_id'] = actor.id

            # Verify department matches supervisor's scope
            if dept_id and not actor.departments.filter(id=dept_id, is_active=True).exists():
                raise serializers.ValidationError({
                    "department_id": "You can only assign employees to departments you are linked to."
                })

            # Verify business matches supervisor's scope
            if biz_ids:
                allowed_biz_ids = set(actor.businesses.filter(is_active=True).values_list('id', flat=True))
                if not set(biz_ids).issubset(allowed_biz_ids):
                    raise serializers.ValidationError({
                        "business_ids": "You cannot assign users to businesses outside your scope."
                    })

        # 3. Business Admin Scoping Rules
        elif getattr(actor, 'is_business_admin', False) or actor.role == 'BUSINESS_ADMIN':
            if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                raise serializers.ValidationError({
                    "role": "Business Admins can only provision Supervisors and Employees."
                })

            actor_biz = actor.businesses.filter(is_active=True).first()
            if actor_biz:
                data['business_ids'] = [actor_biz.id]
                # Enforce that the selected department belongs to this business matrix
                if dept_id and not BusinessDepartment.objects.filter(business=actor_biz, department_id=dept_id, is_active=True).exists():
                    raise serializers.ValidationError({
                        "department_id": f"The selected department is not linked to {actor_biz.name} in the business matrix."
                    })

        # 4. Department Head Scoping Rules
        elif getattr(actor, 'is_dept_head', False) or actor.role == 'DEPT_HEAD':
            if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                raise serializers.ValidationError({
                    "role": "Department Heads can only provision Supervisors and Employees."
                })

            primary_dept_rel = actor.user_departments.filter(is_primary=True).first()
            actor_dept = primary_dept_rel.department if primary_dept_rel else actor.departments.filter(is_active=True).first()
            if actor_dept:
                data['department_id'] = actor_dept.id
                # Enforce that selected businesses belong to this department matrix
                if biz_ids:
                    linked_biz_ids = set(
                        BusinessDepartment.objects.filter(department=actor_dept, is_active=True).values_list('business_id', flat=True)
                    )
                    if not set(biz_ids).issubset(linked_biz_ids):
                        raise serializers.ValidationError({
                            "business_ids": f"Selected business is not linked to {actor_dept.name} in the matrix."
                        })

        # 5. Main Admin Scoping Rules
        elif actor.role == 'ADMIN':
            if target_role in ['ADMIN', 'SUPER_ADMIN']:
                raise serializers.ValidationError({
                    "role": "Admins cannot provision or create other Admin or Super Admin accounts."
                })

        return data

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)

        dept_id = validated_data.pop('department_id', None)
        business_ids = validated_data.pop('business_ids', None)
        reports_to_id = validated_data.pop('reports_to_id', None)

        # 1. Fallback default password
        raw_password = validated_data.pop('password', None) or 'TempPass@123'

        # 2. Defaults for blank fields
        if not validated_data.get('role'):
            validated_data['role'] = 'EMPLOYEE'
        if not validated_data.get('date_of_joining'):
            validated_data['date_of_joining'] = timezone.now().date()
        if not validated_data.get('shift_start_time'):
            validated_data['shift_start_time'] = time(9, 0, 0)
        if not validated_data.get('shift_end_time'):
            validated_data['shift_end_time'] = time(18, 0, 0)

        # Create user instance
        user = User.objects.create(**validated_data)
        user.set_password(raw_password)
        user.save()

        # 3. Department Resolution & Fallback ("No Department")
        target_dept = None
        if dept_id:
            target_dept = Department.objects.filter(id=dept_id, is_active=True).first()

        if not target_dept and actor:
            if getattr(actor, 'is_supervisor_user', False) or actor.role == 'SUPERVISOR':
                sup_dept_rel = actor.user_departments.filter(is_primary=True).first()
                target_dept = sup_dept_rel.department if sup_dept_rel else actor.departments.first()
            elif getattr(actor, 'is_dept_head', False) or actor.role == 'DEPT_HEAD':
                dept_head_rel = actor.user_departments.filter(is_primary=True).first()
                target_dept = dept_head_rel.department if dept_head_rel else actor.departments.first()

        if not target_dept:
            target_dept, _ = Department.objects.get_or_create(
                name="No Department",
                defaults={'parent': None, 'is_active': True}
            )

        UserDepartment.objects.create(user=user, department=target_dept, is_primary=True)

        # 4. Business Resolution & Fallback ("No Business")
        if business_ids:
            businesses = Business.objects.filter(id__in=business_ids, is_active=True)
            user.businesses.set(businesses)
        else:
            if actor and (getattr(actor, 'is_supervisor_user', False) or actor.role in ['SUPERVISOR', 'BUSINESS_ADMIN']) and actor.businesses.exists():
                user.businesses.set(actor.businesses.filter(is_active=True))
            else:
                default_biz, _ = Business.objects.get_or_create(
                    name="No Business",
                    defaults={'code': 'NONE', 'is_active': True}
                )
                user.businesses.add(default_biz)

        # 5. Reporting Manager Resolution & Fallback
        if actor and (getattr(actor, 'is_supervisor_user', False) or actor.role == 'SUPERVISOR'):
            UserReporting.objects.create(employee=user, manager=actor, is_primary=True)
        elif reports_to_id:
            manager = User.objects.filter(id=reports_to_id, is_active=True).first()
            if manager and manager.id != user.id:
                UserReporting.objects.create(employee=user, manager=manager, is_primary=True)
        elif actor and actor.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
            UserReporting.objects.create(employee=user, manager=actor, is_primary=True)

        return user


# ==========================================
# 6. PASSWORD RESET & REPORTING ASSIGNMENT
# ==========================================
class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)


class AssignReportingSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    manager_id = serializers.IntegerField()
    is_primary = serializers.BooleanField(default=False)

    def validate(self, data):
        if data['employee_id'] == data['manager_id']:
            raise serializers.ValidationError("An employee cannot report to themselves.")
        return data