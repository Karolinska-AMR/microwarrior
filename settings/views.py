import os

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.files.storage import FileSystemStorage
from django.http import JsonResponse
from django.shortcuts import render, redirect

from flowrunner.tasks import save_report


@login_required
def get_page(request):
    if request.user.is_staff:
        return render(request, 'settings.html', {"name": request.user.first_name, 'is_staff': request.user.is_staff})
    return redirect('home')


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
