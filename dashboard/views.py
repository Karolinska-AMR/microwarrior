from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from flowrunner import tasks
from flowrunner.models import Task
from datetime import datetime, timedelta
from django.db.models import F, CharField, Value
from django.db.models.functions import Concat


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
    # json_data = json.dumps(list(task_bucket),cls=DjangoJSONEncoder)
    return JsonResponse({'data': list(task_bucket),'ongoing': ongoing_tasks})


def enqueue_task(request):
    if request.method == 'POST':
        res = tasks.spear_mtb.delay(request.POST['ticket'])
        ts = Task(name="spear-mtb",
                  status=-1,
                  ticket=request.POST["ticket"],
                  user=request.user,
                  task_id=res.task_id)
        ts.save()
        return JsonResponse({'task_id': res.task_id})

    return redirect('dashboard')
