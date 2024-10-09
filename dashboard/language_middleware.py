# your_app/middleware/language_middleware.py

from django.utils.translation import activate
from django.conf import settings

class LanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if the LANGUAGE_CODE is empty
        if not hasattr(request, 'LANGUAGE_CODE') or not request.LANGUAGE_CODE:
            # Try to get the language from cookies
            lang_code = request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME)

            if lang_code:
                # Activate the language and set it on the request
                activate(lang_code)
                request.LANGUAGE_CODE = lang_code
            else:
                # If no cookie is set, use the default language
                request.LANGUAGE_CODE = settings.LANGUAGE_CODE

        response = self.get_response(request)
        return response