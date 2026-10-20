from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.utils.safestring import mark_safe
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import PasswordChangeView
from .forms import PasswordChangingForm
from django.utils.translation import gettext as _
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from django.utils.html import escape

from .forms import AddUserForm,EditUserForm, ResetPasswordForm
from .decorators import staff_required

def login_user(request):
    if request.method == "POST":
        email = request.POST['username']
        password = request.POST['password']

        try:
            usr_mdl = User.objects.get(email=email.lower())
            username = usr_mdl.username
        except ObjectDoesNotExist:
            messages.success(request, mark_safe(_("Användaren hittades inte.") + "<br/> <small>" +
                                                _("Vänligen kontrollera ditt användarnamn och försök igen. Om du inte har ett konto, kontakta administratören.") +
                                                ".</small>"))
            return redirect('login')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            messages.success(request, mark_safe(
                _("Ett fel inträffade vid inloggningen")+".<br/> <small>" +
                _("Försök igen senare eller kontakta supporten om problemet kvarstår")+
                "</small>"))
            return redirect('login')
    else:
        return render(request, 'login.html')


def logout_user(request):
    logout(request)
    return redirect('home')


class PasswordsChangeView(LoginRequiredMixin, PasswordChangeView):
    form_class = PasswordChangingForm
    success_url = reverse_lazy('password-success')


def password_success(request):
    return render(request, "password_success.html")

@staff_required
def add_user(request):
    if request.method == "POST":
        form = AddUserForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({"message": "User added successfully!"}, status=200)
        error_messages = []
        for error in form.errors.items():
            field_name, field_errors = error
            for error_message in field_errors:
                error_messages.append(f"{escape(error_message)}")

        return JsonResponse({"errors": '\n'.join(error_messages)}, status=400)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@staff_required
def edit_user(request, user_id):
    user = get_object_or_404(User, id=user_id)
    if user.is_superuser and not request.user.is_superuser:
        return JsonResponse({"error": "Permission denied"}, status=403)
    if request.method == "POST":
        form = EditUserForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return JsonResponse({"message": "User updated successfully!"}, status=200)

        error_messages = []
        for error in form.errors.items():
            field_name, field_errors = error
            for error_message in field_errors:
                error_messages.append(f"{escape(error_message)}")

        return JsonResponse({"errors":'\n'.join(error_messages)}, status=400)
    return JsonResponse({"error": "Invalid request method"}, status=405)

@staff_required
def reset_password(request, user_id):
    user = get_object_or_404(User, id=user_id)
    if user.is_superuser and not request.user.is_superuser:
        return JsonResponse({"error": "Permission denied"}, status=403)
    if request.method == "POST":
        form = ResetPasswordForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return JsonResponse({"message": "Password was reset successfully!"}, status=200)

        error_messages = []
        for error in form.errors.items():
            field_name, field_errors = error
            for error_message in field_errors:
                error_messages.append(f"{escape(error_message)}")

        return JsonResponse({"errors": '\n'.join(error_messages)}, status=400)
    return JsonResponse({"error": "Invalid request method"}, status=405)

