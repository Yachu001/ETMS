from datetime import time
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Business, Department, UserDepartment, UserReporting, PasswordResetOTP

User = get_user_model()


# ==========================================
# 1. JWT CUSTOM CLAIMS SERIALIZER
# ==========================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds user role, full name, employee code, and primary business/dept into JWT."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['full_name'] = user.full_name or user.username
        token['email'] = user.email
        token['role'] = user.role
        token['designation'] = user.designation
        token['employee_code'] = user.employee_code
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'full_name': self.user.full_name or self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'designation': self.user.designation,
            'employee_code': self.user.employee_code,
        }
        return data


# ==========================================
# 2. ENTITY SERIALIZERS
# ==========================================
class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ['id', 'name', 'code', 'is_active']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'parent', 'created_at']


# ==========================================
# 3. USER PROFILE SERIALIZER (Self / Cockpit)
# ==========================================
# class UserProfileSerializer(serializers.ModelSerializer):
#     """Complete profile view including shift boundaries, businesses, and departments."""
#     businesses = BusinessSerializer(many=True, read_only=True)
#     departments = serializers.SerializerMethodField()
#     primary_department = serializers.SerializerMethodField()
#     primary_manager = serializers.SerializerMethodField()
#     is_present = serializers.BooleanField(read_only=True)

#     class Meta:
#         model = User
#         fields = [
#             'id', 'username', 'email', 'full_name', 'phone', 'employee_code',
#             'role', 'designation', 'date_of_joining', 'is_active', 'is_present',
#             'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
#             'businesses', 'departments', 'primary_department', 'primary_manager'
#         ]
#         read_only_fields = ['id', 'role', 'employee_code', 'is_present']

#     def get_departments(self, obj):
#         mappings = obj.user_departments.select_related('department').all()
#         return [
#             {
#                 'id': m.department.id,
#                 'name': m.department.name,
#                 'is_primary': m.is_primary
#             }
#             for m in mappings
#         ]

#     def get_primary_department(self, obj):
#         mapping = obj.user_departments.filter(is_primary=True).select_related('department').first()
#         return mapping.department.name if mapping else "No Department"

#     def get_primary_manager(self, obj):
#         reporting = obj.reporting_assignments.filter(is_primary=True).select_related('manager').first()
#         return reporting.manager.username if reporting else "None"

class UserProfileSerializer(serializers.ModelSerializer):
    businesses = serializers.SerializerMethodField()
    departments = serializers.SerializerMethodField()
    reporting_managers = serializers.SerializerMethodField()
    is_present = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone', 'employee_code',
            'role', 'designation', 'date_of_joining', 'is_active', 'is_present',
            'shift_start_time', 'shift_end_time', 'reminder_enabled', 'reminder_time',
            'businesses', 'departments', 'reporting_managers'
        ]
        read_only_fields = ['id', 'role', 'employee_code', 'is_present']

    def get_departments(self, obj):
        mappings = list(obj.user_departments.select_related('department').all())
        # If only one department exists, treat it as primary
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

    def get_businesses(self, obj):
        biz_list = list(obj.businesses.all())
        single = len(biz_list) == 1
        # If single business, tag as primary; otherwise first or explicit flag
        return [
            {
                'id': b.id,
                'name': b.name,
                'code': b.code,
                'is_primary': single or (index == 0) # Fallback to first as primary if unassigned
            }
            for index, b in enumerate(biz_list)
        ]

# ==========================================
# 4. SUBORDINATE / ROSTER SERIALIZER
# ==========================================
class SubordinateUserSerializer(serializers.ModelSerializer):
    """Used for employee management tables and subordinate lists."""
    businesses = BusinessSerializer(many=True, read_only=True)
    primary_department = serializers.SerializerMethodField()
    primary_department_id = serializers.SerializerMethodField()
    primary_manager = serializers.SerializerMethodField()
    primary_manager_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'phone',
            'employee_code', 'role', 'designation', 'date_of_joining',
            'shift_start_time', 'shift_end_time', 'is_active',
            'businesses', 'primary_department', 'primary_department_id',
            'primary_manager', 'primary_manager_id'
        ]

    def get_primary_department(self, obj):
        mapping = obj.user_departments.filter(is_primary=True).select_related('department').first()
        return mapping.department.name if mapping else "No Department"

    def get_primary_department_id(self, obj):
        mapping = obj.user_departments.filter(is_primary=True).first()
        return mapping.department_id if mapping else None

    def get_primary_manager(self, obj):
        reporting = obj.reporting_assignments.filter(is_primary=True).select_related('manager').first()
        return reporting.manager.username if reporting else "None"

    def get_primary_manager_id(self, obj):
        reporting = obj.reporting_assignments.filter(is_primary=True).first()
        return reporting.manager_id if reporting else None


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

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'password', 'role', 'designation', 'date_of_joining',
            'shift_start_time', 'shift_end_time', 'department_id',
            'business_ids', 'reports_to_id'
        ]
    def validate(self, data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        target_role = data.get('role', 'EMPLOYEE')
        reports_to_id = data.get('reports_to_id')

        # Prevent assigning any user to report to a Base Employee
        if reports_to_id:
            manager = User.objects.filter(id=reports_to_id).first()
            if manager and manager.role == 'EMPLOYEE':
                raise serializers.ValidationError({
                    "reports_to_id": "Base employees cannot be designated as reporting managers."
                })

        if not actor or not actor.is_authenticated:
            return data

        if actor.is_supervisor_user:
            if target_role != 'EMPLOYEE':
                raise serializers.ValidationError({
                    "role": "Supervisors are only authorized to create standard Employee accounts."
                })
        elif actor.role == 'ADMIN':
            if target_role in ['ADMIN', 'SUPER_ADMIN']:
                raise serializers.ValidationError({
                    "role": "Admins cannot provision or create other Admin or Super Admin accounts."
                })

        return data
    

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

        # Create base user
        user = User.objects.create(**validated_data)
        user.set_password(raw_password)
        user.save()

        # 3. Department Resolution & Fallback ("No Department")
        target_dept = None
        if dept_id:
            target_dept = Department.objects.filter(id=dept_id).first()

        # If supervisor creates without specifying, copy supervisor's primary department
        if not target_dept and actor and actor.is_supervisor_user:
            sup_dept = UserDepartment.objects.filter(user=actor, is_primary=True).first()
            if sup_dept:
                target_dept = sup_dept.department

        # If still None (e.g., Admin created with no selection), assign to "No Department"
        if not target_dept:
            target_dept, _ = Department.objects.get_or_create(
                name="No Department",
                defaults={'parent': None}
            )

        UserDepartment.objects.create(user=user, department=target_dept, is_primary=True)

        # 4. Business Resolution & Fallback ("No Business")
        if business_ids:
            businesses = Business.objects.filter(id__in=business_ids)
            user.businesses.set(businesses)
        else:
            # Fallback for Supervisor: inherit supervisor's businesses if available
            if actor and actor.is_supervisor_user and actor.businesses.exists():
                user.businesses.set(actor.businesses.all())
            else:
                default_biz, _ = Business.objects.get_or_create(
                    name="No Business",
                    defaults={'code': 'NONE', 'is_active': True}
                )
                user.businesses.add(default_biz)

        # 5. Reporting Manager Resolution & Fallback
        if actor and actor.is_supervisor_user:
            UserReporting.objects.create(employee=user, manager=actor, is_primary=True)
        elif actor and actor.role in ['ADMIN', 'SUPER_ADMIN']:
            target_manager = None
            if reports_to_id:
                target_manager = User.objects.filter(id=reports_to_id).first()

            # If no manager was selected, report directly to the creator
            if not target_manager:
                target_manager = actor

            if target_manager and target_manager.id != user.id:
                UserReporting.objects.create(employee=user, manager=target_manager, is_primary=True)

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