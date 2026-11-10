# backend/accounts/serializers.py

from datetime import time, date
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import (
    Business,
    Department,
    BusinessDepartment,
    AttendanceRecord,
    PasswordResetOTP,
    SystemAuditLog,
)
from .audit_service import log_system_event

User = get_user_model()

ROLE_HIERARCHY_RANK = {
    'SUPER_ADMIN': 1,
    'ADMIN': 2,
    'BUSINESS_ADMIN': 3,
    'DEPT_HEAD': 3,
    'SUPERVISOR': 4,
    'EMPLOYEE': 5,
}


def parse_nullable_id(val):
    """
    Sanitizes string/null inputs from frontend forms into integer IDs or None.
    Handles '', 'null', 'none', '0', None.
    """
    if val is ...:
        return ...
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ['', 'null', 'none', '0', 'undefined']:
        return None
    try:
        return int(s)
    except (ValueError, TypeError):
        return None


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
        eff_matrix = getattr(user, 'effective_matrix', user.matrix)
        eff_biz = getattr(user, 'effective_business', user.business)
        eff_dept = getattr(user, 'effective_department', user.department)

        # Scoped display names for JWT payload
        if user.role in ['ADMIN', 'SUPER_ADMIN']:
            biz_name_val = "All Businesses"
            dept_name_val = "All Departments"
        elif user.role == 'BUSINESS_ADMIN':
            biz_name_val = eff_biz.name if eff_biz else None
            dept_name_val = "All Departments"
        elif user.role == 'DEPT_HEAD':
            biz_name_val = "All Businesses"
            dept_name_val = eff_dept.name if eff_dept else None
        else:
            biz_name_val = eff_biz.name if eff_biz else None
            dept_name_val = eff_dept.name if eff_dept else None

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name or user.username,
            'email': user.email,
            'role': user.role,
            'designation': getattr(user, 'designation', 'Staff'),
            'employee_code': getattr(user, 'employee_code', ''),
            'matrix_id': eff_matrix.id if eff_matrix else None,
            'matrix_title': str(eff_matrix) if eff_matrix else ('All Matrices' if user.role in ['BUSINESS_ADMIN', 'DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN'] else None),
            'business_id': eff_biz.id if eff_biz else None,
            'business_name': biz_name_val,
            'business_code': eff_biz.code if eff_biz else None,
            'department_id': eff_dept.id if eff_dept else None,
            'department_name': dept_name_val,
            'reports_to_id': user.reports_to_id,
            'reports_to_name': (user.reports_to.full_name or user.reports_to.username) if user.reports_to else None,
            'is_present': getattr(user, 'is_present', False),
            'shift_start_time': str(user.shift_start_time),
            'shift_end_time': str(user.shift_end_time),
            'reminder_enabled': user.reminder_enabled,
            'reminder_time': str(user.reminder_time),
        }
        return data


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Prevents 500 crashes when stale tokens hit the server after DB resets.
    """
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise InvalidToken("User for this session no longer exists. Please log in again.")


class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp_code = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, required=True)

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters long.")
        return value


# ==========================================
# 2. BUSINESS & DEPARTMENT SERIALIZERS (WITH 1-TO-1 INCHARGE GUARDS)
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
        lead = obj.effective_incharge
        if lead:
            name = lead.full_name or lead.username
            if not obj.incharge:
                name += f" ({lead.get_role_display()} Fallback)"
            return name
        return 'Unassigned Lead'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return 'System'

    def get_active_users_count(self, obj):
        return obj.business_users.filter(is_active=True).count()

    def get_active_matrices_count(self, obj):
        return obj.business_departments.filter(is_active=True).count()

    def validate_incharge(self, value):
        if value:
            if value.role not in ['BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN']:
                raise serializers.ValidationError(
                    f"Cannot assign {value.get_role_display()} as Business Incharge. Must be Business Admin, Admin, or Super Admin."
                )
            if value.role == 'BUSINESS_ADMIN':
                conflict = Business.objects.filter(incharge=value, is_active=True)
                if self.instance:
                    conflict = conflict.exclude(pk=self.instance.pk)
                conflicting_biz = conflict.first()
                if conflicting_biz:
                    raise serializers.ValidationError(
                        f"User '{value.username}' is already incharge of '{conflicting_biz.name}'. Relieve them first."
                    )
        return value

    def create(self, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            if 'created_by' not in validated_data and request and request.user:
                validated_data['created_by'] = request.user
            if not validated_data.get('incharge') and request and request.user:
                validated_data['incharge'] = request.user

            return super().create(validated_data)

    def update(self, instance, validated_data):
        with transaction.atomic():
            return super().update(instance, validated_data)


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
        lead = obj.effective_incharge
        if lead:
            name = lead.full_name or lead.username
            if not obj.incharge:
                name += f" ({lead.get_role_display()} Fallback)"
            return name
        return 'Unassigned Lead'

    def get_created_by_name(self, obj):
        if getattr(obj, 'created_by', None):
            return obj.created_by.full_name or obj.created_by.username
        return 'System'

    def get_active_users_count(self, obj):
        return obj.department_users.filter(is_active=True).count()

    def get_active_matrices_count(self, obj):
        return obj.department_businesses.filter(is_active=True).count()

    def validate_incharge(self, value):
        if value:
            if value.role not in ['DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN']:
                raise serializers.ValidationError(
                    f"Cannot assign {value.get_role_display()} as Department Incharge. Must be Department Admin, Admin, or Super Admin."
                )
            if value.role == 'DEPT_HEAD':
                conflict = Department.objects.filter(incharge=value, is_active=True)
                if self.instance:
                    conflict = conflict.exclude(pk=self.instance.pk)
                conflicting_dept = conflict.first()
                if conflicting_dept:
                    raise serializers.ValidationError(
                        f"User '{value.username}' is already incharge of '{conflicting_dept.name}'. Relieve them first."
                    )
        return value

    def create(self, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            if 'created_by' not in validated_data and request and request.user:
                validated_data['created_by'] = request.user
            if not validated_data.get('incharge') and request and request.user:
                validated_data['incharge'] = request.user

            return super().create(validated_data)

    def update(self, instance, validated_data):
        with transaction.atomic():
            return super().update(instance, validated_data)


# ==========================================
# 3. CROSS-MATRIX SERIALIZER (WITH SUPERVISOR CASCADE)
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
            name = lead.full_name or lead.username
            if not obj.supervisor:
                name += f" ({lead.get_role_display()} Fallback)"
            return name
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

    def validate_supervisor(self, value):
        if value:
            if value.role not in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
                raise serializers.ValidationError(
                    f"Matrix Incharge must be Supervisor or higher (cannot be {value.get_role_display()})."
                )
            if value.role == 'SUPERVISOR':
                conflict = BusinessDepartment.objects.filter(supervisor=value, is_active=True)
                if self.instance:
                    conflict = conflict.exclude(pk=self.instance.pk)
                conflicting_matrix = conflict.first()
                if conflicting_matrix:
                    raise serializers.ValidationError(
                        f"Supervisor '{value.username}' is already incharge of matrix '{conflicting_matrix.title}'. Relieve them first."
                    )
        return value

    def update(self, instance, validated_data):
        with transaction.atomic():
            return super().update(instance, validated_data)


# ==========================================
# 4. USER PROFILE & SUBORDINATE SERIALIZERS
# ==========================================
class UserProfileSerializer(serializers.ModelSerializer):
    matrix_title = serializers.SerializerMethodField()
    business_name = serializers.SerializerMethodField()
    business_code = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    dual_reporting_leads = serializers.SerializerMethodField()
    date_of_joining = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'employee_code', 'role',
            'designation', 'phone', 'date_of_joining',
            'matrix', 'matrix_title',
            'business', 'business_name', 'business_code',
            'department', 'department_name',
            'reports_to', 'manager_name', 'dual_reporting_leads',
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
            'reports_to', 'manager_name', 'dual_reporting_leads', 'is_active', 'is_present'
        ]

    def get_date_of_joining(self, obj):
        val = getattr(obj, 'date_of_joining', None)
        if not val:
            return None
        if hasattr(val, 'strftime'):
            return val.strftime('%Y-%m-%d')
        return str(val)

    def get_matrix_title(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
            return 'All Matrices [Executive Access]'
        eff_matrix = getattr(obj, 'effective_matrix', obj.matrix)
        return str(eff_matrix) if eff_matrix else 'No Matrix Assigned'

    def get_business_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']:
            return "All Businesses [Cross-Matrix]"
        eff_biz = getattr(obj, 'effective_business', obj.business)
        return f"{eff_biz.name} ({eff_biz.code})" if eff_biz else None

    def get_business_code(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']:
            return "ALL"
        eff_biz = getattr(obj, 'effective_business', obj.business)
        return eff_biz.code if eff_biz else None

    def get_department_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN']:
            return "All Departments [Cross-Matrix]"
        eff_dept = getattr(obj, 'effective_department', obj.department)
        return eff_dept.name if eff_dept else None

    def get_manager_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN']:
            return 'Global Operations'
        if obj.reports_to:
            return obj.reports_to.full_name or obj.reports_to.username
        return 'Unassigned Lead'

    def get_dual_reporting_leads(self, obj):
        if hasattr(obj, 'get_dual_reporting_leads'):
            return obj.get_dual_reporting_leads()
        return []


class SubordinateUserSerializer(serializers.ModelSerializer):
    matrix_id = serializers.SerializerMethodField()
    matrix_title = serializers.SerializerMethodField()
    business_id = serializers.SerializerMethodField()
    business_name = serializers.SerializerMethodField()
    business_code = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    manager_id = serializers.IntegerField(source='reports_to.id', read_only=True)
    manager_name = serializers.SerializerMethodField()
    dual_reporting_leads = serializers.SerializerMethodField()
    date_of_joining = serializers.SerializerMethodField()

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

    def get_date_of_joining(self, obj):
        val = getattr(obj, 'date_of_joining', None)
        if not val:
            return None
        if hasattr(val, 'strftime'):
            return val.strftime('%Y-%m-%d')
        return str(val)

    def get_matrix_id(self, obj):
        eff_matrix = getattr(obj, 'effective_matrix', obj.matrix)
        return eff_matrix.id if eff_matrix else None

    def get_matrix_title(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
            return 'All Matrices'
        eff_matrix = getattr(obj, 'effective_matrix', obj.matrix)
        return str(eff_matrix) if eff_matrix else 'No Matrix'

    def get_business_id(self, obj):
        eff_biz = getattr(obj, 'effective_business', obj.business)
        return eff_biz.id if eff_biz else None

    def get_business_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']:
            return "All Businesses"
        eff_biz = getattr(obj, 'effective_business', obj.business)
        return f"{eff_biz.name} ({eff_biz.code})" if eff_biz else "No Business"

    def get_business_code(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD']:
            return "ALL"
        eff_biz = getattr(obj, 'effective_business', obj.business)
        return eff_biz.code if eff_biz else None

    def get_department_id(self, obj):
        eff_dept = getattr(obj, 'effective_department', obj.department)
        return eff_dept.id if eff_dept else None

    def get_department_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN']:
            return "All Departments"
        eff_dept = getattr(obj, 'effective_department', obj.department)
        return eff_dept.name if eff_dept else "No Department"

    def get_manager_name(self, obj):
        if obj.role in ['ADMIN', 'SUPER_ADMIN']:
            return 'Global Operations'
        if obj.reports_to:
            return obj.reports_to.full_name or obj.reports_to.username
        return 'Unassigned Lead'

    def get_dual_reporting_leads(self, obj):
        if hasattr(obj, 'get_dual_reporting_leads'):
            return obj.get_dual_reporting_leads()
        return []


# ==========================================
# 5. USER CREATION & EDIT SERIALIZERS (WITH AUDIT HOOKS)
# ==========================================
class UserCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    matrix_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    business_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    department_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    reports_to_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    date_of_joining = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'full_name', 'phone',
            'role', 'designation', 'date_of_joining',
            'matrix_id', 'business_id', 'department_id', 'reports_to_id',
            'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
            'self_idle_timer_start', 'team_idle_timer_start'
        ]

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError("A user account with this email address already exists.")
        return val

    def validate(self, attrs):
        request = self.context.get('request')
        actor = request.user if request else None
        target_role = attrs.get('role', 'EMPLOYEE')

        if actor:
            actor_rank = ROLE_HIERARCHY_RANK.get(actor.role, 99)
            target_rank = ROLE_HIERARCHY_RANK.get(target_role, 99)

            # Strict hierarchy: You can only create roles of strictly LOWER tier
            if actor.role != 'SUPER_ADMIN' and target_rank <= actor_rank:
                raise serializers.ValidationError({
                    'role': f"You cannot create users with equal or higher role tier ({target_role})."
                })

            if actor.role == 'SUPERVISOR':
                if target_role != 'EMPLOYEE':
                    raise serializers.ValidationError({'role': 'Supervisors can only provision base Employee accounts.'})
                attrs['matrix_id'] = actor.matrix_id

            elif actor.role == 'BUSINESS_ADMIN':
                if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                    raise serializers.ValidationError({'role': 'Business Admins can only provision Supervisors or Employees.'})
                attrs['business_id'] = actor.business_id

            elif actor.role == 'DEPT_HEAD':
                if target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                    raise serializers.ValidationError({'role': 'Department Heads can only provision Supervisors or Employees.'})
                attrs['department_id'] = actor.department_id

            elif actor.role == 'ADMIN':
                if target_role in ['ADMIN', 'SUPER_ADMIN']:
                    raise serializers.ValidationError({'role': 'Admins cannot provision other Admin or Super Admin accounts.'})

        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            actor = getattr(request, 'user', None)

            password = validated_data.pop('password', None) or 'TempPass@123'
            raw_matrix = validated_data.pop('matrix_id', None)
            raw_biz = validated_data.pop('business_id', None)
            raw_dept = validated_data.pop('department_id', None)
            raw_reports = validated_data.pop('reports_to_id', None)

            matrix_id = parse_nullable_id(raw_matrix)
            business_id = parse_nullable_id(raw_biz)
            department_id = parse_nullable_id(raw_dept)
            reports_to_id = parse_nullable_id(raw_reports)

            # Fallback to local date if omitted
            if not validated_data.get('date_of_joining'):
                validated_data['date_of_joining'] = timezone.localdate()

            user = User(**validated_data)
            user.set_password(password)

            super_admin = User.objects.filter(role='SUPER_ADMIN', is_active=True).first()
            target_role = user.role

            # CASE A: BASE EMPLOYEE
            if target_role == 'EMPLOYEE':
                if matrix_id:
                    matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                        'business', 'department', 'supervisor'
                    ).first()
                    if matrix_obj:
                        user.matrix = matrix_obj
                        user.business = matrix_obj.business
                        user.department = matrix_obj.department
                        user.reports_to = matrix_obj.effective_incharge or super_admin
                    else:
                        user.matrix = None
                        user.business = None
                        user.department = None
                        user.reports_to = super_admin
                else:
                    user.matrix = None
                    user.business = None
                    user.department = None
                    user.reports_to = super_admin

            # CASE B: SUPERVISOR
            elif target_role == 'SUPERVISOR':
                if matrix_id:
                    matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                        'business', 'department'
                    ).first()
                    if matrix_obj:
                        user.matrix = matrix_obj
                        user.business = matrix_obj.business
                        user.department = matrix_obj.department

                        b_admin = User.objects.filter(role='BUSINESS_ADMIN', business=matrix_obj.business, is_active=True).first()
                        d_admin = User.objects.filter(role='DEPT_HEAD', department=matrix_obj.department, is_active=True).first()
                        user.reports_to = b_admin or d_admin or super_admin

                        user.save()

                        # Bi-directional sync: Appoint supervisor on matrix
                        matrix_obj.supervisor = user
                        matrix_obj.save(update_fields=['supervisor'])
                        matrix_obj.matrix_members.filter(role='EMPLOYEE').update(reports_to=user)

                        # Emit audit log
                        log_system_event(
                            actor=actor,
                            action_type='USER_CREATED',
                            module='USER',
                            target_user=user,
                            entity_id=user.id,
                            entity_name=user.username,
                            new_values={'role': user.role, 'matrix_id': matrix_obj.id, 'designation': user.designation},
                            remarks=f"Provisioned supervisor account for {user.username} on matrix {str(matrix_obj)}",
                            request=request
                        )
                        return user
                else:
                    user.matrix = None
                    user.business = None
                    user.department = None
                    user.reports_to = super_admin

            # CASE C: BUSINESS ADMIN
            elif target_role == 'BUSINESS_ADMIN':
                user.matrix = None
                user.department = None
                user.reports_to = super_admin

                if business_id:
                    biz = Business.objects.filter(id=business_id).first()
                    user.business = biz
                    user.save()

                    if biz:
                        Business.objects.filter(incharge=user).exclude(pk=biz.pk).update(incharge=None)
                        biz.incharge = user
                        biz.save(update_fields=['incharge'])

                    log_system_event(
                        actor=actor,
                        action_type='USER_CREATED',
                        module='USER',
                        target_user=user,
                        entity_id=user.id,
                        entity_name=user.username,
                        new_values={'role': user.role, 'business_id': biz.id if biz else None},
                        remarks=f"Provisioned Business Admin for {user.username}",
                        request=request
                    )
                    return user
                else:
                    user.business = None
                    user.save()

            # CASE D: DEPARTMENT ADMIN (DEPARTMENT HEAD)
            elif target_role == 'DEPT_HEAD':
                user.matrix = None
                user.business = None
                user.reports_to = super_admin

                if department_id:
                    dept = Department.objects.filter(id=department_id).first()
                    user.department = dept
                    user.save()

                    if dept:
                        Department.objects.filter(incharge=user).exclude(pk=dept.pk).update(incharge=None)
                        dept.incharge = user
                        dept.save(update_fields=['incharge'])

                    log_system_event(
                        actor=actor,
                        action_type='USER_CREATED',
                        module='USER',
                        target_user=user,
                        entity_id=user.id,
                        entity_name=user.username,
                        new_values={'role': user.role, 'department_id': dept.id if dept else None},
                        remarks=f"Provisioned Dept Head for {user.username}",
                        request=request
                    )
                    return user
                else:
                    user.department = None
                    user.save()

            # CASE E: ADMIN / SUPER ADMIN
            else:
                user.matrix = None
                user.business = None
                user.department = None
                user.reports_to = super_admin if target_role == 'ADMIN' else None

            user.save()

            # Central audit logging dispatch
            log_system_event(
                actor=actor,
                action_type='USER_CREATED',
                module='USER',
                target_user=user,
                entity_id=user.id,
                entity_name=user.username,
                new_values={
                    'role': user.role,
                    'designation': user.designation,
                    'matrix_id': user.matrix_id,
                    'business_id': user.business_id,
                    'department_id': user.department_id,
                    'reports_to_id': user.reports_to_id,
                },
                remarks=f"Provisioned account for {user.username} with role {user.role}",
                request=request
            )
            return user


class UserUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    matrix_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    business_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    department_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    reports_to_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    date_of_joining = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'role', 'designation', 'date_of_joining',
            'matrix_id', 'business_id', 'department_id', 'reports_to_id',
            'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
            'self_idle_timer_start', 'team_idle_timer_start', 'is_active'
        ]
        read_only_fields = ['id', 'username']

    def validate_email(self, value):
        if not value:
            return self.instance.email
        val = value.strip().lower()
        existing = User.objects.filter(email__iexact=val).exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A user account with this email address already exists.")
        return val

    def validate(self, attrs):
        request = self.context.get('request')
        actor = request.user if request else None

        if actor and 'role' in attrs:
            target_role = attrs.get('role')
            actor_rank = ROLE_HIERARCHY_RANK.get(actor.role, 99)
            target_rank = ROLE_HIERARCHY_RANK.get(target_role, 99)

            # Prevent promoting someone to actor's tier or higher
            if actor.role != 'SUPER_ADMIN' and target_rank <= actor_rank:
                raise serializers.ValidationError({
                    'role': f"You cannot elevate a user to your own or higher role tier ({target_role})."
                })

            if actor.role == 'SUPERVISOR' and target_role != 'EMPLOYEE':
                raise serializers.ValidationError({'role': 'Supervisors can only assign EMPLOYEE role.'})
            elif actor.role in ['BUSINESS_ADMIN', 'DEPT_HEAD'] and target_role not in ['SUPERVISOR', 'EMPLOYEE']:
                raise serializers.ValidationError({'role': 'Business and Department Admins can only assign Supervisor or Employee roles.'})

        return attrs

    def update(self, instance, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            actor = getattr(request, 'user', None)

            # Snapshot previous state for audit log
            old_values = {
                'role': instance.role,
                'designation': instance.designation,
                'matrix_id': instance.matrix_id,
                'business_id': instance.business_id,
                'department_id': instance.department_id,
                'reports_to_id': instance.reports_to_id,
                'is_active': instance.is_active,
            }

            has_matrix = 'matrix_id' in validated_data
            has_biz = 'business_id' in validated_data
            has_dept = 'department_id' in validated_data
            has_reports = 'reports_to_id' in validated_data

            raw_matrix = validated_data.pop('matrix_id', ...)
            raw_biz = validated_data.pop('business_id', ...)
            raw_dept = validated_data.pop('department_id', ...)
            raw_reports = validated_data.pop('reports_to_id', ...)

            matrix_id = parse_nullable_id(raw_matrix) if has_matrix else ...
            business_id = parse_nullable_id(raw_biz) if has_biz else ...
            department_id = parse_nullable_id(raw_dept) if has_dept else ...
            reports_to_id = parse_nullable_id(raw_reports) if has_reports else ...

            # Preserve existing joining date if not explicitly passed
            if 'date_of_joining' not in validated_data:
                validated_data['date_of_joining'] = instance.date_of_joining

            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            super_admin = User.objects.filter(role='SUPER_ADMIN', is_active=True).first()
            target_role = instance.role

            # -----------------------------------------------------------
            # CASE A: BASE EMPLOYEE
            # -----------------------------------------------------------
            if target_role == 'EMPLOYEE':
                if matrix_id is not ...:
                    if matrix_id:
                        matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                            'business', 'department', 'supervisor'
                        ).first()
                        if matrix_obj:
                            instance.matrix = matrix_obj
                            instance.business = matrix_obj.business
                            instance.department = matrix_obj.department
                            instance.reports_to = matrix_obj.effective_incharge or super_admin
                        else:
                            instance.matrix = None
                            instance.business = None
                            instance.department = None
                            instance.reports_to = super_admin
                    else:
                        instance.matrix = None
                        instance.business = None
                        instance.department = None
                        instance.reports_to = super_admin

            # -----------------------------------------------------------
            # CASE B: SUPERVISOR
            # -----------------------------------------------------------
            elif target_role == 'SUPERVISOR':
                if matrix_id is not ...:
                    old_matrix = BusinessDepartment.objects.filter(supervisor=instance).first()

                    if matrix_id:
                        matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related(
                            'business', 'department'
                        ).first()
                        if matrix_obj:
                            if old_matrix and old_matrix.id != matrix_obj.id:
                                old_matrix.supervisor = None
                                old_matrix.save(update_fields=['supervisor'])

                            matrix_obj.supervisor = instance
                            matrix_obj.save(update_fields=['supervisor'])

                            instance.matrix = matrix_obj
                            instance.business = matrix_obj.business
                            instance.department = matrix_obj.department

                            b_admin = User.objects.filter(role='BUSINESS_ADMIN', business=matrix_obj.business, is_active=True).first()
                            d_admin = User.objects.filter(role='DEPT_HEAD', department=matrix_obj.department, is_active=True).first()
                            instance.reports_to = b_admin or d_admin or super_admin

                            matrix_obj.matrix_members.filter(role='EMPLOYEE').update(reports_to=instance)
                    else:
                        BusinessDepartment.objects.filter(supervisor=instance).update(supervisor=None)
                        instance.matrix = None
                        instance.business = None
                        instance.department = None
                        instance.reports_to = super_admin

            # -----------------------------------------------------------
            # CASE C: BUSINESS ADMIN
            # -----------------------------------------------------------
            elif target_role == 'BUSINESS_ADMIN':
                instance.matrix = None
                instance.department = None
                instance.reports_to = super_admin

                if business_id is not ...:
                    if business_id:
                        biz = Business.objects.filter(id=business_id).first()
                        instance.business = biz
                        if biz:
                            Business.objects.filter(incharge=instance).exclude(pk=biz.pk).update(incharge=None)
                            biz.incharge = instance
                            biz.save(update_fields=['incharge'])
                    else:
                        Business.objects.filter(incharge=instance).update(incharge=None)
                        instance.business = None

            # -----------------------------------------------------------
            # CASE D: DEPARTMENT ADMIN
            # -----------------------------------------------------------
            elif target_role == 'DEPT_HEAD':
                instance.matrix = None
                instance.business = None
                instance.reports_to = super_admin

                if department_id is not ...:
                    if department_id:
                        dept = Department.objects.filter(id=department_id).first()
                        instance.department = dept
                        if dept:
                            Department.objects.filter(incharge=instance).exclude(pk=dept.pk).update(incharge=None)
                            dept.incharge = instance
                            dept.save(update_fields=['incharge'])
                    else:
                        Department.objects.filter(incharge=instance).update(incharge=None)
                        instance.department = None

            # -----------------------------------------------------------
            # CASE E: ADMIN / SUPER ADMIN
            # -----------------------------------------------------------
            else:
                instance.matrix = None
                instance.business = None
                instance.department = None
                instance.reports_to = super_admin if target_role == 'ADMIN' else None

            instance.save()

            # Snapshot new state and emit audit log
            new_values = {
                'role': instance.role,
                'designation': instance.designation,
                'matrix_id': instance.matrix_id,
                'business_id': instance.business_id,
                'department_id': instance.department_id,
                'reports_to_id': instance.reports_to_id,
                'is_active': instance.is_active,
            }

            log_system_event(
                actor=actor,
                action_type='USER_UPDATED',
                module='USER',
                target_user=instance,
                entity_id=instance.id,
                entity_name=instance.username,
                old_values=old_values,
                new_values=new_values,
                remarks=f"Updated user profile and settings for {instance.username}",
                request=request
            )

            return instance