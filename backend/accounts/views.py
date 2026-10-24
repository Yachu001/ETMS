from datetime import time
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Business, Department, UserDepartment, UserReporting, AttendanceRecord, PasswordResetOTP
from .serializers import (
    CustomTokenObtainPairSerializer,
    BusinessSerializer,
    DepartmentSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    SubordinateUserSerializer,
    RequestOTPSerializer,
    ResetPasswordWithOTPSerializer,
    AssignReportingSerializer
)
from .utils import get_subordinate_ids, build_hierarchy_tree

User = get_user_model()


# ==========================================
# PERMISSION CLASSES
# ==========================================
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


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserCreateView(generics.CreateAPIView):
    serializer_class = UserCreateSerializer
    permission_classes = [IsSupervisorOrAdmin]


# ==========================================
# BUSINESS ENTITY MANAGEMENT
# ==========================================
class BusinessViewSet(viewsets.ModelViewSet):
    """
    CRUD for Business / Company Entities.
    - GET: Available to all authenticated staff to populate filter/assignment dropdowns.
    - POST/PUT/DELETE: Admin and Super Admin only.
    """
    queryset = Business.objects.filter(is_active=True).order_by('name')
    serializer_class = BusinessSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOrgAdmin()]
        return [permissions.IsAuthenticated()]


# ==========================================
# DEPARTMENT MANAGEMENT
# ==========================================
class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOrgAdmin()]
        return [permissions.IsAuthenticated()]


class DepartmentManagementView(APIView):
    """Admin CRUD & Member count overview for Departments."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role in ['ADMIN', 'SUPER_ADMIN']:
            departments = Department.objects.all().order_by('name')
        elif user.role == 'SUPERVISOR':
            dept_ids = UserDepartment.objects.filter(user=user).values_list('department_id', flat=True)
            departments = Department.objects.filter(id__in=dept_ids).order_by('name')
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        data = []
        for d in departments:
            lead_rel = UserDepartment.objects.filter(department=d, user__role='SUPERVISOR').first()
            data.append({
                'id': d.id,
                'name': d.name,
                'lead_name': lead_rel.user.username if lead_rel else 'Unassigned',
                'lead_id': lead_rel.user.id if lead_rel else None,
                'total_members': UserDepartment.objects.filter(department=d).count()
            })
        return Response(data)

    def post(self, request):
        if request.user.role not in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('name')
        if not name:
            return Response({'detail': 'Department name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        dept, _ = Department.objects.get_or_create(name=name.strip())
        return Response({'id': dept.id, 'name': dept.name}, status=status.HTTP_201_CREATED)


class AssignUserDepartmentView(APIView):
    permission_classes = [IsOrgAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        dept_id = request.data.get('department_id')
        is_primary = request.data.get('is_primary', True)

        target_user = User.objects.filter(id=user_id).first()
        target_dept = Department.objects.filter(id=dept_id).first()

        if not target_user or not target_dept:
            return Response({'detail': 'Invalid user or department.'}, status=status.HTTP_400_BAD_REQUEST)

        if is_primary:
            UserDepartment.objects.filter(user=target_user).update(is_primary=False)

        UserDepartment.objects.update_or_create(
            user=target_user,
            department=target_dept,
            defaults={'is_primary': is_primary}
        )
        return Response({'detail': 'Department assignment updated successfully.'})


# ==========================================
# EMPLOYEE MANAGEMENT VIEWSET (WITH FILTERING)
# ==========================================
class EmployeeManagementViewSet(viewsets.ModelViewSet):
    """
    Roster management supporting Department, Business, Role, and Status filters:
    - ?department_id=<id>
    - ?business_id=<id>
    """
    permission_classes = [IsSupervisorOrAdmin]
    serializer_class = SubordinateUserSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.all().prefetch_related('businesses', 'departments', 'user_departments')

        # 1. Role Scoping
        if user.role == 'SUPER_ADMIN':
            queryset = queryset.order_by('-date_joined')
        elif user.role in ['ADMIN', 'BUSINESS_ADMIN']:
            queryset = queryset.exclude(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('-date_joined')
        elif user.role == 'SUPERVISOR':
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            queryset = queryset.filter(id__in=subordinate_ids).order_by('-date_joined')
        else:
            return User.objects.none()

        # 2. Filter by Department (e.g., "No Department")
        dept_id = self.request.query_params.get('department_id')
        if dept_id:
            queryset = queryset.filter(user_departments__department_id=dept_id)

        # 3. Filter by Business (e.g., "No Business")
        biz_id = self.request.query_params.get('business_id')
        if biz_id:
            queryset = queryset.filter(businesses__id=biz_id)

        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return SubordinateUserSerializer

    def update(self, request, *args, **kwargs):
        target_user = self.get_object()
        actor = request.user

        if actor.role == 'ADMIN' and target_user.role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Admins are not permitted to modify other Admins.'}, status=status.HTTP_403_FORBIDDEN)

        new_role = request.data.get('role')
        if actor.role == 'ADMIN' and new_role in ['ADMIN', 'SUPER_ADMIN']:
            return Response({'detail': 'Only Super Admins can promote users to Admin.'}, status=status.HTTP_403_FORBIDDEN)

        if actor.role == 'SUPERVISOR':
            if new_role and new_role != 'EMPLOYEE':
                return Response({'detail': 'Supervisors cannot modify employee role tiers.'}, status=status.HTTP_403_FORBIDDEN)
            if 'reports_to_id' in request.data:
                return Response({'detail': 'Supervisors cannot reassign reporting lines.'}, status=status.HTTP_403_FORBIDDEN)

        # Standard field updates
        target_user.username = request.data.get('username', target_user.username)
        target_user.full_name = request.data.get('full_name', target_user.full_name)
        target_user.email = request.data.get('email', target_user.email)
        target_user.phone = request.data.get('phone', target_user.phone)
        target_user.designation = request.data.get('designation', target_user.designation)
        target_user.shift_start_time = request.data.get('shift_start_time', target_user.shift_start_time)
        target_user.shift_end_time = request.data.get('shift_end_time', target_user.shift_end_time)

        if new_role and actor.role in ['ADMIN', 'SUPER_ADMIN']:
            target_user.role = new_role

        # Admin & Super Admin: Department, Business, and Reporting reassignment
        if actor.role in ['ADMIN', 'SUPER_ADMIN']:
            # Reassign Department
            dept_id = request.data.get('department_id')
            if dept_id:
                dept = Department.objects.filter(id=dept_id).first()
                if dept:
                    UserDepartment.objects.filter(user=target_user).update(is_primary=False)
                    UserDepartment.objects.update_or_create(
                        user=target_user,
                        department=dept,
                        defaults={'is_primary': True}
                    )

            # Reassign Businesses
            business_ids = request.data.get('business_ids')
            if business_ids is not None:
                businesses = Business.objects.filter(id__in=business_ids)
                target_user.businesses.set(businesses)

            # Reassign Reporting Manager
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

        target_user.save()
        serializer = self.get_serializer(target_user)
        return Response(serializer.data)

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
            'username': target_user.username,
            'is_active': target_user.is_active,
            'status': 'Active' if target_user.is_active else 'Disabled'
        })


# ==========================================
# USER DETAIL COCKPIT VIEW
# ==========================================
class UserCockpitDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target_user = User.objects.filter(id=user_id).prefetch_related('businesses', 'user_departments').first()
        if not target_user:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserProfileSerializer(target_user)
        return Response(serializer.data)


# ==========================================
# ATTENDANCE TOGGLE VIEW
# ==========================================
class DailyAttendanceToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        rec = AttendanceRecord.objects.filter(user=request.user, date=today).first()
        return Response({
            'date': today,
            'is_present': rec.is_present if rec else False,
            'marked': rec is not None
        })

    def post(self, request):
        today = timezone.now().date()
        is_present = request.data.get('is_present', True)
        rec, _ = AttendanceRecord.objects.update_or_create(
            user=request.user,
            date=today,
            defaults={'is_present': is_present}
        )
        return Response({
            'detail': f"Marked {'Present / On-Duty' if is_present else 'On Leave'}",
            'is_present': rec.is_present
        })


# ==========================================
# PASSWORD RESET VIEWS
# ==========================================
class RequestPasswordResetOTPView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RequestOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            otp = PasswordResetOTP.objects.create(user=user)
            print(f"\n======================================")
            print(f" PASSWORD RESET OTP FOR {user.email}: {otp.otp_code}")
            print(f"======================================\n")

        return Response(
            {"detail": "If this email exists, a 6-digit recovery OTP has been dispatched."},
            status=status.HTTP_200_OK
        )


class ResetPasswordWithOTPView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ResetPasswordWithOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

        otp_record = PasswordResetOTP.objects.filter(
            user=user, otp_code=otp_code, is_used=False
        ).order_by('-created_at').first()

        if not otp_record or not otp_record.is_valid():
            return Response({"detail": "Invalid or expired OTP code."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        otp_record.is_used = True
        otp_record.save()

        return Response({"detail": "Password successfully reset."}, status=status.HTTP_200_OK)


# ==========================================
# HIERARCHY VIEWS
# ==========================================
class MySubordinatesListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_org_admin:
            subordinates = User.objects.exclude(id=user.id).order_by('username')
        elif user.is_supervisor_user:
            subordinate_ids = get_subordinate_ids(user, include_self=False)
            subordinates = User.objects.filter(id__in=subordinate_ids).order_by('username')
        else:
            return Response([])

        serializer = SubordinateUserSerializer(subordinates, many=True)
        return Response(serializer.data)


class OrgHierarchyTreeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupervisorOrAdmin]

    def get(self, request):
        tree = build_hierarchy_tree(request.user)
        return Response(tree)


class AssignReportingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgAdmin]

    def post(self, request):
        serializer = AssignReportingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            employee = User.objects.get(id=data['employee_id'])
            manager = User.objects.get(id=data['manager_id'])
        except User.DoesNotExist:
            return Response({"error": "Employee or Manager not found."}, status=status.HTTP_404_NOT_FOUND)

        if data['is_primary']:
            UserReporting.objects.filter(employee=employee, is_primary=True).update(is_primary=False)

        assignment, _ = UserReporting.objects.update_or_create(
            employee=employee,
            manager=manager,
            defaults={'is_primary': data['is_primary']}
        )

        return Response({
            "message": f"{employee.username} now reports to {manager.username}",
            "is_primary": assignment.is_primary
        }, status=status.HTTP_200_OK)