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


def build_hierarchy_tree(user):
    """
    Constructs a nested tree dictionary representing direct and indirect reports.
    If the requesting user is SUPER_ADMIN, every active user across the platform
    is guaranteed to be visible in the tree (direct, indirect, or root-level fallback).
    """
    today = timezone.localtime(timezone.now()).date()
    visited_ids = set([user.id])

    def get_children(parent_user):
        direct_reports = User.objects.filter(
            Q(reports_to=parent_user) | Q(matrix__supervisor=parent_user, role='EMPLOYEE'),
            is_active=True
        ).distinct().select_related('department', 'business', 'matrix')

        children_list = []
        for emp in direct_reports:
            if emp.id in visited_ids:
                continue

            visited_ids.add(emp.id)

            attendance = emp.attendance_records.filter(date=today).first()
            is_present = attendance.is_present if attendance else False

            biz_name = emp.business.name if emp.business else (emp.matrix.business.name if emp.matrix and emp.matrix.business else None)
            dept_name = emp.department.name if emp.department else (emp.matrix.department.name if emp.matrix and emp.matrix.department else None)

            children_list.append({
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
                'dual_reporting_leads': emp.get_dual_reporting_leads(),
                'subordinates': get_children(emp)
            })

        return children_list

    subordinates = get_children(user)

    # Super Admin root guarantee: include any orphan active users
    if user.role == 'SUPER_ADMIN':
        all_active_users = User.objects.filter(is_active=True).exclude(id=user.id).select_related(
            'department', 'business', 'matrix'
        )
        for orphan in all_active_users:
            if orphan.id not in visited_ids:
                visited_ids.add(orphan.id)
                attendance = orphan.attendance_records.filter(date=today).first()
                is_present = attendance.is_present if attendance else False

                biz_name = orphan.business.name if orphan.business else (orphan.matrix.business.name if orphan.matrix and orphan.matrix.business else None)
                dept_name = orphan.department.name if orphan.department else (orphan.matrix.department.name if orphan.matrix and orphan.matrix.department else None)

                subordinates.append({
                    'id': orphan.id,
                    'username': orphan.username,
                    'full_name': orphan.full_name or orphan.username,
                    'email': orphan.email,
                    'role': orphan.role,
                    'designation': orphan.designation or 'Staff',
                    'is_present': is_present,
                    'business': biz_name,
                    'primary_business': biz_name,
                    'department': dept_name,
                    'primary_department': dept_name,
                    'matrix': str(orphan.matrix) if orphan.matrix else None,
                    'dual_reporting_leads': orphan.get_dual_reporting_leads(),
                    'subordinates': get_children(orphan)
                })

    root_attendance = user.attendance_records.filter(date=today).first()
    root_is_present = root_attendance.is_present if root_attendance else False
    root_biz = user.business.name if user.business else (user.matrix.business.name if user.matrix and user.matrix.business else None)
    root_dept = user.department.name if user.department else (user.matrix.department.name if user.matrix and user.matrix.department else None)

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
        'dual_reporting_leads': user.get_dual_reporting_leads(),
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