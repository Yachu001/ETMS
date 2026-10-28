# backend/accounts/views.py

from datetime import time
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q
from rest_framework import viewsets, permissions, status, generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView

from tasks.models import Task, DailyWorkSelection
from tasks.serializers import TaskSerializer

ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']

from .models import (
    Business,
    Department,
    BusinessDepartment,
    UserDepartment,
    UserReporting,
    AttendanceRecord,
    PasswordResetOTP,
)
from .serializers import (
    CustomTokenObtainPairSerializer,
    BusinessSerializer,
    DepartmentSerializer,
    BusinessDepartmentSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    SubordinateUserSerializer,
    RequestOTPSerializer,
    ResetPasswordWithOTPSerializer,
    AssignReportingSerializer,
)
from .utils import get_subordinate_ids, build_hierarchy_tree

User = get_user_model()

# Statuses that prevent user deletion
ACTIVE_TASK_STATUSES = ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION']


# ==========================================
# PERMISSION CLASSES
# ==========================================
class IsManagerOrAdmin(permissions.BasePermission):
    """Base employees have 0 access to the User Management console."""
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['SUPERVISOR', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN']
        )

class IsSupervisorOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'] or 
             request.user.is_superuser)
        )


class IsOrgAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'] or 
             request.user.is_superuser)
        )


# ==========================================
# AUTH & PROFILE VIEWS
# ==========================================
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# ==========================================
# 2. SELF PROFILE & ATTENDANCE
# ==========================================
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        # Allow self-service update for reminders, phone, full_name
        allowed_fields = {'full_name', 'phone', 'reminder_enabled', 'reminder_time'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = UserProfileSerializer(request.user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ==========================================
#  USER CREATION (STANDALONE ENDPOINT)
# ==========================================
class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated]


# ==========================================
# BUSINESS ENTITY MANAGEMENT
# ==========================================
class BusinessViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Business Entities.
    - Super Admin & Admin: Full CRUD.
    - Business Admin: Read-only access to their own business.
    - Deletion blocked if active users belong to the business.
    """
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.role == 'ADMIN':
            return Business.objects.all().order_by('name')
        elif user.role == 'BUSINESS_ADMIN':
            return user.businesses.all().order_by('name')
        elif user.role == 'DEPT_HEAD':
            primary_dept = user.user_departments.filter(is_primary=True).first()
            if primary_dept:
                linked_biz_ids = BusinessDepartment.objects.filter(
                    department=primary_dept.department, is_active=True
                ).values_list('business_id', flat=True)
                return Business.objects.filter(id__in=linked_biz_ids, is_active=True).order_by('name')
            return Business.objects.none()
        elif user.role == 'SUPERVISOR':
            return user.businesses.filter(is_active=True).order_by('name')
        return user.businesses.filter(is_active=True)

    def create(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can create new businesses.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can delete businesses.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.employees.filter(is_active=True).exists():
            return Response(
                {'detail': 'Cannot delete business with active employees. Please reassign or disable them first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DjangoValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        business = self.get_object()
        business.is_active = not business.is_active
        business.save(update_fields=['is_active'])
        return Response({
            'status': 'success',
            'business_id': business.id,
            'is_active': business.is_active,
            'message': f"Business '{business.name}' is now {'Active' if business.is_active else 'Disabled'}."
        })


# ==========================================
# 5. BUSINESS, DEPARTMENT & CROSS-MATRIX VIEWSETS
# ==========================================
class BusinessViewSet(viewsets.ModelViewSet):
    queryset = Business.objects.all().order_by('id')
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by('id')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


class BusinessDepartmentViewSet(viewsets.ModelViewSet):
    queryset = BusinessDepartment.objects.all().select_related('business', 'department', 'supervisor').order_by('id')
    serializer_class = BusinessDepartmentSerializer
    permission_classes = [IsAuthenticated]


# ==========================================
# BUSINESS-DEPARTMENT MATRIX VIEWSET
# ==========================================
class BusinessDepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD API for the Cross-Matrix Unit (Linking a Department inside a Business).
    """
    serializer_class = BusinessDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = BusinessDepartment.objects.select_related('business', 'department').all()

        if user.is_super_admin or user.role == 'ADMIN':
            return queryset
        elif user.role == 'BUSINESS_ADMIN':
            return queryset.filter(business__in=user.businesses.all())
        elif user.role == 'DEPT_HEAD':
            primary_dept = user.user_departments.filter(is_primary=True).first()
            if primary_dept:
                return queryset.filter(department=primary_dept.department)
            return queryset.filter(department__in=user.departments.all())
        elif user.role == 'SUPERVISOR':
            return queryset.filter(
                business__in=user.businesses.all(),
                department__in=user.departments.all()
            )
        return BusinessDepartment.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        biz_id = request.data.get('business')
        dept_id = request.data.get('department')

        if user.role == 'BUSINESS_ADMIN':
            if not user.businesses.filter(id=biz_id).exists():
                return Response({'detail': 'Business Admin cannot map outside their assigned Business.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'DEPT_HEAD':
            primary_dept = user.user_departments.filter(is_primary=True).first()
            if primary_dept and primary_dept.department_id != int(dept_id):
                return Response({'detail': 'Department Head cannot map outside their assigned Department.'}, status=status.HTTP_403_FORBIDDEN)
        elif not (user.is_super_admin or user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return super().create(request, *args, **kwargs)


# ==========================================
# 4. EMPLOYEE MANAGEMENT VIEWSET (ROSTER & CRUD)
# ==========================================
class EmployeeManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManagerOrAdmin]
    serializer_class = SubordinateUserSerializer

    def get_queryset(self):
        actor = self.request.user

        if actor.role == 'SUPER_ADMIN':
            return User.objects.all().prefetch_related('businesses', 'departments', 'user_departments').order_by('-date_joined')

        elif actor.role == 'ADMIN':
            return User.objects.exclude(role__in=['ADMIN', 'SUPER_ADMIN']).prefetch_related(
                'businesses', 'departments', 'user_departments'
            ).order_by('-date_joined')

        elif actor.role == 'BUSINESS_ADMIN':
            downstream_ids = get_subordinate_ids(actor, include_self=False)
            return User.objects.filter(
                Q(businesses__in=actor.businesses.all()) &
                (Q(id__in=downstream_ids) | Q(reporting_assignments__manager=actor)),
                role__in=['SUPERVISOR', 'EMPLOYEE']
            ).distinct().prefetch_related('businesses', 'departments', 'user_departments').order_by('-date_joined')

        elif actor.role == 'DEPT_HEAD':
            downstream_ids = get_subordinate_ids(actor, include_self=False)
            return User.objects.filter(
                Q(departments__in=actor.departments.all()) &
                (Q(id__in=downstream_ids) | Q(reporting_assignments__manager=actor)),
                role__in=['SUPERVISOR', 'EMPLOYEE']
            ).distinct().prefetch_related('businesses', 'departments', 'user_departments').order_by('-date_joined')

        elif actor.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(actor, include_self=False)
            return User.objects.filter(
                id__in=subordinate_ids,
                role='EMPLOYEE'
            ).prefetch_related('businesses', 'departments', 'user_departments').order_by('-date_joined')

        return User.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return SubordinateUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(SubordinateUserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        target_user = self.get_object()
        actor = request.user

        # Permission guards
        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins cannot modify fellow Admins.'}, status=status.HTTP_403_FORBIDDEN)

        if actor.role == 'SUPERVISOR':
            if request.data.get('role') and request.data.get('role') != 'EMPLOYEE':
                return Response({'detail': 'Supervisors cannot modify employee role tiers.'}, status=status.HTTP_403_FORBIDDEN)
            if 'reports_to_id' in request.data and int(request.data['reports_to_id']) != actor.id:
                return Response({'detail': 'Supervisors cannot reassign reporting lines.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Update Core Profile Fields
        for attr in ['full_name', 'username', 'email', 'phone', 'designation', 'date_of_joining', 'shift_start_time', 'shift_end_time']:
            if attr in request.data:
                setattr(target_user, attr, request.data.get(attr))

        # 2. Update Role if authorized
        new_role = request.data.get('role')
        if new_role and actor.role in ['ADMIN', 'SUPER_ADMIN']:
            if actor.role == 'ADMIN' and new_role in ['ADMIN', 'SUPER_ADMIN']:
                return Response({'detail': 'Only Super Admins can promote users to Admin.'}, status=status.HTTP_403_FORBIDDEN)
            target_user.role = new_role

        # Save profile modifications
        target_user.save()

        # 3. Update Department
        if 'department_id' in request.data:
            dept_id = request.data.get('department_id')
            if dept_id:
                target_dept = Department.objects.filter(id=dept_id).first()
                if target_dept:
                    UserDepartment.objects.filter(user=target_user).update(is_primary=False)
                    UserDepartment.objects.update_or_create(
                        user=target_user,
                        department=target_dept,
                        defaults={'is_primary': True}
                    )

        # 4. Update Business
        if 'business_ids' in request.data:
            biz_ids = request.data.get('business_ids') or []
            businesses = Business.objects.filter(id__in=biz_ids)
            target_user.businesses.set(businesses)

        # 5. Update Reporting Lead
        if 'reports_to_id' in request.data:
            reports_to_id = request.data.get('reports_to_id')
            if reports_to_id:
                manager = User.objects.filter(id=reports_to_id).first()
                if manager and manager.id != target_user.id:
                    UserReporting.objects.filter(employee=target_user).update(is_primary=False)
                    UserReporting.objects.update_or_create(
                        employee=target_user,
                        manager=manager,
                        defaults={'is_primary': True}
                    )

        return Response(SubordinateUserSerializer(target_user).data, status=status.HTTP_200_OK)

    # FIX FOR DISABLE/ENABLE BUTTON
    @action(detail=True, methods=['patch'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        target_user = self.get_object()
        actor = request.user

        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins cannot disable other Admin accounts.'}, status=status.HTTP_403_FORBIDDEN)

        if target_user.id == actor.id:
            return Response({'detail': 'You cannot disable your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        target_user.is_active = not target_user.is_active
        target_user.save(update_fields=['is_active'])

        return Response({
            'id': target_user.id,
            'is_active': target_user.is_active,
            'message': f"Account for {target_user.username} is now {'Active' if target_user.is_active else 'Disabled'}."
        }, status=status.HTTP_200_OK)

    # Scoped Form Options for Dropdowns
    @action(detail=False, methods=['get'], url_path='form-options')
    def get_form_options(self, request):
        actor = request.user
        role = actor.role

        all_businesses = Business.objects.filter(is_active=True).order_by('name')
        all_departments = Department.objects.filter(is_active=True).order_by('name')
        matrix_qs = BusinessDepartment.objects.filter(is_active=True).select_related('business', 'department')

        scoped_businesses = []
        scoped_departments = []
        default_business_id = None
        default_department_id = None
        is_business_locked = False
        is_department_locked = False

        if role in ['SUPER_ADMIN', 'ADMIN']:
            scoped_businesses = list(all_businesses.values('id', 'name', 'code'))
            scoped_departments = list(all_departments.values('id', 'name'))

        elif role == 'BUSINESS_ADMIN':
            actor_biz = actor.businesses.filter(is_active=True).first()
            if actor_biz:
                scoped_businesses = [{'id': actor_biz.id, 'name': actor_biz.name, 'code': actor_biz.code}]
                default_business_id = actor_biz.id
                is_business_locked = True
                linked_dept_ids = matrix_qs.filter(business=actor_biz).values_list('department_id', flat=True)
                scoped_departments = list(Department.objects.filter(id__in=linked_dept_ids, is_active=True).values('id', 'name'))

        elif role == 'DEPT_HEAD':
            actor_dept_rel = actor.user_departments.filter(is_primary=True).select_related('department').first()
            actor_dept = actor_dept_rel.department if actor_dept_rel else actor.departments.filter(is_active=True).first()
            if actor_dept:
                scoped_departments = [{'id': actor_dept.id, 'name': actor_dept.name}]
                default_department_id = actor_dept.id
                is_department_locked = True
                linked_biz_ids = matrix_qs.filter(department=actor_dept).values_list('business_id', flat=True)
                scoped_businesses = list(Business.objects.filter(id__in=linked_biz_ids, is_active=True).values('id', 'name', 'code'))

        elif role == 'SUPERVISOR':
            sup_biz = actor.businesses.filter(is_active=True).first()
            sup_dept_rel = actor.user_departments.filter(is_primary=True).select_related('department').first()
            sup_dept = sup_dept_rel.department if sup_dept_rel else actor.departments.filter(is_active=True).first()
            if sup_biz:
                scoped_businesses = [{'id': sup_biz.id, 'name': sup_biz.name, 'code': sup_biz.code}]
                default_business_id = sup_biz.id
                is_business_locked = True
            if sup_dept:
                scoped_departments = [{'id': sup_dept.id, 'name': sup_dept.name}]
                default_department_id = sup_dept.id
                is_department_locked = True

        eligible_managers = User.objects.filter(is_active=True).exclude(role='EMPLOYEE')
        if role == 'ADMIN':
            eligible_managers = eligible_managers.exclude(role='SUPER_ADMIN')
        elif role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
            downstream_ids = get_subordinate_ids(actor, include_self=True)
            eligible_managers = eligible_managers.filter(id__in=downstream_ids)
        elif role == 'SUPERVISOR':
            eligible_managers = User.objects.filter(id=actor.id)

        candidate_managers = [
            {'id': m.id, 'username': m.username, 'full_name': m.full_name or m.username, 'role': m.role}
            for m in eligible_managers
        ]

        return Response({
            'businesses': scoped_businesses,
            'departments': scoped_departments,
            'candidate_managers': candidate_managers,
            'defaults': {
                'business_id': default_business_id,
                'department_id': default_department_id,
                'reports_to_id': actor.id if role == 'SUPERVISOR' else None,
                'is_business_locked': is_business_locked,
                'is_department_locked': is_department_locked
            }
        })


# ==========================================
# USER DETAIL COCKPIT VIEW
# ==========================================
class UserCockpitDetailView(APIView):
    """
    Returns specific employee profile metadata, active tasks count,
    today's committed count, total assigned tasks, and the complete task roster.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target_user = User.objects.filter(id=user_id).prefetch_related(
            'businesses',
            'user_departments__department',
            'reporting_assignments__manager'
        ).first()

        if not target_user:
            return Response({'detail': f'User #{user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localtime(timezone.now()).date()

        # 1. Attendance check for target user
        attendance = AttendanceRecord.objects.filter(user=target_user, date=today).first()
        is_present = attendance.is_present if attendance else False

        # 2. All tasks assigned to or created for this user (All-inclusive: Pending, Active, Completed, Canceled, Rejected)
        all_user_tasks = Task.objects.filter(assigned_to=target_user).order_by('-created_at')
        total_assigned_count = all_user_tasks.count()

        # 3. Active actionable tasks (strictly ACCEPTED or IN_PROGRESS)
        active_tasks = all_user_tasks.filter(status__in=ACTIVE_WORK_STATUSES)
        active_tasks_count = active_tasks.count()

        # 4. Today's commitments count via DailyWorkSelection
        today_committed_count = DailyWorkSelection.objects.filter(
            user=target_user, date=today
        ).count()

        # 5. Primary department & manager resolution
        primary_dept_name = 'No Department'
        dept_rel = target_user.user_departments.filter(is_primary=True).select_related('department').first()
        if dept_rel and dept_rel.department:
            primary_dept_name = dept_rel.department.name

        primary_mgr_name = 'None'
        mgr_rel = target_user.reporting_assignments.filter(is_primary=True).select_related('manager').first()
        if mgr_rel and mgr_rel.manager:
            primary_mgr_name = mgr_rel.manager.full_name or mgr_rel.manager.username

        return Response({
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'full_name': target_user.full_name or target_user.username,
                'email': target_user.email or '',
                'role': target_user.role,
                'designation': target_user.designation or 'Staff',
                'employee_code': getattr(target_user, 'employee_code', None) or f"EID{target_user.id:02d}",
                'department': primary_dept_name,
                'primary_manager': primary_mgr_name,
                'shift_start_time': str(getattr(target_user, 'shift_start_time', '09:00:00')),
                'shift_end_time': str(getattr(target_user, 'shift_end_time', '18:00:00')),
                'is_active': target_user.is_active,
                'is_present': is_present,
                'total_assigned_count': total_assigned_count,
                'active_tasks_count': active_tasks_count,
                'today_committed_count': today_committed_count,
                'businesses': [
                    {'id': b.id, 'name': b.name, 'code': b.code}
                    for b in target_user.businesses.all()
                ]
            },
            'tasks': TaskSerializer(all_user_tasks, many=True, context={'request': request}).data
        })


# ==========================================
# ATTENDANCE TOGGLE VIEW
# ==========================================
class DailyAttendanceToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        rec = AttendanceRecord.objects.filter(user=request.user, date=today).first()
        return Response({
            'date': today,
            'is_present': rec.is_present if rec else False
        })

    def post(self, request):
        today = timezone.now().date()
        rec, _ = AttendanceRecord.objects.get_or_create(user=request.user, date=today)
        new_status = request.data.get('is_present', not rec.is_present)
        rec.is_present = bool(new_status)
        rec.marked_at = timezone.now()
        rec.save()
        return Response({
            'date': today,
            'is_present': rec.is_present,
            'detail': f"Attendance marked as {'Present' if rec.is_present else 'On Leave'}."
        })



# ==========================================
# 6. ORG TREE & REPORTING ASSIGNMENT
# ==========================================
class OrgHierarchyTreeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tree = build_hierarchy_tree(request.user)
        return Response(tree)


class MySubordinatesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub_ids = get_subordinate_ids(request.user, include_self=False)
        subordinates = User.objects.filter(id__in=sub_ids, is_active=True).order_by('username')
        serializer = SubordinateUserSerializer(subordinates, many=True)
        return Response(serializer.data)


class AssignReportingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AssignReportingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        emp_id = serializer.validated_data['employee_id']
        mgr_id = serializer.validated_data['manager_id']
        is_primary = serializer.validated_data.get('is_primary', False)

        employee = get_object_or_404(User, id=emp_id)
        manager = get_object_or_404(User, id=mgr_id)

        if manager.role == 'EMPLOYEE':
            return Response({'detail': 'Base employees cannot be designated as managers.'}, status=400)

        if is_primary:
            UserReporting.objects.filter(employee=employee, is_primary=True).update(is_primary=False)

        reporting, _ = UserReporting.objects.update_or_create(
            employee=employee,
            manager=manager,
            defaults={'is_primary': is_primary}
        )

        return Response({'detail': f"Assigned {employee.username} to report to {manager.username}."})


# ==========================================
# 7. PASSWORD RESET WITH OTP
# ==========================================
class RequestPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.filter(email=email).first()

        if user:
            import random
            otp_code = f"{random.randint(100000, 999999)}"
            expires_at = timezone.now() + timezone.timedelta(minutes=10)
            PasswordResetOTP.objects.create(user=user, otp_code=otp_code, expires_at=expires_at)
            # Log OTP in terminal for local dev
            print(f"\n[DEV OTP] OTP for {email} is: {otp_code} (Valid for 10 mins)\n")

        return Response({'detail': 'If the email exists, an OTP has been dispatched.'})


class ResetPasswordWithOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordWithOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = get_object_or_404(User, email=email)
        record = PasswordResetOTP.objects.filter(
            user=user, otp_code=otp_code, is_used=False, expires_at__gte=timezone.now()
        ).first()

        if not record:
            return Response({'detail': 'Invalid or expired OTP code.'}, status=400)

        user.set_password(new_password)
        user.save()
        record.is_used = True
        record.save()

        return Response({'detail': 'Password has been reset successfully.'})