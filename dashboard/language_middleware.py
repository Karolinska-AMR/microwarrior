# your_app/middleware/language_middleware.py

from django.utils import translation

class LanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user_language = request.session.get('django_language', 'sv-se')
        translation.activate(user_language)
        request.LANGUAGE_CODE = user_language

        response = self.get_response(request)
        return response
