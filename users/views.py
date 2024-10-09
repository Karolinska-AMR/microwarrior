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
