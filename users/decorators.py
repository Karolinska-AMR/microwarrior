from functools import wraps

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse


def staff_required(view):
    """Like login_required, but the user must also be staff (JSON 403 otherwise)."""

    @login_required
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'error': 'Permission denied'}, status=403)
        return view(request, *args, **kwargs)

    return wrapper
