from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Department, UserDepartment, UserReporting

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds user role and designation into the JWT claims and response."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = user.role
        token['designation'] = user.designation
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'designation': self.user.designation,
        }
        return data


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'parent', 'created_at']


class UserProfileSerializer(serializers.ModelSerializer):
    departments = DepartmentSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'designation',
            'reminder_enabled', 'reminder_time', 'departments'
        ]
        read_only_fields = ['id', 'role']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    department_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'role', 'designation', 'department_id']

    def validate(self, data):
        request = self.context.get('request')
        target_role = data.get('role', 'EMPLOYEE')

        # RBAC Creation Scope Rules:
        # 1. Super Admin -> Can create all roles
        # 2. Admin -> Can create Supervisors and Employees
        # 3. Supervisor -> Can strictly create Employees
        if request.user.is_supervisor_user:
            if target_role != 'EMPLOYEE':
                raise serializers.ValidationError({"role": "Supervisors can only create standard Employee accounts."})
        elif not request.user.is_super_admin and target_role in ['SUPER_ADMIN', 'ADMIN']:
            raise serializers.ValidationError({"role": "Only Super Admins can provision Admin accounts."})
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        dept_id = validated_data.pop('department_id', None)
        password = validated_data.pop('password', 'TempPass@123')

        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        if dept_id:
            dept = Department.objects.get(id=dept_id)
            UserDepartment.objects.create(user=user, department=dept, is_primary=True)

        # Supervisors automatically become the primary manager of employees they create
        if request.user.is_supervisor_user:
            UserReporting.objects.create(employee=user, manager=request.user, is_primary=True)

        return user


class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)


# Append to backend/accounts/serializers.py:

class SubordinateUserSerializer(serializers.ModelSerializer):
    primary_department = serializers.SerializerMethodField()
    primary_manager = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'designation',
            'primary_department', 'primary_manager'
        ]

    def get_primary_department(self, obj):
        mapping = obj.user_departments.filter(is_primary=True).select_related('department').first()
        return mapping.department.name if mapping else None

    def get_primary_manager(self, obj):
        reporting = obj.reporting_assignments.filter(is_primary=True).select_related('manager').first()
        return reporting.manager.username if reporting else None


class AssignReportingSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    manager_id = serializers.IntegerField()
    is_primary = serializers.BooleanField(default=False)

    def validate(self, data):
        if data['employee_id'] == data['manager_id']:
            raise serializers.ValidationError("An employee cannot report to themselves.")
        return data