from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .models import Department, PasswordResetOTP, UserReporting, UserDepartment
from .serializers import (
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    RequestOTPSerializer,
    ResetPasswordWithOTPSerializer,
    SubordinateUserSerializer,
    AssignReportingSerializer,
    DepartmentSerializer,
)
from .permissions import IsSupervisorOrAdmin, IsOrgAdmin
from .utils import get_subordinate_ids, build_hierarchy_tree

User = get_user_model()


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


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOrgAdmin()]
        return [permissions.IsAuthenticated()]


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
            # Prints OTP to development console instead of sending live email
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

class MySubordinatesListView(APIView):
    """
    Returns flat list of users down the logged-in user's reporting tree.
    - Standard Employee: Returns empty list []
    - Supervisor: Returns downstream direct and indirect reports
    - Admin/Super Admin: Returns all users within the organization
    """
    permission_classes = [IsAuthenticated]

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
    """
    Returns nested hierarchy tree for visualization.
    """
    permission_classes = [IsAuthenticated, IsSupervisorOrAdmin]

    def get(self, request):
        tree = build_hierarchy_tree(request.user)
        return Response(tree)


class AssignReportingView(APIView):
    """
    Admin-only assignment of reporting relationships.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

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

        assignment, created = UserReporting.objects.update_or_create(
            employee=employee,
            manager=manager,
            defaults={'is_primary': data['is_primary']}
        )

        return Response({
            "message": f"{employee.username} now reports to {manager.username}",
            "is_primary": assignment.is_primary
        }, status=status.HTTP_200_OK)