from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from flowrunner import tasks
def home(request):
    return render(request, 'home.html')
@login_required
def dashboard(request):
    fname = request.user.first_name
    return render(request,'dashboard.html', {"name":fname})

def enqueue_task(request):
    if request.method == 'POST':
        res = tasks.spear_mtb.delay(request.POST['ticket'])
        return JsonResponse({'task_id':res.task_id})
    return redirect('dashboard')