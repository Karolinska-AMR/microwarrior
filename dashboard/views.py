from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
def home(request):
    return render(request, 'home.html')
@login_required
def dashboard(request):
    fname = request.user.first_name
    return render(request,'dashboard.html', {"name":fname})