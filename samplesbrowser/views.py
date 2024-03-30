from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from .models import Sample, Evidence, Mutation, Drug, Meta
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count
from itertools import chain
from django.db.models import Q
from django.db.models.functions import ExtractWeek, ExtractYear
from flowrunner.models import Task

@login_required
def samplesbrowser(request):
    fname = request.user.first_name
    return render(request, 'sambrow.html', {"name": fname})


# TODO: use django-ratelimit to control the rate of request
@login_required
def fetch_samples(request):
    ticket = request.GET.get('tkt', None)
    sample_id = request.GET.get('sid', None)
    week_number = request.GET.get('wn', None)
    date_from = request.GET.get('dtf', None)
    date_to = request.GET.get('dtt', None)
    lineage = request.GET.get('lin', None)
    mutation = request.GET.get('rmu', None)
    drug = request.GET.get('drg', None)
    resistance_category = request.GET.get('rca', None)

    queryset = Sample.objects.annotate(
        extracted_week=ExtractWeek('collection_date'),
        extracted_year=ExtractYear('collection_date')
    )

    query = Q()
    if ticket:
        query &= Q(task__ticket=ticket)

    if sample_id:
        query &= Q(sample__icontains=sample_id)

    if week_number:
        y4, w = week_number.split('-')
        w = int(w.strip('W'))
        y4 = int(y4)
        query &= Q(extracted_week=w, extracted_year=y4)

    if date_from:
        query &= Q(collection_date__gte=date_from)

    if date_to:
        query &= Q(collection_date__lte=date_to)

    if lineage:
        query &= Q(lineage__lin__icontains=lineage)

    if mutation:
        gene,variant = mutation.split('@')
        query &= Q(s_mutations__variant__icontains=variant) & Q(s_mutations__gene__icontains=gene)

    if drug:
        query &= Q(s_mutations__drug__name__icontains=drug) & Q(s_mutations__prediction='R')

    if resistance_category:
        query &= Q(category__icontains=resistance_category)

    results = queryset.filter(query).distinct()

    data = {}
    for sample in results:
        lineage = getattr(sample, 'lineage', None)
        lineage_data = {
            'lineage': lineage.lin,
            'family': lineage.family,
            'rd': lineage.rd,
            'spoligotype': lineage.spoligotype,
            'is_mixed': lineage.is_mixed
        } if lineage else {}
        data[sample.id] = {}
        data[sample.id]["info"] = {"id": sample.id, "sample": sample.sample,
                                   "collection_date": sample.collection_date,
                                   "category": sample.category,
                                   "lineage": lineage_data,
                                   "pass_tbprofiler": sample.passed_tbprofiler,
                                   "pass_cryptic": sample.passed_cryptic,
                                   "pass_who": sample.passed_who
                                   }

    return JsonResponse(data)


@login_required
def fetch_meta(request):
    return JsonResponse(get_meta())


@login_required
def fetch_mutations(request):
    sample_ids = request.GET.getlist('sids')
    sample_data = {}
    for id in sample_ids:

        sample = get_object_or_404(
            Sample.objects.prefetch_related('s_mutations__drug', 's_umutations__variant__drug'),
            id=id)

        catalogs = list(Meta.objects.filter(type__exact='catalog').values_list('name').distinct())
        data = {"mutations": {c[0]: [] for c in catalogs},
                "unverified_mutations": [], "evidence": {}, "qc": {}, 'predictions': {}}

        ptr_mu = data["mutations"]
        ptr_ev = data["evidence"]
        for mu in sample.s_mutations.all():
            cat = mu.catalog
            if mu.prediction in ['R', 'U']:
                drug = mu.drug.name
                if drug not in ptr_mu:
                    ptr_mu[drug] = {}
                if cat not in ptr_mu[drug]:
                    ptr_mu[drug][cat] = []

                ptr_mu[drug][cat].append({
                    "id": mu.id,
                    "freq": mu.freq,
                    "depth": mu.depth,
                    "gene": mu.gene,
                    "variant": mu.variant,
                    "pred": mu.prediction,
                    'format': ['HGSV', 'GARC1'][cat.startswith('CRyPTIC')]
                })
                if cat.startswith('WHO'):
                    if mu.drug.name not in ptr_ev:
                        ptr_ev[mu.drug.name] = []
                    evi = Evidence.objects.filter(name=cat,gene=mu.gene,variant=mu.variant,drug_id=mu.drug.id).first()
                    if evi is not None:
                        ptr_ev[mu.drug.name].append({'id': evi.id,
                                                  "mutation": f"{evi.gene}@{evi.variant}",
                                                  "drug": mu.drug.name,
                                                  'ppv': evi.ppv,
                                                  'OR': evi.odd_ratio,
                                                  'sens': evi.sensitivity,
                                                  'spec': evi.specificity,
                                                  'present_solo_r': evi.present_solo_r,
                                                  'present_solo_s': evi.present_solo_s,
                                                  'present_r': evi.present_r,
                                                  'present_s': evi.present_s,
                                                  'absent_r': evi.absent_r,
                                                  'absent_s': evi.absent_s,
                                                  'grade': evi.grade,
                                                  "pred": evi.prediction,
                                                  'effect': evi.effect, })
                    else:
                        print(mu.variant)
        ptr_umu = data["unverified_mutations"]
        for umu in sample.s_umutations.all():
            evi = umu.variant
            if evi.prediction in ['R', 'U']:
                if evi.name.startswith('WHO'):
                    ptr_umu.append({'id': umu.id,
                                    "mutation": f"{evi.gene}@{evi.variant}",
                                    "drug": evi.drug.name,
                                    'ppv': evi.ppv,
                                    'OR': evi.odd_ratio,
                                    'sens': evi.sensitivity,
                                    'spec': evi.specificity,
                                    'present_solo_r': evi.present_solo_r,
                                    'present_solo_s': evi.present_solo_s,
                                    'present_r': evi.present_r,
                                    'present_s': evi.present_s,
                                    'absent_r': evi.absent_r,
                                    'absent_s': evi.absent_s,
                                    'grade': evi.grade,
                                    "pred": evi.prediction,
                                    'effect': evi.effect})
        data['predictions'] = get_ensemble_prediction(id)
        sample_data[id] = data
    return JsonResponse(sample_data)


def get_meta():
    catalogs = list(chain.from_iterable(Meta.objects.filter(type__exact='catalog').values_list('name')))
    drugs = list(chain.from_iterable(Drug.objects.values_list('name').order_by('man_order').distinct()))
    return {'catalogs': catalogs, 'drugs': drugs}


def get_ensemble_prediction(sample_id):
    queryset = Mutation.objects.filter(
        sample_id=sample_id,
        prediction__in=['R', 'U']
    ).values(
        'catalog',
        'drug__name',
        'prediction'
    ).annotate(
        count=Count('id')
    )
    data = {}
    for item in queryset:
        drg = item['drug__name']
        cat_name = item['catalog']
        pred = item['prediction']

        if drg not in data:
            data[drg] = {c[0]: None for c in Meta.objects.filter(type='catalog').values_list('name').distinct()}
            data[drg]['final_pred'] = None

        if pred == 'R':
            data[drg][cat_name] = 'R'
            data[drg]['final_pred'] = 'R'
        elif pred == 'U':
            if data[drg][cat_name] != 'R':
                data[drg][cat_name] = 'U'
            if data[drg]['final_pred'] != 'R':
                data[drg]['final_pred'] = 'U'
    return data
