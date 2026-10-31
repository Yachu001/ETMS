# backend/accounts/serializers.py

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    Business,
    Department,
    BusinessDepartment,
    AttendanceRecord,
    PasswordResetOTP,
    SystemAuditLog,
)

User = get_user_model()


# ==========================================
# 1. AUTH & JWT SERIALIZERS
# ==========================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['full_name'] = user.full_name or user.username
        token['employee_code'] = getattr(user, 'employee_code', '')
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name or user.username,
            'email': user.email,
            'role': user.role,
            'designation': getattr(user, 'designation', 'Staff'),
            'employee_code': getattr(user, 'employee_code', ''),
            'matrix_id': user.matrix_id,
            'matrix_title': str(user.matrix) if user.matrix else None,
            'business_id': user.business_id,
            'business_name': user.business.name if user.business else None,
            'business_code': user.business.code if user.business else None,
            'department_id': user.department_id,
            'department_name': user.department.name if user.department else None,
            'reports_to_id': user.reports_to_id,
            'reports_to_name': (user.reports_to.full_name or user.reports_to.username) if user.reports_to else None,
            'is_present': getattr(user, 'is_present', False),
            'shift_start_time': str(user.shift_start_time),
            'shift_end_time': str(user.shift_end_time),
            'reminder_enabled': user.reminder_enabled,
            'reminder_time': str(user.reminder_time),
        }
        return data


class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp_code = serializers.CharField(max_length=6, min_length=6, required=True)
    new_password = serializers.CharField(write_only=True, required=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


# ==========================================
# 2. BUSINESS & DEPARTMENT SERIALIZERS
# ==========================================
class BusinessSerializer(serializers.ModelSerializer):
    incharge_id = serializers.PrimaryKeyRelatedField(
        source='incharge',
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    incharge_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    active_users_count = serializers.SerializerMethodField()
    active_matrices_count = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'code', 'description', 'is_active', 'created_at',
            'incharge', 'incharge_id', 'incharge_name',
            'created_by', 'created_by_name',
            'active_users_count', 'active_matrices_count'
        ]
        read_only_fields = [
            'id', 'created_at', 'created_by', 'created_by_name',
            'incharge_name', 'active_users_count', 'active_matrices_count'
        ]

    def get_incharge_name(self, obj):
        if obj.incharge:
            return obj.incharge.full_name or obj.incharge.username
        return 'Unassigned Lead'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return 'System'

    def get_active_users_count(self, obj):
        return obj.business_users.filter(is_active=True).count()

    def get_active_matrices_count(self, obj):
        return obj.business_departments.filter(is_active=True).count()


class DepartmentSerializer(serializers.ModelSerializer):
    incharge_id = serializers.PrimaryKeyRelatedField(
        source='incharge',
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    incharge_name = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    active_users_count = serializers.SerializerMethodField()
    active_matrices_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'parent', 'parent_name', 'is_active', 'created_at',
            'incharge', 'incharge_id', 'incharge_name',
            'created_by', 'created_by_name',
            'active_users_count', 'active_matrices_count'
        ]
        read_only_fields = [
            'id', 'created_at', 'created_by', 'created_by_name',
            'incharge_name', 'parent_name', 'active_users_count', 'active_matrices_count'
        ]

    def get_incharge_name(self, obj):
        if getattr(obj, 'incharge', None):
            return obj.incharge.full_name or obj.incharge.username
        return 'Unassigned Lead'

    def get_created_by_name(self, obj):
        if getattr(obj, 'created_by', None):
            return obj.created_by.full_name or obj.created_by.username
        return 'System'

    def get_active_users_count(self, obj):
        return obj.department_users.filter(is_active=True).count()

    def get_active_matrices_count(self, obj):
        return obj.department_businesses.filter(is_active=True).count()


# ==========================================
# 3. CROSS-MATRIX (BUSINESS-DEPARTMENT) SERIALIZER
# ==========================================
class BusinessDepartmentSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_code = serializers.CharField(source='business.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)

    supervisor_id = serializers.PrimaryKeyRelatedField(
        source='supervisor',
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    supervisor_name = serializers.SerializerMethodField()
    supervisor_role = serializers.CharField(source='supervisor.role', read_only=True)

    title = serializers.SerializerMethodField()
    assigned_members_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = BusinessDepartment
        fields = [
            'id', 'title',
            'business', 'business_name', 'business_code',
            'department', 'department_name', 'department_code',
            'supervisor', 'supervisor_id', 'supervisor_name', 'supervisor_role',
            'is_active', 'created_at', 'assigned_members_count', 'members'
        ]
        read_only_fields = [
            'id', 'title', 'created_at',
            'business_name', 'business_code',
            'department_name', 'department_code',
            'supervisor_name', 'supervisor_role',
            'assigned_members_count', 'members'
        ]

    def get_title(self, obj):
        return f"{obj.business.code} - {obj.department.name}"

    def get_supervisor_name(self, obj):
        lead = obj.effective_incharge
        if lead:
            return lead.full_name or lead.username
        return 'Unassigned Lead'

    def get_assigned_members_count(self, obj):
        return obj.matrix_members.filter(is_active=True, role='EMPLOYEE').count()

    def get_members(self, obj):
        return [
            {
                'id': u.id,
                'username': u.username,
                'name': u.full_name or u.username,
                'employee_code': getattr(u, 'employee_code', None) or f"EID{u.id:02d}",
                'designation': u.designation or 'Staff',
                'is_present': getattr(u, 'is_present', False)
            }
            for u in obj.matrix_members.filter(role='EMPLOYEE', is_active=True).order_by('full_name', 'username')
        ]


# ==========================================
# 4. USER PROFILE & SUBORDINATE SERIALIZERS
# ==========================================
class UserProfileSerializer(serializers.ModelSerializer):
    matrix_title = serializers.SerializerMethodField()
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_code = serializers.CharField(source='business.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'employee_code', 'role',
            'designation', 'phone', 'date_of_joining',
            'matrix', 'matrix_title',
            'business', 'business_name', 'business_code',
            'department', 'department_name',
            'reports_to', 'manager_name',
            'shift_start_time', 'shift_end_time',
            'reminder_enabled', 'reminder_time',
            'self_idle_timer_start', 'team_idle_timer_start',
            'is_active', 'is_present'
        ]
        read_only_fields = [
            'id', 'username', 'employee_code', 'role',
            'matrix', 'matrix_title',
            'business', 'business_name', 'business_code',
            'department', 'department_name',
            'reports_to', 'manager_name', 'is_active', 'is_present'
        ]

    def get_matrix_title(self, obj):
        return str(obj.matrix) if obj.matrix else 'No Matrix'

    def get_manager_name(self, obj):
        if obj.reports_to:
            return obj.reports_to.full_name or obj.reports_to.username
        return 'Unassigned Lead'


class SubordinateUserSerializer(serializers.ModelSerializer):
    matrix_id = serializers.IntegerField(source='matrix.id', read_only=True)
    matrix_title = serializers.SerializerMethodField()
    business_id = serializers.IntegerField(source='business.id', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_code = serializers.CharField(source='business.code', read_only=True)
    department_id = serializers.IntegerField(source='department.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    manager_id = serializers.IntegerField(source='reports_to.id', read_only=True)
    manager_name = serializers.SerializerMethodField()
    dual_reporting_leads = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'employee_code', 'role',
            'designation', 'phone', 'date_of_joining',
            'matrix_id', 'matrix_title',
            'business_id', 'business_name', 'business_code',
            'department_id', 'department_name',
            'manager_id', 'manager_name',
            'dual_reporting_leads',
            'shift_start_time', 'shift_end_time',
            'self_idle_timer_start', 'team_idle_timer_start',
            'reminder_enabled', 'reminder_time',
            'is_active', 'is_present'
        ]

    def get_matrix_title(self, obj):
        return str(obj.matrix) if obj.matrix else 'No Matrix'

    def get_manager_name(self, obj):
        if obj.reports_to:
            return obj.reports_to.full_name or obj.reports_to.username
        return 'Unassigned Lead'

    def get_dual_reporting_leads(self, obj):
        if hasattr(obj, 'get_dual_reporting_leads'):
            return obj.get_dual_reporting_leads()
        return []


# ==========================================
# 5. BI-DIRECTIONAL USER CREATION SERIALIZER
# ==========================================
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    matrix_id = serializers.IntegerField(required=False, allow_null=True)
    business_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    reports_to_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'full_name', 'phone',
            'role', 'designation', 'date_of_joining',
            'matrix_id', 'business_id', 'department_id', 'reports_to_id',
            'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
            'self_idle_timer_start', 'team_idle_timer_start'
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        actor = request.user if request else None
        target_role = attrs.get('role', 'EMPLOYEE')

        if actor:
            if actor.role == 'SUPERVISOR':
                if target_role != 'EMPLOYEE':
                    raise serializers.ValidationError({'role': 'Supervisors can only create base Employee accounts.'})
                attrs['matrix_id'] = actor.matrix_id

            elif actor.role == 'BUSINESS_ADMIN':
                if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                    raise serializers.ValidationError({'role': 'Business Admins can only create Supervisors or Employees.'})
                attrs['business_id'] = actor.business_id

            elif actor.role == 'DEPT_HEAD':
                if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                    raise serializers.ValidationError({'role': 'Department Heads can only create Supervisors or Employees.'})
                attrs['department_id'] = actor.department_id

            elif actor.role == 'ADMIN':
                if target_role in ['ADMIN', 'SUPER_ADMIN']:
                    raise serializers.ValidationError({'role': 'Only Super Admins can provision Admin accounts.'})

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        actor = request.user if request else None

        password = validated_data.pop('password')
        matrix_id = validated_data.pop('matrix_id', None)
        business_id = validated_data.pop('business_id', None)
        department_id = validated_data.pop('department_id', None)
        reports_to_id = validated_data.pop('reports_to_id', None)

        user = User(**validated_data)
        user.set_password(password)

        super_admin = User.objects.filter(role='SUPER_ADMIN', is_active=True).first()
        target_role = user.role

        # -----------------------------------------------------------
        # CASE A: BASE EMPLOYEE (STRICT MATRIX-FIRST AUTO RESOLUTION)
        # -----------------------------------------------------------
        if target_role == 'EMPLOYEE':
            if matrix_id and str(matrix_id).lower() not in ['none', 'null', '0']:
                matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                    'business', 'department', 'supervisor'
                ).first()
                if matrix_obj:
                    user.matrix = matrix_obj
                    user.business = matrix_obj.business
                    user.department = matrix_obj.department
                    user.reports_to = matrix_obj.effective_incharge
                else:
                    user.matrix = None
                    user.business = None
                    user.department = None
                    user.reports_to = None
            else:
                user.matrix = None
                user.business = None
                user.department = None
                user.reports_to = None

        # -----------------------------------------------------------
        # CASE B: SUPERVISOR (APPOINTED AS MATRIX INCHARGE)
        # -----------------------------------------------------------
        elif target_role == 'SUPERVISOR':
            if matrix_id and str(matrix_id).lower() not in ['none', 'null', '0']:
                matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                    'business', 'department'
                ).first()
                if matrix_obj:
                    user.matrix = matrix_obj
                    user.business = matrix_obj.business
                    user.department = matrix_obj.department

                    # Upstream direct reporting line: Business Admin or Department Admin
                    b_admin = User.objects.filter(role='BUSINESS_ADMIN', business=matrix_obj.business, is_active=True).first()
                    d_admin = User.objects.filter(role='DEPT_HEAD', department=matrix_obj.department, is_active=True).first()
                    user.reports_to = b_admin or d_admin or super_admin

                    user.save()

                    # Bi-directional sync: Update the matrix incharge and point existing members to this supervisor
                    matrix_obj.supervisor = user
                    matrix_obj.save(update_fields=['supervisor'])
                    matrix_obj.matrix_members.filter(role='EMPLOYEE').update(reports_to=user)
                    return user
            else:
                user.matrix = None
                user.business = None
                user.department = None
                user.reports_to = super_admin

        # -----------------------------------------------------------
        # CASE C: BUSINESS ADMIN (STRICT SINGLE BUSINESS JURISDICTION)
        # -----------------------------------------------------------
        elif target_role == 'BUSINESS_ADMIN':
            user.matrix = None
            user.department = None
            user.reports_to = super_admin

            if business_id:
                biz = Business.objects.filter(id=business_id).first()
                user.business = biz
                user.save()

                # Bi-directional sync: If the business has no incharge, auto-bind this user
                if biz and not biz.incharge:
                    biz.incharge = user
                    biz.save(update_fields=['incharge'])
                return user

        # -----------------------------------------------------------
        # CASE D: DEPARTMENT ADMIN (STRICT SINGLE DEPARTMENT JURISDICTION)
        # -----------------------------------------------------------
        elif target_role == 'DEPT_HEAD':
            user.matrix = None
            user.business = None
            user.reports_to = super_admin

            if department_id:
                dept = Department.objects.filter(id=department_id).first()
                user.department = dept
                user.save()

                # Bi-directional sync: If the department has no incharge, auto-bind this user
                if dept and not dept.incharge:
                    dept.incharge = user
                    dept.save(update_fields=['incharge'])
                return user

        # -----------------------------------------------------------
        # CASE E: ADMIN / SUPER ADMIN (ORGANIZATION-WIDE JURISDICTION)
        # -----------------------------------------------------------
        else:
            user.matrix = None
            user.business = None
            user.department = None
            user.reports_to = super_admin if target_role == 'ADMIN' else None

        user.save()
        return user