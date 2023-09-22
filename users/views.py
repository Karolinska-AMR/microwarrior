from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.utils.safestring import mark_safe


def login_user(request):
    if request.method == "POST":
        email = request.POST['username']
        password = request.POST['password']
        usr_mdl = User.objects.get(email=email.lower())
        try:
            username = usr_mdl.username
        except ObjectDoesNotExist:
            messages.success(request, mark_safe("User was not found."
                                                "<br/> <small>Please check your username and try again. If you don't have an account, contact the administrator.</small>"))
            return redirect('login')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return render(request,'dashboard.html', {"name": usr_mdl.first_name})
        else:
            messages.success(request, mark_safe(
                "An error occurred during login.<br/> <small>Please try again later or contact support if the issue persists.</small>"))
            return redirect('login')
    else:
        return render(request, 'login.html')


def logout_user(request):
    logout(request)
    print("logout!!!!")
#    messages.success(request, ("You Were Logged Out!"))
    return redirect('home')
