from datetime import time
from django.utils import timezone
from rest_framework import serializers
from django.db import transaction
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import Business, Department, BusinessDepartment, AttendanceRecord, PasswordResetOTP

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
        return obj.business_users.filter(is_active=True).count()

    def get_active_departments_count(self, obj):
        return obj.business_departments.filter(is_active=True).count()


class DepartmentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    total_members = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'parent', 'parent_name', 'is_active', 'created_at', 'total_members']
        read_only_fields = ['id', 'created_at', 'parent_name', 'total_members']

    def get_total_members(self, obj):
        return obj.department_users.filter(is_active=True).count()


class BusinessDepartmentSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_code = serializers.CharField(source='business.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    supervisor_name = serializers.SerializerMethodField()
    assigned_members_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = BusinessDepartment
        fields = [
            'id', 'business', 'business_name', 'business_code',
            'department', 'department_name', 'supervisor', 'supervisor_name',
            'is_active', 'created_at', 'assigned_members_count', 'members'
        ]
        read_only_fields = [
            'id', 'created_at', 'business_name', 'business_code',
            'department_name', 'supervisor_name', 'assigned_members_count', 'members'
        ]

    def get_supervisor_name(self, obj):
        if obj.supervisor:
            return obj.supervisor.full_name or obj.supervisor.username
        return 'Unassigned Lead'

    def get_assigned_members_count(self, obj):
        return obj.matrix_members.filter(is_active=True).count()

    def get_members(self, obj):
        # Return base members under this matrix
        members_qs = obj.matrix_members.filter(is_active=True, role='EMPLOYEE')
        return [
            {
                'id': u.id,
                'username': u.username,
                'full_name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Staff',
                'is_present': getattr(u, 'is_present', False)
            }
            for u in members_qs
        ]


# ==========================================
# 3. USER PROFILE SERIALIZER (Self / Cockpit)
# ==========================================
class UserProfileSerializer(serializers.ModelSerializer):
    """
    Clean single-object view with dual-reporting lead support,
    safe attendance checks, and matrix branch resolution.
    """
    matrix = serializers.SerializerMethodField()
    business = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    reports_to = serializers.SerializerMethodField()
    reporting_leads = serializers.SerializerMethodField()
    
    # Flat string helpers for simpler frontend templates
    matrix_name = serializers.SerializerMethodField()
    business_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    is_present = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone', 'employee_code',
            'role', 'designation', 'date_of_joining', 'is_active', 'is_present',
            'shift_start_time', 'shift_end_time', 'self_idle_timer_start', 'team_idle_timer_start',
            'reminder_enabled', 'reminder_time',
            'matrix', 'business', 'department', 'reports_to', 'reporting_leads',
            'matrix_name', 'business_name', 'department_name', 'manager_name'
        ]
        read_only_fields = ['id', 'role', 'employee_code', 'is_present', 'date_of_joining']

    def get_matrix(self, obj):
        if getattr(obj, 'matrix', None):
            return {
                'id': obj.matrix.id,
                'title': str(obj.matrix)
            }
        return None

    def get_business(self, obj):
        biz = getattr(obj, 'business', None) or (obj.matrix.business if getattr(obj, 'matrix', None) else None)
        if biz:
            return {
                'id': biz.id,
                'name': biz.name,
                'code': biz.code
            }
        return None

    def get_department(self, obj):
        dept = getattr(obj, 'department', None) or (obj.matrix.department if getattr(obj, 'matrix', None) else None)
        if dept:
            return {
                'id': dept.id,
                'name': dept.name
            }
        return None

    def get_reports_to(self, obj):
        mgr = getattr(obj, 'reports_to', None) or (obj.matrix.supervisor if getattr(obj, 'matrix', None) else None)
        if mgr:
            return {
                'id': mgr.id,
                'username': mgr.username,
                'full_name': mgr.full_name or mgr.username,
                'designation': getattr(mgr, 'designation', 'Lead') or 'Lead'
            }
        return None

    def get_matrix_name(self, obj):
        return str(obj.matrix) if getattr(obj, 'matrix', None) else 'No Matrix Assigned'

    def get_business_name(self, obj):
        biz = getattr(obj, 'business', None) or (obj.matrix.business if getattr(obj, 'matrix', None) else None)
        return f"{biz.name} ({biz.code})" if biz else 'No Business'

    def get_department_name(self, obj):
        dept = getattr(obj, 'department', None) or (obj.matrix.department if getattr(obj, 'matrix', None) else None)
        return dept.name if dept else 'No Department'

    def get_manager_name(self, obj):
        mgr = getattr(obj, 'reports_to', None) or (obj.matrix.supervisor if getattr(obj, 'matrix', None) else None)
        return (mgr.full_name or mgr.username) if mgr else 'Unassigned'

    def get_reporting_leads(self, obj):
        """
        For a Supervisor: returns upstream reporting leads:
        1. Business Admin of their Business
        2. Department Admin of their Department
        """
        if getattr(obj, 'role', None) != 'SUPERVISOR':
            return []

        leads = []
        biz = getattr(obj, 'business', None) or (obj.matrix.business if getattr(obj, 'matrix', None) else None)
        dept = getattr(obj, 'department', None) or (obj.matrix.department if getattr(obj, 'matrix', None) else None)

        if biz:
            b_admin = User.objects.filter(role='BUSINESS_ADMIN', business=biz, is_active=True).first()
            if b_admin:
                leads.append({
                    'type': 'Business Admin',
                    'id': b_admin.id,
                    'name': b_admin.full_name or b_admin.username,
                    'scope': biz.name
                })

        if dept:
            d_admin = User.objects.filter(role='DEPT_HEAD', department=dept, is_active=True).first()
            if d_admin:
                leads.append({
                    'type': 'Department Admin',
                    'id': d_admin.id,
                    'name': d_admin.full_name or d_admin.username,
                    'scope': dept.name
                })

        return leads

    def get_is_present(self, obj):
        today = timezone.localtime(timezone.now()).date()
        rec = obj.attendance_records.filter(date=today).first()
        return rec.is_present if rec else False


# ==========================================
# 4. SUBORDINATE / ROSTER SERIALIZER
# ==========================================
class SubordinateUserSerializer(serializers.ModelSerializer):
    matrix_name = serializers.SerializerMethodField()
    business_name = serializers.SerializerMethodField()
    business_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    reports_to_id = serializers.SerializerMethodField()
    is_present = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'phone',
            'employee_code', 'role', 'designation', 'date_of_joining',
            'shift_start_time', 'shift_end_time', 'is_active', 'is_present',
            'matrix_id', 'matrix_name',
            'business_id', 'business_name',
            'department_id', 'department_name',
            'reports_to_id', 'manager_name'
        ]

    def get_matrix_name(self, obj):
        return str(obj.matrix) if obj.matrix else 'No Matrix'

    def get_business_name(self, obj):
        biz = obj.business or (obj.matrix.business if obj.matrix else None)
        return biz.name if biz else 'No Business'

    def get_business_id(self, obj):
        biz = obj.business or (obj.matrix.business if obj.matrix else None)
        return biz.id if biz else None

    def get_department_name(self, obj):
        dept = obj.department or (obj.matrix.department if obj.matrix else None)
        return dept.name if dept else 'No Department'

    def get_department_id(self, obj):
        dept = obj.department or (obj.matrix.department if obj.matrix else None)
        return dept.id if dept else None

    def get_manager_name(self, obj):
        return (obj.reports_to.full_name or obj.reports_to.username) if obj.reports_to else 'Unassigned'

    def get_reports_to_id(self, obj):
        return obj.reports_to_id


# ==========================================
# 5. USER CREATION WITH MATRIX AUTO-DERIVATION
# ==========================================
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    matrix_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    business_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    department_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    reports_to_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'full_name', 'phone',
            'role', 'designation', 'date_of_joining', 'shift_start_time', 'shift_end_time',
            'matrix_id', 'business_id', 'department_id', 'reports_to_id'
        ]

    def validate(self, data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        target_role = data.get('role', 'EMPLOYEE')
        reports_to_id = data.get('reports_to_id')

        # Prevent assigning any user to report to a base Employee
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

        # Supervisor can strictly create standard Employees
        if actor.role == 'SUPERVISOR':
            if target_role != 'EMPLOYEE':
                raise serializers.ValidationError({
                    "role": "Supervisors are only authorized to create standard Employee accounts."
                })

        # Business Admin & Dept Admin can only provision Supervisors and Employees
        elif actor.role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
            if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                raise serializers.ValidationError({
                    "role": f"{actor.role.replace('_', ' ')}s can only provision Supervisors and Employees."
                })

        # Main Admin cannot create Admin or Super Admin
        elif actor.role == 'ADMIN':
            if target_role in ['ADMIN', 'SUPER_ADMIN']:
                raise serializers.ValidationError({
                    "role": "Admins cannot provision other Admin or Super Admin accounts."
                })

        return data

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request and request.user.is_authenticated else None

        matrix_id = validated_data.pop('matrix_id', None)
        business_id = validated_data.pop('business_id', None)
        department_id = validated_data.pop('department_id', None)
        reports_to_id = validated_data.pop('reports_to_id', None)
        password = validated_data.pop('password', None) or 'TempPass@123'

        # Set default values for mandatory timestamps and shifts
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
        user.set_password(password)

        super_admin = User.objects.filter(role='SUPER_ADMIN', is_active=True).first()

        # -------------------------------------------------------------------------
        # 1. MATRIX ASSIGNMENT & DERIVED ENTITIES
        # -------------------------------------------------------------------------
        if matrix_id and str(matrix_id).lower() not in ['none', 'null', '0']:
            try:
                matrix_obj = BusinessDepartment.objects.select_related('business', 'department', 'supervisor').get(id=matrix_id)
                user.matrix = matrix_obj
                user.business = matrix_obj.business
                user.department = matrix_obj.department

                if user.role == 'EMPLOYEE':
                    # Employee reports to Matrix Incharge if present, otherwise reports to creator or superadmin
                    user.reports_to = matrix_obj.supervisor or actor or super_admin

                elif user.role == 'SUPERVISOR':
                    # Appoint this user as the incharge of the matrix
                    matrix_obj.supervisor = user
                    matrix_obj.save(update_fields=['supervisor'])

                    # Upstream reporting: link supervisor to Business Admin, Dept Admin, Creator, or Super Admin
                    b_admin = User.objects.filter(role='BUSINESS_ADMIN', business=matrix_obj.business, is_active=True).first()
                    d_admin = User.objects.filter(role='DEPT_HEAD', department=matrix_obj.department, is_active=True).first()
                    user.reports_to = b_admin or d_admin or actor or super_admin

                    # Cascade: Re-point any existing matrix base members to this new supervisor
                    matrix_obj.matrix_members.filter(role='EMPLOYEE').update(reports_to=user)

            except BusinessDepartment.DoesNotExist:
                user.matrix = None
        else:
            # -------------------------------------------------------------------------
            # 2. FALLBACK EXPLICIT ENTITIES (Upper tiers or No-Matrix users)
            # -------------------------------------------------------------------------
            user.matrix = None
            if business_id:
                user.business = Business.objects.filter(id=business_id).first()
            if department_id:
                user.department = Department.objects.filter(id=department_id).first()

            # -------------------------------------------------------------------------
            # 3. REPORTING MANAGER RESOLUTION
            # -------------------------------------------------------------------------
            if reports_to_id:
                user.reports_to = User.objects.filter(id=reports_to_id, is_active=True).first()
            elif actor and actor.role == 'SUPERVISOR':
                # Supervisor creating a user always auto-assigns themselves as reports_to
                user.reports_to = actor
            elif actor:
                # Creator Rule: Auto-assign user to the creator if not explicitly specified
                user.reports_to = actor

            # Global Root Rule: If reports_to is still empty and user is not Super Admin, link to Super Admin
            if not user.reports_to and user.role != 'SUPER_ADMIN':
                user.reports_to = super_admin

        # Prevent circular self-reporting
        if user.reports_to and user.reports_to.id == user.id:
            user.reports_to = super_admin if user.role != 'SUPER_ADMIN' else None

        user.save()

        # -------------------------------------------------------------------------
        # 4. UPSTREAM CHAIN CONTINUITY TO SUPER ADMIN
        # -------------------------------------------------------------------------
        # Ensure that whatever manager was linked above also connects to Super Admin
        mgr = user.reports_to
        if mgr and mgr.role != 'SUPER_ADMIN' and not mgr.reports_to and super_admin and mgr.id != super_admin.id:
            mgr.reports_to = super_admin
            mgr.save(update_fields=['reports_to'])

        return user
        


# ==========================================
# 6. PASSWORD RESET SERIALIZERS
# ==========================================
class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)