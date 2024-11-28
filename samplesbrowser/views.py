from itertools import chain

from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.db.models import Q
from django.db.models.functions import ExtractWeek, ExtractYear
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.shortcuts import render
from django.utils.translation import gettext as _

from catalogmanager.models import Note
from .models import Sample, Evidence, Drug, Meta


@login_required
def samplesbrowser(request):
    return render(request, 'sambrow.html', {"name": request.user.first_name, 'is_staff': request.user.is_staff})


# TODO: use django-ratelimit to control the rate of request
@login_required
def fetch_samples(request):
    ticket = request.GET.get('tkt', None)
    ids = request.GET.get('ids', None)
    sample_id = request.GET.get('sid', None)
    week_number = request.GET.get('wn', None)
    date_from = request.GET.get('dtf', None)
    date_to = request.GET.get('dtt', None)
    lineage = request.GET.get('lin', None)
    mutation = request.GET.get('rmu', None)
    drug = request.GET.get('drg', None)
    resistance_category = request.GET.get('rca', None)

    queryset = Sample.objects.annotate(
        task__submission_timestamp__week=ExtractWeek('task__submission_timestamp'),
        task__submission_timestamp__year=ExtractYear('task__submission_timestamp')
    )

    query = Q()
    if ticket:
        query &= Q(task__ticket=ticket)

    if ids:
        id_lst = list(map(int, ids.split(',')))
        query &= Q(id__in=id_lst)

    if sample_id:
        query &= Q(sample__icontains=sample_id)

    if week_number:
        y4, w = week_number.split('-')
        w = int(w.strip('W'))
        y4 = int(y4)
        query &= Q(task__submission_timestamp__week=w, task__submission_timestamp__year=y4)

    if date_from:
        query &= Q(task__submission_timestamp__gte=date_from)

    if date_to:
        query &= Q(task__submission_timestamp__lte=date_to)

    if lineage:
        query &= Q(lineage__lin__icontains=lineage)

    if mutation:
        gene, variant = mutation.split('@')
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
                                   "ticket": sample.task.ticket if sample.task is not None else None,
                                   "collection_date": sample.collection_date,
                                   'submission_timestamp': sample.task.submission_timestamp.strftime(
                                       '%Y-%m-%d %H:%M') if sample.task is not None else None,
                                   "category": sample.category,
                                   "lineage": lineage_data,
                                   "pass_tbprofiler": sample.passed_tbprofiler,
                                   "pass_cryptic": sample.passed_cryptic,
                                   "pass_who": sample.passed_who,
                                   "mapped_reads_pct": sample.mapped_reads_pct,
                                   "mapped_reads": sample.mapped_reads,
                                   "genome_depth": sample.genome_depth
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

        data = {"mutations": {},
                "unverified_mutations": [], 'predictions': {}, "messages": {}, 'catalogues': set()}

        ptr_mu = data["mutations"]
        ptr_prd = data["predictions"]
        ptr_msgs = data["messages"]
        info_RU = {}
        for mu in sample.s_mutations.all():
            cat = mu.catalog
            data['catalogues'].add(cat)

            drug = mu.drug.name

            if mu.prediction in ['R', 'U']:

                if drug not in ptr_mu:
                    ptr_mu[drug] = {}

                if drug not in ptr_msgs:
                    ptr_msgs[drug] = []
                    info_RU[drug] = {"r": False, "u": False}

                if cat not in ptr_mu[drug]:
                    ptr_mu[drug][cat] = []

                if mu.prediction == 'R' and not info_RU[drug]['r']:
                    info_RU[drug]['r'] = True
                    ptr_msgs[drug].append({"text": _("Minst en resistensmutation hittades."), "type": 'info'})
                if mu.prediction == 'U' and not info_RU[drug]['u']:
                    info_RU[drug]['u'] = True
                    ptr_msgs[drug].append(
                        {"text": _(
                            "Mutationer med osäker signifikans hittades. Se tabellen nedan för mer information."),
                         "type": 'warning'})

                tmp_mu = {
                    "id": mu.id,
                    "freq": mu.freq,
                    "depth": mu.depth,
                    "mutation": f"{mu.gene}@{mu.variant}",
                    "drug": drug,
                    "cat_pred": mu.prediction,
                    "note_pred": None,
                    "notes": [],
                    "comments": [],
                    'format': ['HGSV', 'GARC1'][cat.startswith('CRyPTIC')]
                }
                if cat.startswith('WHO'):
                    # just for the WHO catalogue
                    if drug not in ptr_prd:
                        ptr_prd[drug] = {}

                    evi = Evidence.objects.filter(name=cat, gene=mu.gene, variant=mu.variant,
                                                  drug_id=mu.drug.id).prefetch_related(
                        Prefetch('ev_notes', queryset=Note.objects.filter(is_del=False))
                    ).first()

                    if evi is not None:
                        ptr_prd[drug][evi.id] = {'catalog': None, "notes": []}
                        tptr = ptr_prd[drug][evi.id]
                        tptr['catalog'] = evi.prediction
                        # Fetch notes
                        notes = []
                        for note in evi.ev_notes.all():
                            notes.append({"id": note.id,
                                          "note": note.note,
                                          "prediction": note.prediction,
                                          "last_edit": note.last_edit,
                                          "author": f"{note.author.first_name} {note.author.last_name}"})
                            tptr['notes'].append(note.prediction)

                        tmp_mu = {**tmp_mu, **{'evi_id': evi.id,
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
                                               'effect': evi.effect,
                                               'notes': notes, }}
                    else:
                        mutation = f'{mu.gene}@{mu.variant}'
                        ptr_prd[drug][mutation] = {'catalog': mu.prediction,
                                                   "notes": []}
                        ptr_msgs[drug].append(
                            {"text": f"{mutation}: {_('kunde inte länka mutationen tillbaka till WHO-katalogen')}",
                             "type": "warning"})
                        print(mu.variant)

                ptr_mu[drug][cat].append(tmp_mu)

        for drug, prediction in data['predictions'].items():
            data['predictions'][drug] = merge_predictions(prediction, ptr_msgs[drug])

        ptr_umu = data["unverified_mutations"]

        for umu in sample.s_umutations.all():
            evi = umu.variant
            drug = evi.drug.name
            if evi.prediction in ['R', 'U']:
                # R mutation cannot be assessed
                if evi.prediction == 'R':
                    if drug in data['predictions']:
                        data['predictions'][drug]["prediction"] = "F"
                    else:
                        data['predictions'][drug]["prediction"] = "F"

                    if drug in data['messages']:
                        data['messages'][drug].append({
                                                  "text": f"{evi.gene}@{evi.variant}: {_('närvaron av resistensmutationen kan inte utvärderas.')}",
                                                     "type": "danger"})
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

        data['catalogues'] = list(data['catalogues'])
        sample_data[id] = data

    return JsonResponse(sample_data)


def get_meta():
    catalogs = list(chain.from_iterable(Meta.objects.filter(type__exact='catalog').values_list('name')))
    drugs = list(chain.from_iterable(Drug.objects.values_list('name').order_by('man_order').distinct()))
    return {'catalogs': catalogs, 'drugs': drugs}


def merge_predictions(predictions, messages):
    has_R = False
    has_U = False
    for content in predictions.values():
        catalog_pred = content["catalog"]
        notes = content["notes"]
        # At least one R mutation with no or aligning notes
        if catalog_pred == "R":
            has_R = True
            if len(notes) == 0 or all(note not in ["U", "S"] for note in notes):
                return {"prediction": "R", "source": "catalogue"}

    # there is a contradictory R prediction
    if has_R:
        messages.append({"text": _("Ofullständiga resultat på grund av inkonsekvenser i WHO katalog och noteringar."),
                         "type": 'danger'})
        return {"prediction": "F", "source": "note"}

    for content in predictions.values():
        catalog_pred = content["catalog"]
        notes = content["notes"]
        # no R and at least one U with notes indicating R
        if catalog_pred == "U":
            has_U = True
            if len(notes) > 0 and all(note not in ["U", "S"] for note in notes):
                messages.append({"text": _(
                    "En mutation med osäker signifikans från WHO-katalogen har markerats som en resistensmutation i noteringar."),
                    "type": 'info'})
                return {"prediction": "R", "source": "notes"}

    pred = 'K'
    if has_R:
        pred = 'R'
    elif has_U:
        pred = 'U'

    return {"prediction": pred, "source": "catalogue"}
