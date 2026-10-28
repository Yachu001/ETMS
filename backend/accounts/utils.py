# backend/accounts/utils.py

from django.contrib.auth import get_user_model
from .models import UserReporting

User = get_user_model()


def get_subordinate_ids(manager_user, include_self=False):
    """
    Recursively retrieves all downstream subordinate user IDs
    reporting to manager_user (direct and indirect).
    """
    subordinate_ids = set()
    if include_self:
        subordinate_ids.add(manager_user.id)

    current_level_managers = [manager_user.id]

    while current_level_managers:
        direct_reports = list(
            UserReporting.objects.filter(manager_id__in=current_level_managers)
            .values_list('employee_id', flat=True)
        )

        new_subordinates = [uid for uid in direct_reports if uid not in subordinate_ids]

        if not new_subordinates:
            break

        subordinate_ids.update(new_subordinates)
        current_level_managers = new_subordinates

    return list(subordinate_ids)


def build_hierarchy_tree(user):
    """
    Constructs a nested tree dictionary where 'subordinates' 
    is always a list of direct reports, avoiding duplicate wrapping.
    """
    def get_children(parent_user):
        direct_reports = UserReporting.objects.filter(
            manager_id=parent_user.id
        ).select_related('employee')

        children_list = []
        for report in direct_reports:
            emp = report.employee
            if not emp:
                continue

            primary_dept = emp.user_departments.filter(is_primary=True).select_related('department').first()

            children_list.append({
                'id': emp.id,
                'username': emp.username,
                'email': emp.email,
                'role': emp.role,
                'designation': emp.designation or 'Staff',
                'is_primary_lead': report.is_primary,
                'primary_department': primary_dept.department.name if primary_dept else None,
                'subordinates': get_children(emp)
            })

        return children_list

    root_dept = user.user_departments.filter(is_primary=True).select_related('department').first()
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
        'designation': user.designation or 'Staff',
        'primary_department': root_dept.department.name if root_dept else None,
        'subordinates': get_children(user)
    }