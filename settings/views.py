from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect


@login_required
def get_page(request):
    if request.user.is_staff:
        return render(request, 'settings.html', {"name": request.user.first_name, 'is_staff': request.user.is_staff})
    return redirect('home')
