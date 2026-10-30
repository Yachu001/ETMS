# backend/accounts/views.py

from datetime import time
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import viewsets, permissions, status, generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView

from tasks.models import Task, DailyWorkSelection
from notifications.models import Notification
from tasks.serializers import TaskSerializer

from .models import (
    Business,
    Department,
    BusinessDepartment,
    AttendanceRecord,
    PasswordResetOTP,
)
from .serializers import (
    BusinessSerializer,
    DepartmentSerializer,
    BusinessDepartmentSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    SubordinateUserSerializer,
    CustomTokenObtainPairSerializer,
    RequestOTPSerializer,
    ResetPasswordWithOTPSerializer,
)
from .utils import (
    get_subordinate_ids, 
    build_hierarchy_tree, 
    get_user_today_active_committed_count, 
    is_user_idle
)

User = get_user_model()

ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']
ACTIVE_TASK_STATUSES = ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION']


# ==========================================
# PERMISSION CLASSES
# ==========================================
class IsSupervisorOrAdmin(permissions.BasePermission):
    """Permits access to Supervisors, Business Admins, Dept Heads, and Admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'] or 
             request.user.is_superuser)
        )


class IsOrgAdmin(permissions.BasePermission):
    """Permits access to Executive Tiers (Business Admin, Dept Head, Admin, Super Admin)."""
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role in ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'] or 
             request.user.is_superuser)
        )


# ==========================================
# 1. AUTH & PROFILE VIEWS
# ==========================================
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        allowed_fields = {
            'full_name', 'phone', 'reminder_enabled', 'reminder_time',
            'self_idle_timer_start', 'team_idle_timer_start'
        }
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = UserProfileSerializer(request.user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsSupervisorOrAdmin]


# ==========================================
# 2. BUSINESS MANAGEMENT VIEWSET
# ==========================================
class BusinessViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.role == 'ADMIN':
            return Business.objects.all().order_by('name')
        elif user.role == 'BUSINESS_ADMIN' and user.business:
            return Business.objects.filter(id=user.business.id)
        elif user.role == 'DEPT_HEAD' and user.department:
            linked_biz_ids = BusinessDepartment.objects.filter(
                department=user.department, is_active=True
            ).values_list('business_id', flat=True)
            return Business.objects.filter(id__in=linked_biz_ids, is_active=True).order_by('name')
        elif user.role == 'SUPERVISOR' and user.business:
            return Business.objects.filter(id=user.business.id)
        return Business.objects.filter(is_active=True).order_by('name')

    def create(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can create new businesses.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can delete businesses.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.business_users.filter(is_active=True).exists():
            return Response(
                {'detail': f"Cannot delete Business '{instance.name}'. Active users are currently assigned to it."},
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
# 3. DEPARTMENT MANAGEMENT VIEWSET
# ==========================================
class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.role == 'ADMIN':
            return Department.objects.all().order_by('name')
        elif user.role == 'DEPT_HEAD' and user.department:
            return Department.objects.filter(
                Q(id=user.department.id) | Q(parent=user.department)
            ).distinct()
        elif user.role == 'BUSINESS_ADMIN' and user.business:
            linked_dept_ids = BusinessDepartment.objects.filter(
                business=user.business, is_active=True
            ).values_list('department_id', flat=True)
            return Department.objects.filter(id__in=linked_dept_ids).order_by('name')
        elif user.department:
            return Department.objects.filter(id=user.department.id)
        return Department.objects.filter(is_active=True).order_by('name')

    def create(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can create departments.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can delete departments.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.department_users.filter(is_active=True).exists():
            return Response(
                {'detail': f"Cannot delete Department '{instance.name}'. Active users are currently assigned to it."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DjangoValidationError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


# ==========================================
# 4. CROSS-MATRIX (BUSINESS-DEPARTMENT) VIEWSET
# ==========================================
class BusinessDepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessDepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = BusinessDepartment.objects.select_related('business', 'department', 'supervisor').all()

        if user.is_super_admin or user.role == 'ADMIN':
            return queryset.order_by('business__name', 'department__name')
        elif user.role == 'BUSINESS_ADMIN' and user.business:
            return queryset.filter(business=user.business).order_by('department__name')
        elif user.role == 'DEPT_HEAD' and user.department:
            return queryset.filter(department=user.department).order_by('business__name')
        elif user.role == 'SUPERVISOR':
            return queryset.filter(supervisor=user).order_by('business__name')
        return BusinessDepartment.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        biz_id = request.data.get('business')
        dept_id = request.data.get('department')

        if user.role == 'BUSINESS_ADMIN':
            if not user.business or user.business.id != int(biz_id):
                return Response({'detail': 'Business Admins cannot create matrices outside their business.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'DEPT_HEAD':
            if not user.department or user.department.id != int(dept_id):
                return Response({'detail': 'Department Heads cannot create matrices outside their department.'}, status=status.HTTP_403_FORBIDDEN)
        elif not (user.is_super_admin or user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='candidate-supervisors')
    def candidate_supervisors(self, request):
        candidates = User.objects.filter(
            role__in=['SUPERVISOR', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPER_ADMIN'],
            is_active=True
        ).order_by('full_name', 'username')
        
        return Response([
            {
                'id': u.id,
                'name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Lead'
            }
            for u in candidates
        ])

    @action(detail=True, methods=['post'], url_path='assign-supervisor')
    def assign_supervisor(self, request, pk=None):
        matrix_unit = self.get_object()
        supervisor_id = request.data.get('supervisor_id')
        actor = request.user
        old_supervisor = matrix_unit.supervisor

        matrix_title = f"{matrix_unit.business.code} - {matrix_unit.department.name}"

        if not supervisor_id:
            matrix_unit.supervisor = None
            matrix_unit.save(update_fields=['supervisor'])

            # If supervisor was unassigned, notify old supervisor
            if old_supervisor:
                Notification.objects.create(
                    recipient=old_supervisor,
                    sender=actor,
                    notification_type='METRIX_INCHARGE',
                    title=f"Incharge Relieved: {matrix_title}",
                    message=f"You are no longer in charge of {matrix_title}.",
                    data={'matrix_id': matrix_unit.id, 'action': 'UNASSIGNED'}
                )
            return Response({'status': 'success', 'message': 'Matrix incharge unassigned.'})
            
        new_sup = User.objects.filter(id=supervisor_id).first()
        if not new_sup:
            return Response({'detail': 'Invalid supervisor selected.'}, status=status.HTTP_400_BAD_REQUEST)

        if old_supervisor == new_sup:
            return Response({'status': 'success', 'message': 'Supervisor already assigned.'})

        # Save new supervisor
        matrix_unit.supervisor = new_sup
        matrix_unit.save(update_fields=['supervisor'])

        # Auto-repoint all base members under this matrix to new supervisor
        base_members = User.objects.filter(matrix=matrix_unit, role='EMPLOYEE')
        base_members.update(reports_to=new_sup)

        old_sup_name = (old_supervisor.full_name or old_supervisor.username) if old_supervisor else "None"
        new_sup_name = new_sup.full_name or new_sup.username

        # 1. Notify Old Supervisor
        if old_supervisor:
            Notification.objects.create(
                recipient=old_supervisor,
                sender=actor,
                notification_type='METRIX_INCHARGE',
                title=f"Matrix Incharge Relieved: {matrix_title}",
                message=f"You are no longer the in-charge of {matrix_title}. Handed over to {new_sup_name}.",
                data={'matrix_id': matrix_unit.id, 'role': 'OLD_SUPERVISOR'}
            )

        # 2. Notify New Supervisor
        Notification.objects.create(
            recipient=new_sup,
            sender=actor,
            notification_type='METRIX_INCHARGE',
            title=f"Matrix Incharge Appointed: {matrix_title}",
            message=f"From now on, you are the appointed in-charge of {matrix_title}.",
            data={'matrix_id': matrix_unit.id, 'role': 'NEW_SUPERVISOR'}
        )

        # 3. Notify All Member Employees in this Matrix
        for member in base_members:
            Notification.objects.create(
                recipient=member,
                sender=actor,
                notification_type='METRIX_INCHARGE',
                title=f"Matrix Supervisor Updated: {matrix_title}",
                message=f"Your {matrix_title} supervisor has changed from {old_sup_name} to {new_sup_name}.",
                data={'matrix_id': matrix_unit.id, 'new_supervisor_id': new_sup.id}
            )

        return Response({
            'status': 'success',
            'message': f"Assigned {new_sup_name} as Incharge for {matrix_title} and notified all affected members."
        })


# ==========================================
# 5. EMPLOYEE MANAGEMENT VIEWSET
# ==========================================
class EmployeeManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSupervisorOrAdmin]
    serializer_class = SubordinateUserSerializer

    def get_queryset(self):
        actor = self.request.user
        qs = User.objects.all().select_related('matrix', 'business', 'department', 'reports_to')

        if actor.role == 'SUPER_ADMIN':
            qs = qs.order_by('-date_joined')
        elif actor.role == 'ADMIN':
            qs = qs.exclude(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('-date_joined')
        elif actor.role == 'BUSINESS_ADMIN':
            if actor.business:
                qs = qs.filter(
                    Q(business=actor.business) | Q(matrix__business=actor.business)
                ).exclude(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('-date_joined')
            else:
                return User.objects.none()
        elif actor.role == 'DEPT_HEAD':
            if actor.department:
                qs = qs.filter(
                    Q(department=actor.department) | Q(matrix__department=actor.department)
                ).exclude(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('-date_joined')
            else:
                return User.objects.none()
        elif actor.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(actor, include_self=False)
            qs = qs.filter(
                Q(matrix__supervisor=actor) | Q(id__in=subordinate_ids),
                role='EMPLOYEE'
            ).order_by('-date_joined')
        else:
            return User.objects.none()

        matrix_id = self.request.query_params.get('matrix_id')
        dept_id = self.request.query_params.get('department_id')
        biz_id = self.request.query_params.get('business_id')
        role = self.request.query_params.get('role')

        if matrix_id:
            qs = qs.filter(matrix_id=matrix_id)
        if dept_id:
            qs = qs.filter(Q(department_id=dept_id) | Q(matrix__department_id=dept_id))
        if biz_id:
            qs = qs.filter(Q(business_id=biz_id) | Q(matrix__business_id=biz_id))
        if role:
            qs = qs.filter(role=role)

        return qs.distinct()

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

        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins are not permitted to modify fellow Admins.'}, status=status.HTTP_403_FORBIDDEN)

        if actor.role == 'SUPERVISOR':
            if request.data.get('role') and request.data.get('role') != 'EMPLOYEE':
                return Response({'detail': 'Supervisors cannot modify employee role tiers.'}, status=status.HTTP_403_FORBIDDEN)
            if 'matrix_id' in request.data:
                req_matrix = request.data.get('matrix_id')
                if req_matrix and target_user.matrix_id != req_matrix:
                    return Response({'detail': 'Supervisors cannot move members to another matrix.'}, status=status.HTTP_403_FORBIDDEN)

        old_matrix = target_user.matrix
        new_matrix = None

        # 1. Update basic fields
        for attr in ['full_name', 'username', 'email', 'phone', 'designation', 'date_of_joining',
                     'shift_start_time', 'shift_end_time', 'self_idle_timer_start', 'team_idle_timer_start']:
            if attr in request.data:
                setattr(target_user, attr, request.data.get(attr))

        # 2. Update role if authorized
        new_role = request.data.get('role')
        if new_role and actor.role in ['ADMIN', 'SUPER_ADMIN']:
            if actor.role == 'ADMIN' and new_role in ['ADMIN', 'SUPER_ADMIN']:
                return Response({'detail': 'Only Super Admins can assign Admin roles.'}, status=status.HTTP_403_FORBIDDEN)
            target_user.role = new_role

        # 3. Dynamic Matrix / Business / Department assignment
        if 'matrix_id' in request.data:
            matrix_id = request.data.get('matrix_id')
            if matrix_id and matrix_id not in ['none', None, 'null']:
                matrix_obj = BusinessDepartment.objects.filter(id=matrix_id).select_related('business', 'department', 'supervisor').first()
                if matrix_obj:
                    new_matrix = matrix_obj
                    target_user.matrix = matrix_obj
                    target_user.business = matrix_obj.business
                    target_user.department = matrix_obj.department

                    if target_user.role == 'EMPLOYEE':
                        target_user.reports_to = matrix_obj.supervisor
                    elif target_user.role == 'SUPERVISOR':
                        matrix_obj.supervisor = target_user
                        matrix_obj.save(update_fields=['supervisor'])
            else:
                target_user.matrix = None
                target_user.business = None
                target_user.department = None
                target_user.reports_to = None

        elif actor.role in ['ADMIN', 'SUPER_ADMIN']:
            if 'business_id' in request.data:
                b_id = request.data.get('business_id')
                target_user.business = Business.objects.filter(id=b_id).first() if b_id else None

            if 'department_id' in request.data:
                d_id = request.data.get('department_id')
                target_user.department = Department.objects.filter(id=d_id).first() if d_id else None

            if 'reports_to_id' in request.data:
                r_id = request.data.get('reports_to_id')
                target_user.reports_to = User.objects.filter(id=r_id).first() if r_id and int(r_id) != target_user.id else None

        target_user.save()

        # Cascade Transfer Notifications if Matrix changed
        if 'matrix_id' in request.data and old_matrix != new_matrix:
            old_matrix_title = f"{old_matrix.business.code} - {old_matrix.department.name}" if old_matrix else "No Matrix"
            new_matrix_title = f"{new_matrix.business.code} - {new_matrix.department.name}" if new_matrix else "No Matrix"
            emp_name = target_user.full_name or target_user.username

            # Alert Transferred Employee
            Notification.objects.create(
                recipient=target_user,
                sender=actor,
                notification_type='METRIX_TRANSFER',
                title='Matrix Assignment Updated',
                message=f"Your operational branch has been moved from {old_matrix_title} to {new_matrix_title}.",
                data={'old_matrix': old_matrix_title, 'new_matrix': new_matrix_title}
            )

            # Alert Old Matrix Supervisor
            if old_matrix and old_matrix.supervisor and old_matrix.supervisor != target_user:
                Notification.objects.create(
                    recipient=old_matrix.supervisor,
                    sender=actor,
                    notification_type='METRIX_TRANSFER',
                    title='Member Transferred Out',
                    message=f"{emp_name} has been transferred out of {old_matrix_title} to {new_matrix_title}.",
                    data={'user_id': target_user.id}
                )

            # Alert New Matrix Supervisor
            if new_matrix and new_matrix.supervisor and new_matrix.supervisor != target_user:
                Notification.objects.create(
                    recipient=new_matrix.supervisor,
                    sender=actor,
                    notification_type='METRIX_TRANSFER',
                    title='New Member Assigned',
                    message=f"{emp_name} has been assigned to your matrix branch ({new_matrix_title}).",
                    data={'user_id': target_user.id}
                )

        return Response(SubordinateUserSerializer(target_user).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        actor = request.user
        target_user = self.get_object()

        if actor.role == 'SUPERVISOR':
            return Response(
                {'detail': 'Supervisors cannot delete accounts. Toggle account status to Disabled instead.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins are not permitted to remove Admin accounts.'}, status=status.HTTP_403_FORBIDDEN)

        if target_user.id == actor.id:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Guard: Check for active in-flight tasks
        active_tasks = Task.objects.filter(assigned_to=target_user, status__in=ACTIVE_TASK_STATUSES)
        if active_tasks.exists():
            return Response(
                {'detail': f"Cannot delete '{target_user.username}'. The user has {active_tasks.count()} active tasks in progress. Reassign or resolve these tasks before deletion, or disable the account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        target_user = self.get_object()
        actor = request.user

        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins cannot disable other Admin accounts.'}, status=status.HTTP_403_FORBIDDEN)

        if target_user.id == actor.id:
            return Response({'detail': 'You cannot disable your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Guard: If currently active and disabling, ensure no active tasks are in progress
        if target_user.is_active:
            blocking_tasks = Task.objects.filter(
                assigned_to=target_user,
                is_disabled=False,
                status__in=ACTIVE_TASK_STATUSES
            ).exclude(progress_percentage=100)

            if blocking_tasks.exists():
                return Response({
                    'detail': f"Cannot disable '{target_user.username}'. The user has {blocking_tasks.count()} active task(s) in progress. "
                              f"All active tasks must be completed, cancelled, or rejected first."
                }, status=status.HTTP_400_BAD_REQUEST)

            target_user.is_active = False
            target_user.save(update_fields=['is_active'])
            return Response({
                'id': target_user.id,
                'username': target_user.username,
                'is_active': False,
                'message': f"Account for {target_user.full_name or target_user.username} is now Disabled."
            }, status=status.HTTP_200_OK)
        else:
            target_user.is_active = True
            target_user.save(update_fields=['is_active'])
            return Response({
                'id': target_user.id,
                'username': target_user.username,
                'is_active': True,
                'message': f"Account for {target_user.full_name or target_user.username} is now Active."
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='form-options')
    def get_form_options(self, request):
        actor = request.user
        role = actor.role

        matrix_qs = BusinessDepartment.objects.filter(is_active=True).select_related('business', 'department', 'supervisor')

        if role in ['SUPER_ADMIN', 'ADMIN']:
            scoped_matrices = matrix_qs
        elif role == 'BUSINESS_ADMIN':
            scoped_matrices = matrix_qs.filter(business=actor.business) if actor.business else matrix_qs.none()
        elif role == 'DEPT_HEAD':
            scoped_matrices = matrix_qs.filter(department=actor.department) if actor.department else matrix_qs.none()
        elif role == 'SUPERVISOR':
            scoped_matrices = matrix_qs.filter(supervisor=actor)
        else:
            scoped_matrices = matrix_qs.none()

        matrix_options = [
            {
                'id': m.id,
                'title': f"{m.business.code} - {m.department.name} [Lead: {(m.supervisor.full_name or m.supervisor.username) if m.supervisor else 'Unassigned'}]",
                'business_id': m.business.id,
                'business_name': m.business.name,
                'business_code': m.business.code,
                'department_id': m.department.id,
                'department_name': m.department.name,
                'supervisor_id': m.supervisor.id if m.supervisor else None,
                'supervisor_name': (m.supervisor.full_name or m.supervisor.username) if m.supervisor else 'No Lead Assigned'
            }
            for m in scoped_matrices
        ]

        businesses = Business.objects.filter(is_active=True).values('id', 'name', 'code').order_by('name')
        departments = Department.objects.filter(is_active=True).values('id', 'name').order_by('name')

        return Response({
            'matrices': matrix_options,
            'businesses': list(businesses),
            'departments': list(departments),
            'currentUser': {
                'id': actor.id,
                'role': actor.role,
                'matrix_id': actor.matrix_id,
                'business_id': actor.business_id,
                'department_id': actor.department_id
            }
        })


# ==========================================
# 6. USER COCKPIT DETAIL VIEW (INSPECTOR)
# ==========================================
class UserCockpitDetailView(APIView):
    """
    Returns specific employee profile metadata, active tasks count,
    today's committed count, total assigned tasks, and the complete task roster.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        target_user = User.objects.filter(id=user_id).select_related(
            'matrix', 'business', 'department', 'reports_to'
        ).first()

        if not target_user:
            return Response({'detail': f'User #{user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localtime(timezone.now()).date()

        # 1. Attendance check
        attendance = AttendanceRecord.objects.filter(user=target_user, date=today).first()
        is_present = attendance.is_present if attendance else False

        # 2. Tasks breakdown
        all_user_tasks = Task.objects.filter(assigned_to=target_user, is_disabled=False).order_by('-created_at')
        total_assigned_count = all_user_tasks.count()
        active_tasks_count = all_user_tasks.filter(status__in=ACTIVE_WORK_STATUSES).count()
        
        # 3. Today's active commitments count & idle calculation
        today_committed_count = DailyWorkSelection.objects.filter(user=target_user, date=today).count()
        today_active_committed_count = get_user_today_active_committed_count(target_user)
        user_is_idle = is_user_idle(target_user)

        # 4. Clean single relation lookup
        dept_obj = target_user.department or (target_user.matrix.department if target_user.matrix else None)
        biz_obj = target_user.business or (target_user.matrix.business if target_user.matrix else None)
        mgr_obj = target_user.reports_to

        return Response({
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'full_name': target_user.full_name or target_user.username,
                'email': target_user.email or '',
                'role': target_user.role,
                'designation': target_user.designation or 'Staff',
                'employee_code': getattr(target_user, 'employee_code', None) or f"EID{target_user.id:02d}",
                'matrix': str(target_user.matrix) if target_user.matrix else 'No Matrix',
                'department': dept_obj.name if dept_obj else 'No Department',
                'business': biz_obj.name if biz_obj else 'No Business',
                'primary_manager': (mgr_obj.full_name or mgr_obj.username) if mgr_obj else 'None',
                'shift_start_time': str(getattr(target_user, 'shift_start_time', '09:00:00')),
                'shift_end_time': str(getattr(target_user, 'shift_end_time', '18:00:00')),
                'self_idle_timer_start': str(getattr(target_user, 'self_idle_timer_start', '10:00:00')),
                'team_idle_timer_start': str(getattr(target_user, 'team_idle_timer_start', '')) if getattr(target_user, 'team_idle_timer_start', None) else None,
                'is_active': target_user.is_active,
                'is_present': is_present,
                'is_idle': user_is_idle,
                'total_assigned_count': total_assigned_count,
                'active_tasks_count': active_tasks_count,
                'today_committed_count': today_committed_count,
                'today_active_committed_count': today_active_committed_count,
            },
            'tasks': TaskSerializer(all_user_tasks, many=True, context={'request': request}).data
        })


# ==========================================
# 7. ATTENDANCE TOGGLE VIEW
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
            'detail': f"Attendance marked as {'Present / On-Duty' if rec.is_present else 'On Leave'}."
        })


# ==========================================
# 8. ORG TREE & SUBORDINATES
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


# ==========================================
# 9. PASSWORD RESET WITH OTP
# ==========================================
class RequestPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.filter(email=email, is_active=True).first()

        if user:
            otp = PasswordResetOTP.objects.create(user=user)
            print(f"\n======================================")
            print(f" PASSWORD RESET OTP FOR {user.email}: {otp.otp_code}")
            print(f"======================================\n")

        return Response({'detail': 'If the email exists, an OTP has been dispatched.'}, status=status.HTTP_200_OK)


class ResetPasswordWithOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordWithOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = get_object_or_404(User, email=email, is_active=True)
        record = PasswordResetOTP.objects.filter(
            user=user, otp_code=otp_code, is_used=False
        ).order_by('-created_at').first()

        if not record or not record.is_valid():
            return Response({'detail': 'Invalid or expired OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        record.is_used = True
        record.save()

        return Response({'detail': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)