# backend/accounts/audit_service.py

import logging
from django.contrib.auth import get_user_model
from .models import SystemAuditLog

logger = logging.getLogger(__name__)
User = get_user_model()


def log_system_event(
    actor,
    action_type,
    module,
    target_user=None,
    entity_id=None,
    entity_name=None,
    old_values=None,
    new_values=None,
    remarks=None,
    request=None
):
    """
    Standardized helper to record immutable system events in SystemAuditLog.
    
    :param actor: The User instance performing the action.
    :param action_type: String identifier (e.g., 'USER_CREATED', 'MATRIX_REASSIGNED', 'TASK_COMPLETED').
    :param module: One of ('TASK', 'USER', 'MATRIX', 'ORGANIZATION', 'FORM', 'AUTH').
    :param target_user: (Optional) The User instance targeted or affected by the action.
    :param entity_id: (Optional) Numeric ID of the primary entity (Task ID, Matrix ID, Business ID, etc.).
    :param entity_name: (Optional) Human-readable name or title of the entity.
    :param old_values: (Optional) Dictionary capturing previous state.
    :param new_values: (Optional) Dictionary capturing new state.
    :param remarks: (Optional) Summary explanation or notes.
    :param request: (Optional) The incoming DRF request object to extract IP address.
    """
    try:
        ip = None
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')

        return SystemAuditLog.objects.create(
            actor=actor if (actor and actor.is_authenticated) else None,
            action_type=action_type,
            module=module,
            target_user=target_user,
            entity_id=entity_id,
            entity_name=str(entity_name) if entity_name else None,
            old_values=old_values or {},
            new_values=new_values or {},
            remarks=remarks,
            ip_address=ip
        )
    except Exception as e:
        # Logging failure should never crash primary database transactions
        logger.error(f"Failed to record SystemAuditLog [{action_type}]: {str(e)}")
        return None