import time

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from flowrunner import tasks
from flowrunner.models import Task
from datetime import datetime, timedelta
from django.db.models import F, CharField, Value,Count
from django.db.models.functions import Concat
from iomanager.models import File

def home(request):
    return render(request, 'home.html')


@login_required
def dashboard(request):
    fname = request.user.first_name
    return render(request, 'dashboard.html', {"name": fname})


def get_jobs(request):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    task_bucket = Task.objects.filter(
        submission_timestamp__gte=start_date,
        submission_timestamp__lte=end_date
    ).order_by('submission_timestamp') \
        .values('id', 'task_id', 'ticket', 'submission_timestamp',
                'completion_timestamp', 'status',
                submitter=Concat(F('user__first_name'),
                                 Value(' '),
                                 F('user__last_name'), output_field=CharField())
                )
    ongoing_tasks = Task.objects.filter(status=-1).count()
    return JsonResponse({'data': list(task_bucket),'ongoing': ongoing_tasks})

def get_log(request):
    ticket = request.GET.get('ticket','')
    task = Task.objects.get(ticket=ticket)
    # if len(task.logs)>0: # completed send the log back
    #     log = task.logs
    # else: # fetch the samples from

    pe_samples = File.objects.filter(ticket=ticket,eof=1).values('sample').annotate(pe=Count('id')).filter(pe=2)
    log = []
    for s in pe_samples:

        log.append({"sample":s["sample"],"species":None,"cryptic":None,"tbprofiler":None})
    return JsonResponse({'data': log})
def enqueue_task(request):
    if request.method == 'POST':
        ticket = request.POST["ticket"]
        count = request.POST["samples_count"]
        res = tasks.fake_spear_mtb.delay(ticket)
        ts = Task(name="spear-mtb",
                  status=-1,
                  ticket=ticket,
                  user=request.user,
                  task_id=res.task_id,samples_count=count)
        ts.save()
        return JsonResponse({'task_id': res.task_id})

    return redirect('dashboard')
