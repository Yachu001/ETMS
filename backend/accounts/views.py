# backend/accounts/views.py

from datetime import time
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db import models, transaction
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
    SystemAuditLog,
)
from .serializers import (
    BusinessSerializer,
    DepartmentSerializer,
    BusinessDepartmentSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
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
from .audit_service import log_system_event

User = get_user_model()

ACTIVE_WORK_STATUSES = ['ACCEPTED', 'IN_PROGRESS']
ACTIVE_TASK_STATUSES = ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION']

# Role Tier hierarchy weight for comparison (lower number = higher tier)
ROLE_HIERARCHY_RANK = {
    'SUPER_ADMIN': 1,
    'ADMIN': 2,
    'BUSINESS_ADMIN': 3,
    'DEPT_HEAD': 3,
    'SUPERVISOR': 4,
    'EMPLOYEE': 5,
}


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

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


# ==========================================
# 2. BUSINESS MANAGEMENT VIEWSET
# ==========================================
class BusinessViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        biz = getattr(user, 'effective_business', None) or user.business

        if user.is_super_admin or user.role == 'ADMIN':
            return Business.objects.all().order_by('name')
        elif user.role == 'BUSINESS_ADMIN' and biz:
            return Business.objects.filter(id=biz.id)
        elif user.role == 'DEPT_HEAD':
            return Business.objects.filter(is_active=True).order_by('name')
        elif user.role == 'SUPERVISOR' and biz:
            return Business.objects.filter(id=biz.id)
        return Business.objects.filter(is_active=True).order_by('name')

    @action(detail=False, methods=['get'], url_path='candidate-incharges')
    def candidate_incharges(self, request):
        biz_id = request.query_params.get('business_id')

        busy_admins = Business.objects.filter(is_active=True, incharge__isnull=False)
        if biz_id:
            busy_admins = busy_admins.exclude(id=biz_id)
        busy_admin_ids = busy_admins.values_list('incharge_id', flat=True)

        candidates = User.objects.filter(
            role__in=['BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
            is_active=True
        ).exclude(
            role='BUSINESS_ADMIN',
            id__in=busy_admin_ids
        ).order_by('full_name', 'username')

        return Response([
            {
                'id': u.id,
                'name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Business Lead'
            }
            for u in candidates
        ])

    def create(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can create new businesses.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            biz = serializer.save()

            log_system_event(
                actor=request.user,
                action_type='BUSINESS_CREATED',
                module='ORGANIZATION',
                entity_id=biz.id,
                entity_name=biz.name,
                new_values={
                    'name': biz.name,
                    'code': biz.code,
                    'incharge': biz.incharge.username if biz.incharge else None
                },
                remarks=f"Created business {biz.name} ({biz.code})",
                request=request
            )

        return Response(BusinessSerializer(biz).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can edit business details.'}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        old_data = {
            'name': instance.name,
            'code': instance.code,
            'description': instance.description,
            'incharge': instance.incharge.username if instance.incharge else None
        }

        data = request.data.copy()
        data.pop('code', None)

        serializer = self.get_serializer(instance, data=data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            updated_biz = serializer.save()

            new_data = {
                'name': updated_biz.name,
                'code': updated_biz.code,
                'description': updated_biz.description,
                'incharge': updated_biz.incharge.username if updated_biz.incharge else None
            }

            log_system_event(
                actor=request.user,
                action_type='BUSINESS_UPDATED',
                module='ORGANIZATION',
                entity_id=updated_biz.id,
                entity_name=updated_biz.name,
                old_values=old_data,
                new_values=new_data,
                remarks=f"Updated business {updated_biz.name} ({updated_biz.code})",
                request=request
            )

        return Response(BusinessSerializer(updated_biz).data)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can delete businesses.'}, status=status.HTTP_403_FORBIDDEN)
        
        instance = self.get_object()

        active_users_count = instance.business_users.filter(is_active=True).count()
        if active_users_count > 0:
            return Response(
                {'detail': f"Cannot delete Business '{instance.name}'. There are {active_users_count} active user(s) assigned to it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        active_matrices_count = instance.business_departments.filter(is_active=True).count()
        if active_matrices_count > 0:
            return Response(
                {'detail': f"Cannot delete Business '{instance.name}'. There are {active_matrices_count} active matrix branch(es) linked to it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        b_name = instance.name
        b_id = instance.id
        instance.delete()

        log_system_event(
            actor=request.user,
            action_type='BUSINESS_DELETED',
            module='ORGANIZATION',
            entity_id=b_id,
            entity_name=b_name,
            remarks=f"Deleted business: {b_name}",
            request=request
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        business = self.get_object()
        
        if business.is_active:
            active_users_count = business.business_users.filter(is_active=True).count()
            if active_users_count > 0:
                return Response(
                    {'detail': f"Cannot disable '{business.name}'. {active_users_count} active user(s) are assigned to it. Reassign or remove them first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            active_matrices_count = business.business_departments.filter(is_active=True).count()
            if active_matrices_count > 0:
                return Response(
                    {'detail': f"Cannot disable '{business.name}'. {active_matrices_count} active matrix branch(es) are linked to it. Disable or remove those matrices first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        business.is_active = not business.is_active
        business.save(update_fields=['is_active'])

        log_system_event(
            actor=request.user,
            action_type='BUSINESS_STATUS_TOGGLED',
            module='ORGANIZATION',
            entity_id=business.id,
            entity_name=business.name,
            new_values={'is_active': business.is_active},
            remarks=f"Business status set to {'Active' if business.is_active else 'Disabled'}",
            request=request
        )

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
        dept = getattr(user, 'effective_department', None) or user.department

        if user.is_super_admin or user.role == 'ADMIN':
            return Department.objects.all().order_by('name')
        elif user.role == 'DEPT_HEAD' and dept:
            return Department.objects.filter(
                Q(id=dept.id) | Q(parent=dept)
            ).distinct()
        elif user.role == 'BUSINESS_ADMIN':
            return Department.objects.filter(is_active=True).order_by('name')
        elif dept:
            return Department.objects.filter(id=dept.id)
        return Department.objects.filter(is_active=True).order_by('name')

    @action(detail=False, methods=['get'], url_path='candidate-incharges')
    def candidate_incharges(self, request):
        dept_id = request.query_params.get('department_id')

        busy_heads = Department.objects.filter(is_active=True, incharge__isnull=False)
        if dept_id:
            busy_heads = busy_heads.exclude(id=dept_id)
        busy_head_ids = busy_heads.values_list('incharge_id', flat=True)

        candidates = User.objects.filter(
            role__in=['DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN'],
            is_active=True
        ).exclude(
            role='DEPT_HEAD',
            id__in=busy_head_ids
        ).order_by('full_name', 'username')

        return Response([
            {
                'id': u.id,
                'name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Dept Head'
            }
            for u in candidates
        ])

    def create(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can create departments.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            dept = serializer.save()

            log_system_event(
                actor=request.user,
                action_type='DEPARTMENT_CREATED',
                module='ORGANIZATION',
                entity_id=dept.id,
                entity_name=dept.name,
                new_values={
                    'name': dept.name,
                    'code': dept.code,
                    'incharge': dept.incharge.username if dept.incharge else None
                },
                remarks=f"Created department {dept.name} ({dept.code})",
                request=request
            )

        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can edit department details.'}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        old_data = {
            'name': instance.name,
            'code': getattr(instance, 'code', ''),
            'parent': instance.parent.name if instance.parent else None,
            'incharge': instance.incharge.username if instance.incharge else None
        }

        data = request.data.copy()
        data.pop('code', None)

        serializer = self.get_serializer(instance, data=data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            updated_dept = serializer.save()

            new_data = {
                'name': updated_dept.name,
                'code': getattr(updated_dept, 'code', ''),
                'parent': updated_dept.parent.name if updated_dept.parent else None,
                'incharge': updated_dept.incharge.username if updated_dept.incharge else None
            }

            log_system_event(
                actor=request.user,
                action_type='DEPARTMENT_UPDATED',
                module='ORGANIZATION',
                entity_id=updated_dept.id,
                entity_name=updated_dept.name,
                old_values=old_data,
                new_values=new_data,
                remarks=f"Updated department {updated_dept.name} ({getattr(updated_dept, 'code', '')})",
                request=request
            )

        return Response(DepartmentSerializer(updated_dept).data)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins and Super Admins can delete departments.'}, status=status.HTTP_403_FORBIDDEN)
        
        instance = self.get_object()

        active_users_count = instance.department_users.filter(is_active=True).count()
        if active_users_count > 0:
            return Response(
                {'detail': f"Cannot delete Department '{instance.name}'. There are {active_users_count} active user(s) mapped to it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        active_matrices_count = instance.department_businesses.filter(is_active=True).count()
        if active_matrices_count > 0:
            return Response(
                {'detail': f"Cannot delete Department '{instance.name}'. There are {active_matrices_count} active matrix branch(es) linked to it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        d_name = instance.name
        d_id = instance.id
        instance.delete()

        log_system_event(
            actor=request.user,
            action_type='DEPARTMENT_DELETED',
            module='ORGANIZATION',
            entity_id=d_id,
            entity_name=d_name,
            remarks=f"Deleted department: {d_name}",
            request=request
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        if not (request.user.is_super_admin or request.user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        dept = self.get_object()
        
        if dept.is_active:
            active_users_count = dept.department_users.filter(is_active=True).count()
            if active_users_count > 0:
                return Response(
                    {'detail': f"Cannot disable '{dept.name}'. {active_users_count} active user(s) are assigned to it. Reassign or remove them first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            active_matrices_count = dept.department_businesses.filter(is_active=True).count()
            if active_matrices_count > 0:
                return Response(
                    {'detail': f"Cannot disable '{dept.name}'. {active_matrices_count} active matrix branch(es) are linked to it. Disable or remove those matrices first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        dept.is_active = not dept.is_active
        dept.save(update_fields=['is_active'])

        log_system_event(
            actor=request.user,
            action_type='DEPARTMENT_STATUS_TOGGLED',
            module='ORGANIZATION',
            entity_id=dept.id,
            entity_name=dept.name,
            new_values={'is_active': dept.is_active},
            remarks=f"Department status set to {'Active' if dept.is_active else 'Disabled'}",
            request=request
        )

        return Response({
            'status': 'success',
            'department_id': dept.id,
            'is_active': dept.is_active,
            'message': f"Department '{dept.name}' is now {'Active' if dept.is_active else 'Disabled'}."
        })


# ==========================================
# 4. CROSS-MATRIX (BUSINESS-DEPARTMENT) VIEWSET
# ==========================================
class BusinessDepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessDepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        biz = getattr(user, 'effective_business', None) or user.business
        dept = getattr(user, 'effective_department', None) or user.department

        queryset = BusinessDepartment.objects.select_related(
            'business', 'department', 'supervisor', 'created_by'
        ).all()

        # Strict matrix scoping per role
        if user.is_super_admin or user.role == 'ADMIN':
            return queryset.order_by('business__name', 'department__name')
        elif user.role == 'BUSINESS_ADMIN':
            return queryset.filter(business=biz).order_by('department__name') if biz else BusinessDepartment.objects.none()
        elif user.role == 'DEPT_HEAD':
            return queryset.filter(department=dept).order_by('business__name') if dept else BusinessDepartment.objects.none()
        elif user.role == 'SUPERVISOR':
            return queryset.filter(supervisor=user).order_by('business__name')
        return BusinessDepartment.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        biz_id = request.data.get('business')
        dept_id = request.data.get('department')
        user_biz = getattr(user, 'effective_business', None) or user.business
        user_dept = getattr(user, 'effective_department', None) or user.department

        if user.role == 'BUSINESS_ADMIN':
            if not user_biz or user_biz.id != int(biz_id):
                return Response(
                    {'detail': 'Business Admins cannot create matrices outside their business.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.role == 'DEPT_HEAD':
            if not user_dept or user_dept.id != int(dept_id):
                return Response(
                    {'detail': 'Department Heads cannot create matrices outside their department.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not (user.is_super_admin or user.role == 'ADMIN'):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            supervisor_user = serializer.validated_data.get('supervisor') or user
            if supervisor_user and supervisor_user.role not in ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']:
                return Response(
                    {'detail': f"Matrix Incharge must be Supervisor or higher (cannot be {supervisor_user.role})."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            matrix = serializer.save(supervisor=supervisor_user, created_by=user)

            log_system_event(
                actor=user,
                action_type='MATRIX_CREATED',
                module='MATRIX',
                entity_id=matrix.id,
                entity_name=f"{matrix.business.code} - {matrix.department.name}",
                new_values={
                    'business': matrix.business.name,
                    'department': matrix.department.name,
                    'supervisor': supervisor_user.username if supervisor_user else None
                },
                remarks=f"Created matrix branch {matrix.business.code} - {matrix.department.name}",
                request=request
            )

        return Response(BusinessDepartmentSerializer(matrix).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        user_biz = getattr(user, 'effective_business', None) or user.business
        user_dept = getattr(user, 'effective_department', None) or user.department

        if user.role == 'BUSINESS_ADMIN' and user_biz != instance.business:
            return Response({'detail': 'Permission denied outside your business.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'DEPT_HEAD' and user_dept != instance.department:
            return Response({'detail': 'Permission denied outside your department.'}, status=status.HTTP_403_FORBIDDEN)
        elif not (user.is_super_admin or user.role in ['ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(instance, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            old_sup = instance.supervisor
            updated_matrix = serializer.save()
            new_sup = updated_matrix.supervisor

            log_system_event(
                actor=user,
                action_type='MATRIX_UPDATED',
                module='MATRIX',
                entity_id=updated_matrix.id,
                entity_name=f"{updated_matrix.business.code} - {updated_matrix.department.name}",
                old_values={'supervisor': old_sup.username if old_sup else None},
                new_values={'supervisor': new_sup.username if new_sup else None},
                remarks=f"Updated matrix branch {updated_matrix}",
                request=request
            )

        return Response(BusinessDepartmentSerializer(updated_matrix).data)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if not (user.is_super_admin or user.role == 'ADMIN'):
            return Response({'detail': 'Only Admins can delete matrix branches.'}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        
        active_members_count = instance.matrix_members.filter(is_active=True).count()
        if active_members_count > 0:
            return Response(
                {'detail': f"Cannot delete Matrix '{instance}'. {active_members_count} active user(s) are assigned to this branch. Remove all members first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        m_title = f"{instance.business.code} - {instance.department.name}"
        m_id = instance.id
        instance.delete()

        log_system_event(
            actor=user,
            action_type='MATRIX_DELETED',
            module='MATRIX',
            entity_id=m_id,
            entity_name=m_title,
            remarks=f"Deleted matrix branch: {m_title}",
            request=request
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = request.user
        if not (user.is_super_admin or user.role in ['ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD']):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        matrix_unit = self.get_object()

        if matrix_unit.is_active:
            active_members_count = matrix_unit.matrix_members.filter(is_active=True).count()
            if active_members_count > 0:
                return Response(
                    {'detail': f"Cannot disable Matrix branch. {active_members_count} active user(s) are currently inside. Remove or reassign members first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        matrix_unit.is_active = not matrix_unit.is_active
        matrix_unit.save(update_fields=['is_active'])

        log_system_event(
            actor=user,
            action_type='MATRIX_STATUS_TOGGLED',
            module='MATRIX',
            entity_id=matrix_unit.id,
            entity_name=f"{matrix_unit.business.code} - {matrix_unit.department.name}",
            new_values={'is_active': matrix_unit.is_active},
            remarks=f"Matrix branch status set to {'Active' if matrix_unit.is_active else 'Disabled'}",
            request=request
        )

        return Response({
            'status': 'success',
            'id': matrix_unit.id,
            'is_active': matrix_unit.is_active,
            'message': f"Matrix branch is now {'Active' if matrix_unit.is_active else 'Disabled'}."
        })

    @action(detail=True, methods=['post'], url_path='assign-supervisor')
    def assign_supervisor(self, request, pk=None):
        matrix_unit = self.get_object()
        actor = request.user
        supervisor_id = request.data.get('supervisor_id')
        old_supervisor = matrix_unit.supervisor
        matrix_title = f"{matrix_unit.business.code} - {matrix_unit.department.name}"
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        if actor.role == 'BUSINESS_ADMIN' and actor_biz != matrix_unit.business:
            return Response({'detail': 'Not allowed outside your business.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'DEPT_HEAD' and actor_dept != matrix_unit.department:
            return Response({'detail': 'Not allowed outside your department.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'SUPERVISOR':
            return Response({'detail': 'Supervisors cannot reassign matrix incharge.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            if not supervisor_id or str(supervisor_id).lower() in ['none', 'null', '0', '']:
                matrix_unit.supervisor = None
                matrix_unit.save(update_fields=['supervisor'])

                if old_supervisor:
                    Notification.objects.create(
                        recipient=old_supervisor,
                        sender=actor,
                        notification_type='METRIX_INCHARGE',
                        title=f"Incharge Relieved: {matrix_title}",
                        message=f"You are no longer in charge of {matrix_title}.",
                        data={'matrix_id': matrix_unit.id, 'action': 'UNASSIGNED'}
                    )

                log_system_event(
                    actor=actor,
                    action_type='MATRIX_INCHARGE_CHANGED',
                    module='MATRIX',
                    entity_id=matrix_unit.id,
                    entity_name=str(matrix_unit),
                    old_values={'supervisor': old_supervisor.username if old_supervisor else None},
                    new_values={'supervisor': None},
                    remarks=f"Unassigned incharge for matrix branch {matrix_unit}",
                    request=request
                )
                return Response({'status': 'success', 'message': 'Matrix incharge unassigned. Members routed to fallback authority.'})

            new_sup = get_object_or_404(User, id=supervisor_id)
            if new_sup.role not in ['SUPERVISOR', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPER_ADMIN']:
                return Response({'detail': 'Incharge must have Supervisor or higher role.'}, status=status.HTTP_400_BAD_REQUEST)

            # Strict Incharge Assignment RBAC checks
            if actor.role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
                if new_sup.id != actor.id and new_sup.role != 'SUPERVISOR':
                    return Response({'detail': 'Business/Department Admins can only assign themselves or unassigned supervisors.'}, status=status.HTTP_403_FORBIDDEN)
            elif actor.role == 'ADMIN':
                if new_sup.role in ['ADMIN', 'SUPER_ADMIN']:
                    return Response({'detail': 'Admins cannot assign fellow Admins or Super Admins as matrix incharges.'}, status=status.HTTP_403_FORBIDDEN)

            if old_supervisor == new_sup:
                return Response({'status': 'success', 'message': 'Supervisor already assigned.'})

            matrix_unit.supervisor = new_sup
            matrix_unit.save(update_fields=['supervisor'])

            base_members = matrix_unit.matrix_members.filter(role='EMPLOYEE')
            old_sup_name = (old_supervisor.full_name or old_supervisor.username) if old_supervisor else "None"
            new_sup_name = new_sup.full_name or new_sup.username

            if old_supervisor:
                Notification.objects.create(
                    recipient=old_supervisor,
                    sender=actor,
                    notification_type='METRIX_INCHARGE',
                    title=f"Matrix Incharge Relieved: {matrix_title}",
                    message=f"You are no longer the in-charge of {matrix_title}. Handed over to {new_sup_name}.",
                    data={'matrix_id': matrix_unit.id, 'role': 'OLD_SUPERVISOR'}
                )

            Notification.objects.create(
                recipient=new_sup,
                sender=actor,
                notification_type='METRIX_INCHARGE',
                title=f"Matrix Incharge Appointed: {matrix_title}",
                message=f"From now on, you are the appointed in-charge of {matrix_title}.",
                data={'matrix_id': matrix_unit.id, 'role': 'NEW_SUPERVISOR'}
            )

            for member in base_members:
                Notification.objects.create(
                    recipient=member,
                    sender=actor,
                    notification_type='METRIX_INCHARGE',
                    title=f"Matrix Supervisor Updated: {matrix_title}",
                    message=f"Your {matrix_title} supervisor has changed from {old_sup_name} to {new_sup_name}.",
                    data={'matrix_id': matrix_unit.id, 'new_supervisor_id': new_sup.id}
                )

            log_system_event(
                actor=actor,
                action_type='MATRIX_INCHARGE_CHANGED',
                module='MATRIX',
                target_user=new_sup,
                entity_id=matrix_unit.id,
                entity_name=str(matrix_unit),
                old_values={'supervisor': old_supervisor.username if old_supervisor else None},
                new_values={'supervisor': new_sup.username},
                remarks=f"Assigned {new_sup.username} as incharge for {matrix_unit}",
                request=request
            )

        return Response({
            'status': 'success',
            'message': f"Assigned {new_sup_name} as Incharge."
        })

    @action(detail=True, methods=['get'], url_path='available-candidates')
    def available_candidates(self, request, pk=None):
        """Returns base employees not yet assigned to any matrix branch."""
        matrix_unit = self.get_object()
        actor = request.user
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        if actor.role == 'SUPERVISOR' and matrix_unit.supervisor != actor:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'BUSINESS_ADMIN' and actor_biz != matrix_unit.business:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'DEPT_HEAD' and actor_dept != matrix_unit.department:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        unassigned_users = User.objects.filter(
            role='EMPLOYEE',
            is_active=True,
            matrix__isnull=True
        ).order_by('full_name', 'username')

        return Response([
            {
                'id': u.id,
                'username': u.username,
                'name': u.full_name or u.username,
                'employee_code': getattr(u, 'employee_code', None) or f"EID{u.id:02d}",
                'designation': u.designation or 'Staff'
            }
            for u in unassigned_users
        ])

    @action(detail=True, methods=['post'], url_path='add-member')
    def add_member(self, request, pk=None):
        matrix_unit = self.get_object()
        actor = request.user
        user_id = request.data.get('user_id')
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        if actor.role == 'SUPERVISOR' and matrix_unit.supervisor != actor:
            return Response({'detail': 'You can only add members to your own matrix.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'BUSINESS_ADMIN' and actor_biz != matrix_unit.business:
            return Response({'detail': 'You can only manage members in your business matrices.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'DEPT_HEAD' and actor_dept != matrix_unit.department:
            return Response({'detail': 'You can only manage members in your department matrices.'}, status=status.HTTP_403_FORBIDDEN)

        member = get_object_or_404(User, id=user_id)
        if member.role != 'EMPLOYEE':
            return Response({'detail': 'Only base Employees can be assigned as matrix members.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            member.matrix = matrix_unit
            member.business = matrix_unit.business
            member.department = matrix_unit.department
            member.reports_to = matrix_unit.effective_incharge
            member.save()

            log_system_event(
                actor=actor,
                action_type='MATRIX_MEMBER_ADDED',
                module='MATRIX',
                target_user=member,
                entity_id=matrix_unit.id,
                entity_name=str(matrix_unit),
                remarks=f"Added {member.username} to matrix branch {matrix_unit}",
                request=request
            )

        return Response({'status': 'success', 'message': f"Added {member.username} to {matrix_unit}."})

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        matrix_unit = self.get_object()
        actor = request.user
        user_id = request.data.get('user_id')
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        if actor.role == 'SUPERVISOR' and matrix_unit.supervisor != actor:
            return Response({'detail': 'You can only remove members from your own matrix.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'BUSINESS_ADMIN' and actor_biz != matrix_unit.business:
            return Response({'detail': 'You can only manage members in your business matrices.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'DEPT_HEAD' and actor_dept != matrix_unit.department:
            return Response({'detail': 'You can only manage members in your department matrices.'}, status=status.HTTP_403_FORBIDDEN)

        member = get_object_or_404(User, id=user_id, matrix=matrix_unit)

        with transaction.atomic():
            member.matrix = None
            member.business = None
            member.department = None
            member.reports_to = None
            member.save()

            log_system_event(
                actor=actor,
                action_type='MATRIX_MEMBER_REMOVED',
                module='MATRIX',
                target_user=member,
                entity_id=matrix_unit.id,
                entity_name=str(matrix_unit),
                remarks=f"Removed {member.username} from matrix branch {matrix_unit}",
                request=request
            )

        return Response({'status': 'success', 'message': f"Removed {member.username} from {matrix_unit}."})

    @action(detail=False, methods=['get'], url_path='candidate-incharges')
    def candidate_incharges(self, request):
        """
        Returns users eligible to lead a specific Matrix branch:
        1. Actor is BUSINESS_ADMIN or DEPT_HEAD:
           - Self
           - Unassigned SUPERVISORs (no active matrix branch)
           - Current supervisor if editing
           - Excludes other admins, peer dept/business admins, and super admins.
        2. Actor is ADMIN:
           - BUSINESS_ADMIN of the selected business
           - DEPT_HEAD of the selected department
           - Unassigned SUPERVISORs
           - Current supervisor if editing
           - Excludes other ADMINs and SUPER_ADMINs.
        3. Actor is SUPER_ADMIN:
           - All of the above PLUS ADMIN users.
        """
        actor = request.user
        matrix_id = request.query_params.get('matrix_id')
        biz_id = request.query_params.get('business_id')
        dept_id = request.query_params.get('department_id')

        busy_supervisors = BusinessDepartment.objects.filter(is_active=True, supervisor__isnull=False)
        if matrix_id:
            busy_supervisors = busy_supervisors.exclude(id=matrix_id)
        busy_sup_ids = busy_supervisors.values_list('supervisor_id', flat=True)

        candidate_q = Q(role='SUPERVISOR') & ~Q(id__in=busy_sup_ids)

        if matrix_id:
            curr_matrix = BusinessDepartment.objects.filter(id=matrix_id).first()
            if curr_matrix and curr_matrix.supervisor_id:
                candidate_q |= Q(id=curr_matrix.supervisor_id)

        if actor.role in ['BUSINESS_ADMIN', 'DEPT_HEAD']:
            # Business/Dept Admin can only assign self or unassigned supervisors
            candidate_q |= Q(id=actor.id)
        elif actor.role == 'ADMIN':
            # Admin can assign matching business admin, matching dept head, or unassigned supervisor
            if biz_id:
                candidate_q |= (
                    Q(role='BUSINESS_ADMIN') & (
                        Q(business_id=biz_id) |
                        Q(managed_businesses__id=biz_id)
                    )
                )
            if dept_id:
                candidate_q |= (
                    Q(role='DEPT_HEAD') & (
                        Q(department_id=dept_id) |
                        Q(managed_departments__id=dept_id)
                    )
                )
        elif actor.role == 'SUPER_ADMIN':
            # Super Admin can assign all matching leads, unassigned supervisors, and other Admins
            candidate_q |= Q(role='ADMIN')
            if biz_id:
                candidate_q |= (
                    Q(role='BUSINESS_ADMIN') & (
                        Q(business_id=biz_id) |
                        Q(managed_businesses__id=biz_id)
                    )
                )
            if dept_id:
                candidate_q |= (
                    Q(role='DEPT_HEAD') & (
                        Q(department_id=dept_id) |
                        Q(managed_departments__id=dept_id)
                    )
                )

        candidates = User.objects.filter(
            candidate_q,
            is_active=True
        ).order_by('full_name', 'username').distinct()

        return Response([
            {
                'id': u.id,
                'name': u.full_name or u.username,
                'role': u.role,
                'designation': u.designation or 'Lead'
            }
            for u in candidates
        ])


# ==========================================
# 5. EMPLOYEE MANAGEMENT VIEWSET
# ==========================================
class EmployeeManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        actor = self.request.user
        qs = User.objects.all().select_related('matrix', 'business', 'department', 'reports_to')
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        # Exclude self from user management listing (self updates are managed via personal profile)
        qs = qs.exclude(id=actor.id)

        if actor.role == 'SUPER_ADMIN':
            # Super Admin sees and manages all accounts across the organization
            qs = qs.order_by('-date_joined')
        elif actor.role == 'ADMIN':
            # Admin sees all lower-tier accounts; excludes other Admins and Super Admins
            qs = qs.exclude(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('-date_joined')
        elif actor.role == 'BUSINESS_ADMIN':
            # Business Admin sees only lower-tier accounts (Supervisor & Employee) strictly within their business
            if actor_biz:
                qs = qs.filter(
                    Q(business=actor_biz) | Q(matrix__business=actor_biz) | Q(managed_businesses=actor_biz),
                    role__in=['SUPERVISOR', 'EMPLOYEE']
                ).order_by('-date_joined')
            else:
                return User.objects.none()
        elif actor.role == 'DEPT_HEAD':
            # Department Admin sees only lower-tier accounts (Supervisor & Employee) strictly within their department
            if actor_dept:
                qs = qs.filter(
                    Q(department=actor_dept) | Q(matrix__department=actor_dept) | Q(managed_departments=actor_dept),
                    role__in=['SUPERVISOR', 'EMPLOYEE']
                ).order_by('-date_joined')
            else:
                return User.objects.none()
        elif actor.role == 'SUPERVISOR':
            # Supervisor sees base employees strictly belonging to their current matrix branch
            eff_matrix = getattr(actor, 'effective_matrix', None) or actor.matrix
            if eff_matrix:
                qs = qs.filter(matrix=eff_matrix, role='EMPLOYEE').order_by('-date_joined')
            else:
                return User.objects.none()
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
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return SubordinateUserSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        log_system_event(
            actor=request.user,
            action_type='USER_CREATED',
            module='USER',
            target_user=user,
            entity_id=user.id,
            entity_name=user.username,
            remarks=f"Created user account {user.username} with role {user.role}",
            request=request
        )

        return Response(SubordinateUserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        target_user = self.get_object()
        actor = request.user

        # 1. Self update is strictly prohibited in User Management table (routes to profile view)
        if actor.id == target_user.id:
            return Response({'detail': 'You cannot edit your own account through User Management. Use your Profile page.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Hierarchy rule: Cannot edit users of equal or higher tier
        actor_rank = ROLE_HIERARCHY_RANK.get(actor.role, 99)
        target_rank = ROLE_HIERARCHY_RANK.get(target_user.role, 99)
        if target_rank <= actor_rank:
            return Response({'detail': 'You cannot modify users in the same or higher administrative tier.'}, status=status.HTTP_403_FORBIDDEN)

        # 3. Entity & Matrix scope guards
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        if actor.role == 'BUSINESS_ADMIN':
            target_biz = getattr(target_user, 'effective_business', None) or target_user.business
            if not target_biz or target_biz.id != actor_biz.id:
                return Response({'detail': 'You can only modify users linked to your assigned business.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'DEPT_HEAD':
            target_dept = getattr(target_user, 'effective_department', None) or target_user.department
            if not target_dept or target_dept.id != actor_dept.id:
                return Response({'detail': 'You can only modify users linked to your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        elif actor.role == 'SUPERVISOR':
            eff_matrix = getattr(actor, 'effective_matrix', None) or actor.matrix
            if not eff_matrix or target_user.matrix_id != eff_matrix.id:
                return Response({'detail': 'Supervisors can only modify members of their own matrix branch.'}, status=status.HTTP_403_FORBIDDEN)
            if request.data.get('role') and request.data.get('role') != 'EMPLOYEE':
                return Response({'detail': 'Supervisors cannot modify employee role tiers.'}, status=status.HTTP_403_FORBIDDEN)

        # 4. Prevent assigning equal or higher roles
        req_role = request.data.get('role')
        if req_role:
            req_rank = ROLE_HIERARCHY_RANK.get(req_role, 99)
            if req_rank <= actor_rank:
                return Response({'detail': 'You cannot elevate a user to your own or higher role tier.'}, status=status.HTTP_403_FORBIDDEN)

        old_matrix = target_user.matrix

        serializer = self.get_serializer(target_user, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()

        if old_matrix != updated_user.matrix:
            old_matrix_title = f"{old_matrix.business.code} - {old_matrix.department.name}" if old_matrix else "No Matrix"
            new_matrix_title = f"{updated_user.matrix.business.code} - {updated_user.matrix.department.name}" if updated_user.matrix else "No Matrix"
            emp_name = updated_user.full_name or updated_user.username

            Notification.objects.create(
                recipient=updated_user,
                sender=actor,
                notification_type='METRIX_TRANSFER',
                title='Matrix Assignment Updated',
                message=f"Your operational branch has been moved from {old_matrix_title} to {new_matrix_title}.",
                data={'old_matrix': old_matrix_title, 'new_matrix': new_matrix_title}
            )

            if old_matrix and old_matrix.supervisor and old_matrix.supervisor != updated_user:
                Notification.objects.create(
                    recipient=old_matrix.supervisor,
                    sender=actor,
                    notification_type='METRIX_TRANSFER',
                    title='Member Transferred Out',
                    message=f"{emp_name} has been transferred out of {old_matrix_title} to {new_matrix_title}.",
                    data={'user_id': updated_user.id}
                )

            if updated_user.matrix and updated_user.matrix.supervisor and updated_user.matrix.supervisor != updated_user:
                Notification.objects.create(
                    recipient=updated_user.matrix.supervisor,
                    sender=actor,
                    notification_type='METRIX_TRANSFER',
                    title='New Member Assigned',
                    message=f"{emp_name} has been assigned to your matrix branch ({new_matrix_title}).",
                    data={'user_id': updated_user.id}
                )

        log_system_event(
            actor=actor,
            action_type='USER_UPDATED',
            module='USER',
            target_user=updated_user,
            entity_id=updated_user.id,
            entity_name=updated_user.username,
            remarks=f"Updated profile details for {updated_user.username}",
            request=request
        )

        return Response(SubordinateUserSerializer(updated_user).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        actor = request.user
        target_user = self.get_object()

        if actor.id == target_user.id:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Hierarchy validation: Can only delete lower tier users
        actor_rank = ROLE_HIERARCHY_RANK.get(actor.role, 99)
        target_rank = ROLE_HIERARCHY_RANK.get(target_user.role, 99)
        if target_rank <= actor_rank:
            return Response({'detail': 'You cannot delete users in the same or higher administrative tier.'}, status=status.HTTP_403_FORBIDDEN)

        if actor.role not in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Only Admins and Super Admins are permitted to delete user accounts.'}, status=status.HTTP_403_FORBIDDEN)

        # Active tasks deletion blocker
        active_tasks = Task.objects.filter(assigned_to=target_user, status__in=ACTIVE_TASK_STATUSES)
        if active_tasks.exists():
            return Response(
                {'detail': f"Cannot delete '{target_user.username}'. The user has {active_tasks.count()} active tasks in progress. Reassign or resolve these tasks before deletion, or disable the account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        u_id = target_user.id
        u_name = target_user.username

        with transaction.atomic():
            Business.objects.filter(incharge=target_user).update(incharge=None)
            Department.objects.filter(incharge=target_user).update(incharge=None)
            BusinessDepartment.objects.filter(supervisor=target_user).update(supervisor=None)

            fallback_manager = target_user.reports_to or User.objects.filter(role='SUPER_ADMIN', is_active=True).first()
            User.objects.filter(reports_to=target_user).update(reports_to=fallback_manager)

            target_user.delete()

        log_system_event(
            actor=actor,
            action_type='USER_DELETED',
            module='USER',
            entity_id=u_id,
            entity_name=u_name,
            remarks=f"Permanently removed user account: {u_name}",
            request=request
        )
        return Response({'detail': f'User {u_name} deleted successfully.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        target_user = self.get_object()
        actor = request.user

        if target_user.id == actor.id:
            return Response({'detail': 'You cannot disable your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Hierarchy validation
        actor_rank = ROLE_HIERARCHY_RANK.get(actor.role, 99)
        target_rank = ROLE_HIERARCHY_RANK.get(target_user.role, 99)
        if target_rank <= actor_rank:
            return Response({'detail': 'You cannot alter the account status of users in the same or higher administrative tier.'}, status=status.HTTP_403_FORBIDDEN)

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

            log_system_event(
                actor=actor,
                action_type='USER_STATUS_TOGGLED',
                module='USER',
                target_user=target_user,
                entity_id=target_user.id,
                entity_name=target_user.username,
                old_values={'is_active': True},
                new_values={'is_active': False},
                remarks=f"Account for {target_user.username} disabled",
                request=request
            )

            return Response({
                'id': target_user.id,
                'username': target_user.username,
                'is_active': False,
                'message': f"Account for {target_user.full_name or target_user.username} is now Disabled."
            }, status=status.HTTP_200_OK)
        else:
            target_user.is_active = True
            target_user.save(update_fields=['is_active'])

            log_system_event(
                actor=actor,
                action_type='USER_STATUS_TOGGLED',
                module='USER',
                target_user=target_user,
                entity_id=target_user.id,
                entity_name=target_user.username,
                old_values={'is_active': False},
                new_values={'is_active': True},
                remarks=f"Account for {target_user.username} enabled",
                request=request
            )

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
        actor_biz = getattr(actor, 'effective_business', None) or actor.business
        actor_dept = getattr(actor, 'effective_department', None) or actor.department

        matrix_qs = BusinessDepartment.objects.filter(is_active=True).select_related(
            'business', 'department', 'supervisor', 'created_by'
        )

        if role in ['SUPER_ADMIN', 'ADMIN']:
            scoped_matrices = matrix_qs
        elif role == 'BUSINESS_ADMIN':
            scoped_matrices = matrix_qs.filter(business=actor_biz) if actor_biz else matrix_qs.none()
        elif role == 'DEPT_HEAD':
            scoped_matrices = matrix_qs.filter(department=actor_dept) if actor_dept else matrix_qs.none()
        elif role == 'SUPERVISOR':
            scoped_matrices = matrix_qs.filter(supervisor=actor)
        else:
            scoped_matrices = matrix_qs.none()

        matrix_options = [
            {
                'id': m.id,
                'name': m.name,
                'code': m.code,
                'title': f"{m.name} [{m.code}] - Lead: {m.effective_incharge.full_name or m.effective_incharge.username if m.effective_incharge else 'Unassigned'}",
                'business_id': m.business.id,
                'business_name': m.business.name,
                'business_code': m.business.code,
                'department_id': m.department.id,
                'department_name': m.department.name,
                'supervisor_id': m.effective_incharge.id if m.effective_incharge else None,
                'supervisor_name': (m.effective_incharge.full_name or m.effective_incharge.username) if m.effective_incharge else 'No Lead Assigned'
            }
            for m in scoped_matrices
        ]

        businesses = Business.objects.filter(is_active=True).select_related('incharge').order_by('name')
        departments = Department.objects.filter(is_active=True).select_related('incharge').order_by('name')

        business_list = [
            {
                'id': b.id,
                'name': b.name,
                'code': b.code,
                'has_incharge': bool(b.incharge_id),
                'incharge_id': b.incharge_id,
                'incharge_name': (b.incharge.full_name or b.incharge.username) if b.incharge else None
            }
            for b in businesses
        ]

        department_list = [
            {
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'has_incharge': bool(d.incharge_id),
                'incharge_id': d.incharge_id,
                'incharge_name': (d.incharge.full_name or d.incharge.username) if d.incharge else None
            }
            for d in departments
        ]

        return Response({
            'matrices': matrix_options,
            'businesses': business_list,
            'departments': department_list,
            'currentUser': {
                'id': actor.id,
                'role': actor.role,
                'matrix_id': actor.matrix_id,
                'business_id': actor_biz.id if actor_biz else None,
                'department_id': actor_dept.id if actor_dept else None
            }
        })


# ==========================================
# 6. USER COCKPIT DETAIL VIEW (INSPECTOR)
# ==========================================
class UserCockpitDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        target_user = User.objects.filter(id=user_id).select_related(
            'matrix', 'business', 'department', 'reports_to'
        ).first()

        if not target_user:
            return Response({'detail': f'User #{user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localtime(timezone.now()).date()

        attendance = AttendanceRecord.objects.filter(user=target_user, date=today).first()
        is_present = attendance.is_present if attendance else False

        all_user_tasks = Task.objects.filter(assigned_to=target_user, is_disabled=False).order_by('-created_at')
        total_assigned_count = all_user_tasks.count()
        active_tasks_count = all_user_tasks.filter(status__in=ACTIVE_WORK_STATUSES).count()
        
        today_committed_count = DailyWorkSelection.objects.filter(user=target_user, date=today).count()
        today_active_committed_count = get_user_today_active_committed_count(target_user)
        user_is_idle = is_user_idle(target_user)

        dept_obj = getattr(target_user, 'effective_department', None) or target_user.department or (target_user.matrix.department if target_user.matrix else None)
        biz_obj = getattr(target_user, 'effective_business', None) or target_user.business or (target_user.matrix.business if target_user.matrix else None)
        mgr_obj = target_user.reports_to or target_user.get_hierarchical_upstream_lead()

        # Dynamic cross-entity display logic
        if target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            dept_display = 'All Departments'
            biz_display = 'All Businesses'
        elif target_user.role == 'BUSINESS_ADMIN':
            biz_display = f"{biz_obj.name} ({biz_obj.code})" if biz_obj else 'No Business'
            dept_display = 'All Departments'
        elif target_user.role == 'DEPT_HEAD':
            dept_display = f"{dept_obj.name}" + (f" ({dept_obj.code})" if getattr(dept_obj, 'code', None) else "") if dept_obj else 'No Department'
            biz_display = 'All Businesses'
        else:
            dept_display = f"{dept_obj.name}" + (f" ({dept_obj.code})" if getattr(dept_obj, 'code', None) else "") if dept_obj else 'No Department'
            biz_display = f"{biz_obj.name} ({biz_obj.code})" if biz_obj else 'No Business'

        joining_date_str = None
        if getattr(target_user, 'date_of_joining', None):
            joining_date_str = (
                target_user.date_of_joining.strftime('%Y-%m-%d')
                if hasattr(target_user.date_of_joining, 'strftime')
                else str(target_user.date_of_joining)
            )

        matrix_display = str(target_user.matrix) if target_user.matrix else (
            'All Matrices' if target_user.role in ['BUSINESS_ADMIN', 'DEPT_HEAD', 'ADMIN', 'SUPER_ADMIN'] else 'No Matrix'
        )

        return Response({
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'full_name': target_user.full_name or target_user.username,
                'email': target_user.email or '',
                'role': target_user.role,
                'designation': target_user.designation or 'Staff',
                'employee_code': getattr(target_user, 'employee_code', None) or f"EID{target_user.id:02d}",
                'date_of_joining': joining_date_str,
                'matrix': matrix_display,
                'department': dept_display,
                'business': biz_display,
                'primary_manager': (mgr_obj.full_name or mgr_obj.username) if mgr_obj else 'Global Operations',
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
                'dual_reporting_leads': target_user.get_dual_reporting_leads(),
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

        log_system_event(
            actor=request.user,
            action_type='ATTENDANCE_MARKED',
            module='AUTH',
            target_user=request.user,
            entity_id=request.user.id,
            entity_name=request.user.username,
            new_values={'is_present': rec.is_present},
            remarks=f"Duty status set to {'Present' if rec.is_present else 'On Leave'}",
            request=request
        )

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
# 9. PASSWORD RESET WITH OTP (LIVE SMTP DISPATCH)
# ==========================================
class RequestPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if user:
            otp = PasswordResetOTP.objects.create(user=user)

            subject = "Your TeamPulse Password Recovery OTP"
            message = (
                f"Hello {user.full_name or user.username},\n\n"
                f"You requested a password reset for your account.\n"
                f"Your 6-digit verification code is:\n\n"
                f"    {otp.otp_code}\n\n"
                f"This code will expire in 10 minutes.\n"
                f"If you did not request this password reset, please ignore this email.\n\n"
                f"— TeamPulse System Security"
            )

            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"SMTP Dispatch Failure: {e}")

            log_system_event(
                actor=None,
                action_type='OTP_REQUESTED',
                module='AUTH',
                target_user=user,
                entity_id=user.id,
                entity_name=user.username,
                remarks=f"Password reset OTP dispatched to {user.email}",
                request=request
            )

        return Response(
            {'detail': 'If this email is registered in our system, a verification code has been dispatched.'},
            status=status.HTTP_200_OK
        )


class ResetPasswordWithOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordWithOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = get_object_or_404(User, email__iexact=email, is_active=True)
        record = PasswordResetOTP.objects.filter(
            user=user, otp_code=otp_code, is_used=False
        ).order_by('-created_at').first()

        if not record or not record.is_valid():
            return Response({'detail': 'Invalid or expired OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        record.is_used = True
        record.save()

        log_system_event(
            actor=user,
            action_type='PASSWORD_RESET_SUCCESS',
            module='AUTH',
            target_user=user,
            entity_id=user.id,
            entity_name=user.username,
            remarks=f"Password successfully reset via OTP for {user.username}",
            request=request
        )

        return Response({'detail': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)


# ==========================================
# 10. SYSTEM AUDIT LOG LIST VIEW (SCOPED RBAC)
# ==========================================
class SystemAuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = SystemAuditLog.objects.select_related('actor', 'target_user').all()

        if user.role == 'SUPER_ADMIN':
            pass

        elif user.role == 'ADMIN':
            admin_user_ids = list(User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN']).values_list('id', flat=True))
            qs = qs.exclude(
                module='USER',
                target_user_id__in=admin_user_ids,
                actor__role='SUPER_ADMIN'
            )

        elif user.role == 'BUSINESS_ADMIN':
            actor_biz = getattr(user, 'effective_business', None) or user.business or (user.matrix.business if user.matrix else None)
            if actor_biz:
                biz_matrix_ids = list(BusinessDepartment.objects.filter(business=actor_biz).values_list('id', flat=True))
                biz_user_ids = list(User.objects.filter(
                    Q(business=actor_biz) | Q(matrix__business=actor_biz) | Q(managed_businesses=actor_biz)
                ).values_list('id', flat=True))

                qs = qs.filter(
                    Q(actor=user) |
                    Q(target_user=user) |
                    Q(actor_id__in=biz_user_ids) |
                    Q(target_user_id__in=biz_user_ids) |
                    Q(module='MATRIX', entity_id__in=biz_matrix_ids) |
                    Q(module='ORGANIZATION', entity_id=actor_biz.id)
                )
            else:
                qs = qs.filter(Q(actor=user) | Q(target_user=user))

        elif user.role == 'DEPT_HEAD':
            actor_dept = getattr(user, 'effective_department', None) or user.department or (user.matrix.department if user.matrix else None)
            if actor_dept:
                dept_matrix_ids = list(BusinessDepartment.objects.filter(department=actor_dept).values_list('id', flat=True))
                dept_user_ids = list(User.objects.filter(
                    Q(department=actor_dept) | Q(matrix__department=actor_dept) | Q(managed_departments=actor_dept)
                ).values_list('id', flat=True))

                qs = qs.filter(
                    Q(actor=user) |
                    Q(target_user=user) |
                    Q(actor_id__in=dept_user_ids) |
                    Q(target_user_id__in=dept_user_ids) |
                    Q(module='MATRIX', entity_id__in=dept_matrix_ids) |
                    Q(module='ORGANIZATION', entity_id=actor_dept.id)
                )
            else:
                qs = qs.filter(Q(actor=user) | Q(target_user=user))

        elif user.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(user, include_self=True)
            supervisor_matrix = getattr(user, 'matrix', None)
            matrix_member_ids = list(supervisor_matrix.matrix_members.values_list('id', flat=True)) if supervisor_matrix else []
            relevant_user_ids = set(subordinate_ids + matrix_member_ids)

            matrix_filter = Q(module='MATRIX', entity_id=supervisor_matrix.id) if supervisor_matrix else Q()

            qs = qs.filter(
                Q(actor_id__in=relevant_user_ids) |
                Q(target_user_id__in=relevant_user_ids) |
                matrix_filter
            )

        else:
            qs = qs.filter(Q(actor=user) | Q(target_user=user))

        module_param = request.query_params.get('module')
        if module_param and module_param.upper() != 'ALL':
            qs = qs.filter(module=module_param.upper())

        action_param = request.query_params.get('action_type')
        if action_param:
            qs = qs.filter(action_type=action_param)

        search_query = request.query_params.get('search')
        if search_query:
            qs = qs.filter(
                Q(remarks__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(entity_name__icontains=search_query) |
                Q(actor__username__icontains=search_query) |
                Q(target_user__username__icontains=search_query)
            )

        logs = qs.order_by('-timestamp')[:150]

        payload = [
            {
                'id': log.id,
                'action_type': log.action_type,
                'module': log.module,
                'actor_id': log.actor_id,
                'actor_username': log.actor.username if log.actor else 'SYSTEM',
                'actor_name': (log.actor.full_name or log.actor.username) if log.actor else 'SYSTEM',
                'target_user_id': log.target_user_id,
                'target_username': log.target_user.username if log.target_user else None,
                'target_name': (log.target_user.full_name or log.target_user.username) if log.target_user else None,
                'entity_id': log.entity_id,
                'entity_name': log.entity_name,
                'old_values': log.old_values,
                'new_values': log.new_values,
                'remarks': log.remarks,
                'timestamp': log.timestamp.isoformat(),
            }
            for log in logs
        ]

        return Response(payload, status=status.HTTP_200_OK)