import time

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from flowrunner import tasks
from flowrunner.models import Task
from datetime import datetime, timedelta
from django.db.models import F, CharField, Value, Count
from django.db.models.functions import Concat
from iomanager.models import File

from samplesbrowser.models import Sample, Lineage


def home(request):
    return render(request, 'home.html')


@login_required
def dashboard(request):
    fname = request.user.first_name
    return render(request, 'dashboard.html', {"name": fname})


@login_required
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
    return JsonResponse({'data': list(task_bucket), 'ongoing': ongoing_tasks})


@login_required
def get_log(request):
    ticket = request.GET.get('ticket', '')
    task = Task.objects.get(ticket=ticket)
    # if len(task.logs)>0: # completed send the log back
    #     log = task.logs
    # else: # fetch the samples from

    pe_samples = File.objects.filter(ticket=ticket, eof=1).values('sample').annotate(pe=Count('id')).filter(pe=2)
    log = []
    for s in pe_samples:
        log.append({"sample": s["sample"], "species": None, "cryptic": None, "tbprofiler": None})
    return JsonResponse({'data': log})


@login_required
def enqueue_task(request):
    if request.method == 'POST':
        ticket = request.POST["ticket"]
        count = request.POST["samples_count"]
        res = tasks.fake_spear_mtb.delay(ticket)
        ts = Task(name="spear-mtb",
                  status=-1,
                  ticket=ticket,
                  user=request.user,
                  task_id=res.task_id, samples_count=count)
        ts.save()
        return JsonResponse({'task_id': res.task_id})

    return redirect('dashboard')


@login_required
def get_overview(request):
    samples = Sample.objects.all()

    samlist = []
    cat_stat = {"total": 0}
    for sample in samples:
        cat = sample.category.lower()
        if cat not in cat_stat:
            cat_stat[cat] = 0
        cat_stat[cat] += 1
        cat_stat['total'] += 1
        samlist.append({"sample": sample.sample, "date": sample.collection_date, "cat": cat})

    lineages = Lineage.objects.all()
    names = [l.lin for l in lineages]
    hlin = build_hierarchy(names)
    # TODO: fetch abundant R
    # TODO: fetch abundant U

    return JsonResponse({"stats": cat_stat, "samples": samlist, "lineages": hlin})


def build_hierarchy(items):
    def add_or_get_node(hierarchy, name):
        for node in hierarchy:
            if node['name'] == name:
                return node
        new_node = {'name': name, 'children': []}
        hierarchy.append(new_node)
        return new_node

    def set_leaf_counts(hierarchy, lineage, index, max_index):
        if index == max_index:  # If it's a leaf node
            for node in hierarchy:
                if node['name'] == lineage:
                    if 'value' in node:
                        node['value'] += 1
                    else:
                        node['value'] = 1
                    return
            hierarchy.append({'name': lineage, 'value': 1})
            return

        next_name = '.'.join(lineage.split('.')[:index + 1])
        next_node = add_or_get_node(hierarchy, next_name)
        set_leaf_counts(next_node['children'], lineage, index + 1, max_index)

    root = []

    for item in items:
        levels = item.split('.')
        set_leaf_counts(root, item, 0, len(levels) - 1)

    return {"name":"","children":root}
