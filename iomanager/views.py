from django.shortcuts import render, redirect
from django.http import JsonResponse
import os
from .models import File
from django.contrib.auth.decorators import login_required


@login_required
def upload(request, id):
    if request.method == 'POST':
        fdir = f"media/{id}/"
        if not os.path.isdir(fdir):
            os.mkdir(fdir)

        file = request.FILES['file'].read()
        fileName = request.POST['filename']
        existingPath = request.POST['existingPath']
        end = request.POST['end']
        nextSlice = request.POST['nextSlice']


        if file == "" or fileName == "" or existingPath == "" or end == "" or nextSlice == "":
            res = JsonResponse({'data': 'Invalid Request'})
            return res
        else:
            if existingPath == 'null':
                path = fdir + fileName
                with open(path, 'wb+') as destination:
                    destination.write(file)
                FileFolder = File()
                FileFolder.existingPath = f"{id}/{fileName}"
                FileFolder.eof = end
                FileFolder.name = fileName
                FileFolder.save()
                if int(end):
                    res = JsonResponse({'data': 'Uploaded Successfully', 'existingPath': fileName})
                else:
                    res = JsonResponse({'existingPath': fileName})
                return res

            else:
                if request.POST['error'] == 'true':
                    __undo_copy(f"{id}/{fileName}")
                    return JsonResponse({'status': 'Reverting!'}, status=500)
                path = fdir + fileName
                try:
                    model_id = File.objects.get(existingPath=f"{id}/{fileName}")
                except File.MultipleObjectsReturned:
                    __undo_copy(f"{id}/{fileName}")
                    return JsonResponse({'status': 'Reverting!'}, status=500)

                if model_id.name == fileName:
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
                        res = JsonResponse({'data': 'EOF found. Invalid request'},status=400)
                        return res
                else:
                    res = JsonResponse({'data': 'No such file exists in the existingPath'},status=400)
                    return res
    return redirect('dashboard')



def __undo_copy(filename):
    File.objects.filter(existingPath=filename).delete()
    os.remove(f"media/{filename}")

