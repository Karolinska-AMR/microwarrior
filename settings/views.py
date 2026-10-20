import json
import os

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.http import JsonResponse
from django.shortcuts import render, redirect

from flowrunner.tasks import save_report
from samplesbrowser.models import Sample
from users.decorators import staff_required


@login_required
def get_page(request):
    if request.user.is_staff:
        return render(request, 'settings.html', {"name": request.user.first_name, 'is_staff': request.user.is_staff})
    return redirect('home')


@staff_required
def upload_json(request):
    if request.method == "POST" and request.FILES.get("json_file"):
        json_file = request.FILES["json_file"]
        fdir = os.path.join(settings.MEDIA_ROOT, 'json_uploads')

        # Save the file temporarily
        fs = FileSystemStorage(location=fdir)
        filename = fs.save(json_file.name, json_file)

        task = save_report(os.path.join(fdir, filename), request.user.id)

        return JsonResponse({"message": task.logs})
    return JsonResponse({"error": "Invalid request."}, status=400)


@staff_required
def fetch_del_samples(request):
    samples_str = request.GET.get('ids', '')
    samples = samples_str.split(',')
    samples_info = {"data": []}
    ptr = samples_info["data"]
    if len(samples) > 0:
        for sample_id in samples:
            sample = Sample.objects.filter(sample=sample_id).first()
            if sample:
                info = {"id": sample.id, "sample": sample.sample,
                        "ticket": sample.task.ticket if sample.task is not None else None,
                        'submission_timestamp': sample.task.submission_timestamp.strftime(
                            '%Y-%m-%d %H:%M') if sample.task is not None else None,
                        "category": sample.category,
                        "lineage": sample.lineage.lin if sample.task is not None else None,
                        "pass_tbprofiler": sample.passed_tbprofiler,
                        "pass_cryptic": sample.passed_cryptic,
                        "pass_who": sample.passed_who,
                        "mapped_reads_pct": sample.mapped_reads_pct,
                        "mapped_reads": sample.mapped_reads,
                        "genome_depth": sample.genome_depth,
                        "mutation_count": sample.s_mutations.count(),
                        "umutation_count": sample.s_umutations.count()}

                ptr.append(info)

    return JsonResponse(samples_info)


@staff_required
def delete_samples(request):
    if request.method == 'POST':
        try:
            # Parse JSON data from the request body
            data = json.loads(request.body)
            sample_ids = data.get('samples', [])

            # Validate data
            if not sample_ids or not isinstance(sample_ids, list):
                return JsonResponse({'error': 'Invalid data format'}, status=400)
            success_del = 0
            for sample_id in sample_ids:
                sample = Sample.objects.filter(sample=sample_id).first()

                # related data in different model will be remove due to having on_delete=models.CASCADE
                if sample:
                    sample.delete()
                    success_del += 1
            return JsonResponse(
                {'message': f'Samples received successfully: {success_del} of {len(sample_ids)} were deleted.'})
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON data'}, status=400)
    return JsonResponse({'message': 'Invalid request method'}, status=405)


@staff_required
def fetch_users(request):
    non_superuser_users = User.objects.exclude(is_superuser=True)
    # Serialize the users to JSON
    user_data = [
        {'id': user.id, 'username': user.username, 'email': user.email,
         'first_name': user.first_name, 'last_name': user.last_name,
         "last_login": user.last_login, "is_active": user.is_active, "is_staff": user.is_staff}
        for user in non_superuser_users
    ]
    return JsonResponse(user_data, safe=False)
