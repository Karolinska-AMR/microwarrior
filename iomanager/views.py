from django.shortcuts import render, redirect
from django.http import JsonResponse
import os
import re
from .models import File
from django.contrib.auth.decorators import login_required
from django.conf import settings
from flowrunner.tasks import is_valid_ticket

SAMPLE_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')


@login_required
def upload(request, ticket):
    if request.method == 'POST':
        if not is_valid_ticket(ticket):
            return JsonResponse({'data': 'Invalid ticket'}, status=400)
        fdir = os.path.join(settings.MEDIA_ROOT, ticket)
        if not os.path.isdir(fdir):
            os.makedirs(fdir, exist_ok=True)

        file = request.FILES['file'].read()
        sample = request.POST['sample']
        collection_date = request.POST['cdate']
        existingPath = request.POST['existingPath']
        end = request.POST['end']
        read = request.POST['read']
        nextSlice = request.POST['nextSlice']

        if file == "" or sample == "" or existingPath == "" or end == "" or nextSlice == "":
            res = JsonResponse({'data': 'Invalid Request'})
            return res
        else:
            if not SAMPLE_RE.match(sample) or read not in ('1', '2'):
                return JsonResponse({'data': 'Invalid sample name'}, status=400)
            fileName = f"{sample}_{read}.fastq.gz"
            # the client may only continue the file it started, never point elsewhere
            if existingPath not in ('null', f"{ticket}/{fileName}"):
                return JsonResponse({'data': 'Invalid path'}, status=400)

            if existingPath == 'null':

                path = os.path.join(fdir, fileName)
                existingPath = f"{ticket}/{fileName}"

                with open(path, 'wb+') as destination:
                    destination.write(file)
                new_file = File()
                new_file.existingPath = existingPath
                new_file.eof = end
                new_file.sample = sample
                new_file.collection_date = collection_date
                new_file.ticket = ticket
                new_file.save()

                if int(end):
                    res = JsonResponse({'data': 'Uploaded Successfully', 'existingPath': existingPath})
                else:
                    res = JsonResponse({'existingPath': existingPath})
                return res

            else:
                path = os.path.join(fdir, fileName)
                try:
                    model_id = File.objects.get(existingPath=existingPath)
                except File.MultipleObjectsReturned:
                    __undo_copy(existingPath)
                    return JsonResponse({'status': 'Reverting!'}, status=500)

                if model_id.existingPath == existingPath:
                    if not model_id.eof:
                        with open(path, 'ab+') as destination:
                            destination.write(file)

                        if int(end):
                            model_id.eof = int(end)
                            model_id.save()
                            res = JsonResponse({'data': 'Uploaded Successfully', 'existingPath': model_id.existingPath})
                        else:
                            res = JsonResponse({'existingPath': model_id.existingPath})
                        return res
                    else:
                        res = JsonResponse({'data': 'EOF found. Invalid request'}, status=400)
                        return res
                else:
                    res = JsonResponse({'data': 'No such file exists in the existingPath'}, status=400)
                    return res
    return redirect('dashboard')


def __undo_copy(filename):
    File.objects.filter(existingPath=filename).delete()
    os.remove(os.path.join(settings.MEDIA_ROOT, filename))
