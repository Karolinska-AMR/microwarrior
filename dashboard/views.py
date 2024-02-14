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
from django.db.models import Sum, F
from samplesbrowser.models import Sample, Lineage, Mutation, Drug


def home(request):
    return render(request, 'home.html')


@login_required
def dashboard(request):
    fname = request.user.first_name
    return render(request, 'dashboard.html', {"name": fname})


@login_required
def get_jobs(request):
    # Fetch ongoing task from CELERY
    tasks_stat = tasks.update_status()
    # Get task from DB
    end_date = datetime.now()
    start_date = end_date - timedelta(days=10)
    tasks_records = Task.objects.filter(
        submission_timestamp__gte=start_date,
        submission_timestamp__lte=end_date
    ).order_by('-submission_timestamp') \
        .values('id', 'task_id', 'ticket', 'submission_timestamp',
                'completion_timestamp', 'status', 'samples_count',
                submitter=Concat(F('user__first_name'),
                                 Value(' '),
                                 F('user__last_name'), output_field=CharField())
                )
    order = 2
    ongoing_tasks = 0
    tasks_list = []
    for tsk in tasks_records:
        tmp = {"id": tsk['task_id'],
               'ticket': tsk['ticket'],
               'submission_timestamp': tsk['submission_timestamp'],
               'completion_timestamp': tsk['completion_timestamp'],
               "status": None,
               'samples_count': tsk['samples_count'],
               'submitter': tsk['submitter'],
               'order': None
               }

        if tsk['task_id'] in tasks_stat['active']:
            tmp['status'] = 'Running'
            tmp['order'] = 1
            ongoing_tasks += 1

            if tsk['status'] != -1:
                Task.objects.filter(task_id=tsk['task_id']).update(status=-1)

        elif tsk['task_id'] in tasks_stat['reserved']:
            tmp['status'] = 'Enqueued'
            ongoing_tasks += 1
            tmp['order'] = order
            order += 1
        else:
            # in case the celery inspect failed
            is_running = False
            if tsk['status'] == 0:
                tmp['status'] = 'Completed'
            elif tsk['status'] == 1:
                tmp['status'] = 'Failed'
            elif tsk['status'] == -1:
                if tmp['completion_timestamp'] is not None:
                    tmp['status'] = 'Failed'
                    Task.objects.filter(task_id=tsk['task_id']).update(status=1)
                else:
                    tmp['status'] = 'Running'
                    tmp['order'] = 1
                    is_running = True
            elif tsk['status'] == -2:
                tmp['status'] = 'Enqueued'

            if not is_running:
                tmp['order'] = order
            order += 1
        tasks_list.append(tmp)

    return JsonResponse({'data': tasks_list, 'ongoing': ongoing_tasks,'active':tasks_stat['active']})


@login_required
def get_log(request):
    log = {}
    ticket = request.GET.get('ticket', '')
    task = Task.objects.get(ticket=ticket)
    pe_samples = File.objects.filter(ticket=ticket, eof=1).values('sample').annotate(pe=Count('id')).filter(pe=2)

    for s in pe_samples:
        pass_cry = None
        pass_tbp = None
        if task.status >= 0:
            pass_cry = False
            pass_tbp = False
        log[s["sample"]] = {"sample": s["sample"], "species": 'Other',
                            "cryptic": pass_cry, "tbprofiler": pass_tbp,
                            "status": task.status}
    samples = Sample.objects.filter(task=task)
    if samples.exists():
        for s in samples:
            sn = s.sample
            if sn in log:
                ptr = log[sn]
                ptr["species"] = 'MTB'
                ptr["cryptic"] = s.passed_cryptic
                ptr["tbprofiler"] = s.passed_tbprofiler

    return JsonResponse({'data': list(log.values())})


@login_required
def enqueue_task(request):
    if request.method == 'POST':
        ticket = request.POST["ticket"]
        count = request.POST["samples_count"]
        res = tasks.spear_mtb.delay(ticket)
        ts = Task(name="spear-mtb",
                  status=-2,
                  ticket=ticket,
                  user=request.user,
                  task_id=res.task_id,
                  samples_count=count)
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

    top_mu = fetch_abundant_mutations(10)

    return JsonResponse({"stats": cat_stat, "samples": samlist, "lineages": hlin, 'mutations': top_mu})


def check_sample_ids(request):
    sample_names = request.GET.getlist('samples')

    invalid_samples = []
    # Check for samples in Sample model
    analyzed_samples = Sample.objects.filter(sample__in=sample_names).values_list('sample', flat=True)
    data = []
    for s in list(analyzed_samples):
        invalid_samples.append(s)
        data.append({"sample": s, "reason": 'analyzed'})
    # Check for samples in File model with Status -1 or -2
    ongoing_enqueued_samples = File.objects.filter(
        sample__in=sample_names,
        ticket__in=Task.objects.filter(status__in=[-1, -2]).values_list('ticket', flat=True)
    ).values_list('sample', flat=True)
    for s in ongoing_enqueued_samples:
        invalid_samples.append(s)
        data.append({"sample": s, "reason": 'enqueued'})

    valid_samples = set(sample_names).difference(invalid_samples)
    all_invalid = len(valid_samples) == 0

    return JsonResponse({"samples": data, "all_invalid": all_invalid})


def fetch_abundant_mutations(size=10):
    # A dictionary to hold the top mutations for each drug and prediction value
    top_mutations_grouped = {'R': {}, 'U': {}}
    # Fetch all drugs
    drugs = Drug.objects.all()
    for prediction_value in ['R', 'U']:
        for drug in drugs:
            # Calculate the total frequency of mutations for this drug and prediction value
            total_freq = Mutation.objects.filter(
                variant__drug=drug,
                variant__prediction=prediction_value,
                variant__name='WHO-UCN-2023.5'
            ).aggregate(total=Sum('freq'))['total'] or 1

            # Fetch top 10 mutations for the current drug and prediction value
            top_mutations = Mutation.objects.filter(
                variant__drug=drug,
                variant__prediction=prediction_value,
                variant__name='WHO-UCN-2023.5'
            ).values(
                'variant__gene', 'variant__variant'
            ).annotate(
                freq_sum=Sum('freq')
            ).annotate(
                freq_percentage=F('freq_sum') / total_freq
            ).order_by('-freq_sum')[:size]

            # Format the results as a list of dictionaries
            formatted_mutations = [
                {'mutation': f"{mutation['variant__gene']}@{mutation['variant__variant']}",
                 'frequency': round(mutation['freq_percentage'], 2)}
                for mutation in top_mutations
            ]
            if len(formatted_mutations) > 0:
                top_mutations_grouped[prediction_value][drug.name] = formatted_mutations

    return top_mutations_grouped


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

    return {"name": "", "children": root}

@login_required
def under_construction(request):
    fname = request.user.first_name
    page = request.path.strip('/')
    return render(request, 'under_contruction.html', {"name": fname,"page":page})
