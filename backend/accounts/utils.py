# backend/accounts/utils.py

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

User = get_user_model()


def get_subordinate_ids(manager_user, include_self=False):
    """
    Recursively retrieves all downstream subordinate user IDs
    reporting directly or indirectly to manager_user.
    Also handles Supervisors in charge of matrix branches.
    """
    subordinate_ids = set()
    if include_self:
        subordinate_ids.add(manager_user.id)

    current_level_managers = [manager_user.id]

    while current_level_managers:
        direct_reports = list(
            User.objects.filter(reports_to_id__in=current_level_managers, is_active=True)
            .values_list('id', flat=True)
        )
        new_subordinates = [uid for uid in direct_reports if uid not in subordinate_ids]
        if not new_subordinates:
            break
        subordinate_ids.update(new_subordinates)
        current_level_managers = new_subordinates

    # If manager is a Supervisor, add members of their appointed matrices
    if manager_user.role == 'SUPERVISOR':
        matrix_member_ids = User.objects.filter(
            matrix__supervisor=manager_user,
            role='EMPLOYEE',
            is_active=True
        ).values_list('id', flat=True)
        subordinate_ids.update(matrix_member_ids)

    return list(subordinate_ids)


def serialize_tree_node(emp, today, get_children_fn):
    """
    Helper function to serialize a user dictionary node with their active status and details.
    """
    attendance = emp.attendance_records.filter(date=today).first()
    is_present = attendance.is_present if attendance else False

    biz_name = (
        emp.business.name if emp.business 
        else (emp.matrix.business.name if emp.matrix and emp.matrix.business else None)
    )
    dept_name = (
        emp.department.name if emp.department 
        else (emp.matrix.department.name if emp.matrix and emp.matrix.department else None)
    )

    dual_leads = []
    if hasattr(emp, 'get_dual_reporting_leads'):
        dual_leads = emp.get_dual_reporting_leads()

    return {
        'id': emp.id,
        'username': emp.username,
        'full_name': emp.full_name or emp.username,
        'email': emp.email,
        'role': emp.role,
        'designation': emp.designation or 'Staff',
        'is_present': is_present,
        'business': biz_name,
        'primary_business': biz_name,
        'department': dept_name,
        'primary_department': dept_name,
        'matrix': str(emp.matrix) if emp.matrix else None,
        'dual_reporting_leads': dual_leads,
        'subordinates': get_children_fn(emp)
    }


def build_hierarchy_tree(user):
    """
    Constructs a nested tree dictionary representing direct and indirect reports:
    - SUPER_ADMIN: Global organization tree (all active users).
    - ADMIN: Organization-wide tree of all users across the business,
             identical for all admins, excluding other ADMINs and SUPER_ADMIN.
    - DEPT_HEAD: All users within their department across all businesses (Supervisors and Employees).
    - BUSINESS_ADMIN: All users within their business across all departments.
    - SUPERVISOR: Direct reports and members of their appointed matrix branch.
    - EMPLOYEE: Self node only.
    """
    today = timezone.localtime(timezone.now()).date()
    visited_ids = set([user.id])

    # -------------------------------------------------------------
    # 1. SCOPED CANDIDATE POOL DEFINITION
    # -------------------------------------------------------------
    if user.role == 'SUPER_ADMIN':
        candidate_users = User.objects.filter(is_active=True).exclude(id=user.id)

    elif user.role == 'ADMIN':
        # All users across the business, excluding other ADMINs and SUPER_ADMIN
        candidate_users = User.objects.filter(is_active=True).exclude(
            Q(id=user.id) | Q(role__in=['ADMIN', 'SUPER_ADMIN'])
        )

    elif user.role == 'DEPT_HEAD':
        # Resolve department via direct link, property, reverse manager, or matrix
        dept = getattr(user, 'effective_department', None) or user.department
        if not dept and hasattr(user, 'managed_departments'):
            dept = user.managed_departments.filter(is_active=True).first()
        if not dept and user.matrix:
            dept = user.matrix.department

        if dept:
            candidate_users = User.objects.filter(
                Q(department=dept) | Q(matrix__department=dept),
                is_active=True
            ).exclude(Q(id=user.id) | Q(role__in=['ADMIN', 'SUPER_ADMIN']))
        else:
            candidate_users = User.objects.none()

    elif user.role == 'BUSINESS_ADMIN':
        biz = getattr(user, 'effective_business', None) or user.business
        if not biz and hasattr(user, 'managed_businesses'):
            biz = user.managed_businesses.filter(is_active=True).first()
        if not biz and user.matrix:
            biz = user.matrix.business

        if biz:
            candidate_users = User.objects.filter(
                Q(business=biz) | Q(matrix__business=biz),
                is_active=True
            ).exclude(Q(id=user.id) | Q(role__in=['ADMIN', 'SUPER_ADMIN']))
        else:
            candidate_users = User.objects.none()

    elif user.role == 'SUPERVISOR':
        sub_ids = get_subordinate_ids(user, include_self=False)
        candidate_users = User.objects.filter(id__in=sub_ids, is_active=True)

    else:
        # Base employee has no subordinates
        candidate_users = User.objects.none()

    candidate_users = candidate_users.select_related('department', 'business', 'matrix')
    candidate_id_set = set(candidate_users.values_list('id', flat=True))

    # -------------------------------------------------------------
    # 2. RECURSIVE CHILD TRAVERSAL (INSIDE SCOPED CANDIDATE SET)
    # -------------------------------------------------------------
    def get_children(parent_user):
        direct_reports = User.objects.filter(
            Q(reports_to=parent_user) | Q(matrix__supervisor=parent_user, role='EMPLOYEE'),
            id__in=candidate_id_set,
            is_active=True
        ).distinct().select_related('department', 'business', 'matrix')

        children_list = []
        for emp in direct_reports:
            if emp.id in visited_ids:
                continue

            visited_ids.add(emp.id)
            children_list.append(serialize_tree_node(emp, today, get_children))

        return children_list

    # Subordinates that directly report to the root caller
    subordinates = get_children(user)

    # -------------------------------------------------------------
    # 3. ROOT ADOPTION FOR LEADS & UNATTACHED SCOPED USERS
    # -------------------------------------------------------------
    if user.role in ['SUPER_ADMIN', 'ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN']:
        # Priority A: Mount supervisors who belong to this department/pool
        for candidate in candidate_users.filter(role='SUPERVISOR'):
            if candidate.id not in visited_ids:
                visited_ids.add(candidate.id)
                subordinates.append(serialize_tree_node(candidate, today, get_children))

        # Priority B: Mount remaining members whose manager is outside the scoped candidate pool
        for candidate in candidate_users:
            if candidate.id not in visited_ids:
                has_in_pool_manager = (
                    candidate.reports_to_id 
                    and candidate.reports_to_id in candidate_id_set 
                    and candidate.reports_to_id not in visited_ids
                )
                if not has_in_pool_manager:
                    visited_ids.add(candidate.id)
                    subordinates.append(serialize_tree_node(candidate, today, get_children))

    # -------------------------------------------------------------
    # 4. ROOT NODE SERIALIZATION
    # -------------------------------------------------------------
    root_attendance = user.attendance_records.filter(date=today).first()
    root_is_present = root_attendance.is_present if root_attendance else False
    
    root_biz = (
        user.business.name if user.business 
        else (user.matrix.business.name if user.matrix and user.matrix.business else None)
    )
    root_dept = (
        user.department.name if user.department 
        else (user.matrix.department.name if user.matrix and user.matrix.department else None)
    )

    root_dual_leads = []
    if hasattr(user, 'get_dual_reporting_leads'):
        root_dual_leads = user.get_dual_reporting_leads()

    return {
        'id': user.id,
        'username': user.username,
        'full_name': user.full_name or user.username,
        'email': user.email,
        'role': user.role,
        'designation': user.designation or 'Staff',
        'is_present': root_is_present,
        'business': root_biz,
        'primary_business': root_biz,
        'department': root_dept,
        'primary_department': root_dept,
        'matrix': str(user.matrix) if user.matrix else None,
        'dual_reporting_leads': root_dual_leads,
        'subordinates': subordinates
    }


def get_user_today_active_committed_count(user):
    """
    Returns the count of active, incomplete tasks in the user's Today's Commitments.
    """
    from tasks.models import DailyWorkSelection

    today = timezone.localtime(timezone.now()).date()
    return DailyWorkSelection.objects.filter(
        user=user,
        date=today,
        task__status__in=['ACCEPTED', 'IN_PROGRESS'],
        task__is_disabled=False
    ).exclude(task__progress_percentage=100).count()


def is_user_idle(user):
    """
    Evaluates if an employee is currently idle:
    - Must be marked present / on-duty today
    - Has 0 active incomplete tasks in Today's Commitments
    """
    from accounts.models import AttendanceRecord

    today = timezone.localtime(timezone.now()).date()
    attendance = AttendanceRecord.objects.filter(user=user, date=today).first()
    is_present = attendance.is_present if attendance else False

    if not user.is_active or not is_present:
        return False

    return get_user_today_active_committed_count(user) == 0