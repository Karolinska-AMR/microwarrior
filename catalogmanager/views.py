from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone

from samplesbrowser.models import Evidence
from .models import Note


@login_required
def catalogs(request):
    fname = request.user.first_name
    return render(request, 'catalogs.html', {"name": fname})


@login_required()
def fetch_drugs_grades(request):
    grades = Evidence.objects.values('grade').distinct().order_by('grade')
    drug_names = Evidence.objects.values('drug__name').distinct().order_by('drug__man_order')
    grades_list = [d['grade'] for d in grades]
    drug_names_list = [d['drug__name'] for d in drug_names]
    return JsonResponse({"grades": grades_list, "drug_names": drug_names_list})


@login_required
def fetch_evidence(request):
    gene_name = request.GET.get('gn', None)
    grade = request.GET.get('gr', None)
    variant = request.GET.get('vr', None)
    drug = request.GET.get('dr', None)

    query = Q()
    if gene_name:
        query &= Q(gene__icontains=gene_name)
    if variant:
        query &= Q(variant__icontains=variant)
    if drug:
        query &= Q(drug__name__icontains=drug)

    if grade:
        query &= Q(grade__icontains=grade)

    results = Evidence.objects.filter(query).distinct()
    data = {}
    for evi in results:
        data[evi.id] = {"id": evi.id, "gene": evi.gene, "variant": evi.variant, "drug": evi.drug.name,
                        "grade": evi.grade,
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
                        'effect': evi.effect,
                        "notes": []}
        ptr = data[evi.id]["notes"]
        notes = evi.ev_notes.filter(is_del=False).order_by('-last_edit')
        for note in notes:
            ptr.append({"id": note.id, "note": note.note, "prediction": note.prediction,
                        "last_edit": note.last_edit,
                        "author": f"{note.author.first_name} {note.author.last_name}"})

    return JsonResponse(data)


def add_note(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request method. Only POST requests are allowed.'})

    note_content = request.POST.get('note')
    prediction = request.POST.get('prediction')
    mutation_id = request.POST.get('mutation_id')

    if not prediction or not mutation_id:
        return JsonResponse({'success': False, 'message': 'Prediction, mutation, and author are required fields.'})

    if len(prediction) > 10:
        return JsonResponse({'success': False, 'message': 'Prediction is too long. Maximum length is 10 characters.'})

    # Fetch related models
    try:
        mutation = Evidence.objects.get(id=mutation_id)
        author = request.user
    except Evidence.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Mutation not found.'})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Author not found.'})

    # Try to save the note
    try:
        note = Note.objects.create(
            mutation=mutation,
            last_edit=timezone.now(),
            note=note_content,
            prediction=prediction,
            author=author,
            is_del=False,
            action="created"
        )
        note.save()

        snote = Note.objects.get(id=note.id)

        return JsonResponse(
            {'success': True, 'message': 'Note saved successfully.',
             "note": {"id": snote.id, "mutation_id": snote.mutation_id, "note": snote.note,
                      "prediction": snote.prediction,
                      "last_edit": snote.last_edit,
                      "author": f"{snote.author.first_name} {snote.author.last_name}"}})
    except Exception as e:
        # Handle any errors that occur during saving
        return JsonResponse({'success': False, 'message': f'An error occurred while saving the note: {str(e)}'})


def del_note(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request method. Only POST requests are allowed.'})

    note_id = request.POST.get("note_id")
    if not note_id:
        return JsonResponse({"success": False, "message": "Note ID is required"}, status=400)
    try:
        note = Note.objects.get(id=note_id)
        note.is_del = True
        note.last_edit = timezone.now()
        note.author = request.user
        note.action = 'deleted'
        note.save()

        return JsonResponse({"success": True, "message": "Note marked as deleted.",
                             "note": {"note_id": note.id, "mutation_id": note.mutation_id}})

    except Exception as e:
        # Handle any errors that occur during saving
        return JsonResponse({'success': False, 'message': f'An error occurred while saving the note: {str(e)}'})


def edit_note(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request method. Only POST requests are allowed.'})

    note_id = request.POST.get("note_id")
    prediction = request.POST.get("prediction")
    note_content = request.POST.get("note")

    if not note_id:
        return JsonResponse({"success": False, "message": "Note ID is required"}, status=400)
    try:
        # archive the note
        enote = Note.objects.get(id=note_id)
        enote.last_edit = timezone.now()
        enote.is_del = True
        enote.action = 'edit_to'
        enote.save()

        mutation = Evidence.objects.get(id=enote.mutation_id)
        author = request.user

        # create a new one
        note = Note.objects.create(
            mutation=mutation,
            last_edit=timezone.now(),
            note=note_content,
            prediction=prediction,
            author=author,
            action='edit',
            is_del=False
        )
        note.save()
        return JsonResponse({"success": True, "message": "Note marked as deleted.",
                             "note": {"id": note.id, "oid": enote.id, "mutation_id": note.mutation_id,
                                      "note": note.note,
                                      "prediction": note.prediction,
                                      "last_edit": note.last_edit,
                                      "author": f"{note.author.first_name} {note.author.last_name}"}})

    except Exception as e:
        # Handle any errors that occur during saving
        return JsonResponse({'success': False, 'message': f'An error occurred while saving the note: {str(e)}'})
