from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from .models import Sample, Catalog, Mutation, Drug
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count


@login_required
def samplesbrowser(request):
    fname = request.user.first_name
    return render(request, 'sambrow.html', {"name": fname})


# TODO: use django-ratelimit to control the rate of request
@login_required
def fetch_samples(request):
    samples = Sample.objects.select_related('lineage').all()
    data = {}
    for sample in samples:
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
                                   }

    return JsonResponse(data)


@login_required
def fetch_mutations(request):
    sample_ids = request.GET.getlist('sids')
    sample_data = {}
    for id in sample_ids:
        sample = get_object_or_404(
            Sample.objects.prefetch_related('s_mutations__variant__drug', 's_umutations__variant__drug'),
            id=id)

        data = {"mutations": {c[0]: [] for c in Catalog.objects.values_list('name').distinct()},
                "unverified_mutations": {}, "evidence": {}, "qc": {}, 'predictions': {}}
        ptr_mu = data["mutations"]
        ptr_ev = data["evidence"]
        for mu in sample.s_mutations.all():
            var = mu.variant
            if var.prediction in ['R', 'U']:
                if var.name not in ptr_mu:
                    ptr_mu[var.name] = []
                ptr_mu[var.name].append({
                    "id": mu.id,
                    "freq": mu.freq,
                    "depth": mu.depth,
                    "gene": var.gene,
                    "variant": var.variant,
                    "pred": var.prediction,
                    "drug": var.drug.name,
                })
                if var.name.startswith('WHO'):
                    if var.drug.name not in ptr_ev:
                        ptr_ev[var.drug.name] = []
                    ptr_ev[var.drug.name].append({'id': mu.id, 'present_solo_r': var.present_solo_r,
                                                  'present_solo_s': var.present_solo_s,
                                                  'present_r': var.present_r,
                                                  'present_s': var.present_s,
                                                  'absent_r': var.absent_r,
                                                  'absent_s': var.absent_s,
                                                  'grade': var.grade,
                                                  "pred": var.prediction,
                                                  'effect': var.effect, })
        ptr_umu = data["unverified_mutations"]
        for umu in sample.s_umutations.all():
            var = umu.variant
            if var.prediction in ['R', 'U']:
                if var.name.startswith('WHO'):
                    if var.drug.name not in ptr_umu:
                        ptr_umu[var.drug.name] = []
                    ptr_umu[var.drug.name].append({'id': umu.id,
                                                   "gene": var.gene,
                                                   "variant": var.variant,
                                                   "drug": var.drug.name,
                                                   'present_solo_r': var.present_solo_r,
                                                   'present_solo_s': var.present_solo_s,
                                                   'present_r': var.present_r,
                                                   'present_s': var.present_s,
                                                   'absent_r': var.absent_r,
                                                   'absent_s': var.absent_s,
                                                   'grade': var.grade,
                                                   "pred": var.prediction,
                                                   'effect': var.effect})
        data['predictions'] = get_ensemble_prediction(id)
        sample_data[id] = data
    return JsonResponse(sample_data)


def get_ensemble_prediction(sample_id):
    queryset = Mutation.objects.filter(
        sample_id=sample_id,
        variant__prediction__in=['R', 'U']
    ).values(
        'variant__name',
        'variant__drug__name',
        'variant__prediction'
    ).annotate(
        count=Count('id')
    )
    data = {}
    for item in queryset:
        drg = item['variant__drug__name']
        cat_name = item['variant__name']
        pred = item['variant__prediction']

        if drg not in data:
            data[drg] = {c[0]: None for c in Catalog.objects.values_list('name').distinct()}
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
