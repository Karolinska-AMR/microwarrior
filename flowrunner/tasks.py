from __future__ import absolute_import, unicode_literals

import glob
import subprocess
from celery import Task
from microwarrior.celery import app
from .models import Task as djTask
from datetime import datetime
import os, time
from glob import glob
import json
from samplesbrowser.models import Sample, Lineage, Catalog, Mutation, UnverifiedMutation
from django.db import transaction
from django.conf import settings
from iomanager.models import File


class Task_handler(Task):

    def on_success(self, retval, task_id, args, kwargs):
        djTask.objects.filter(task_id=task_id) \
            .update(completion_timestamp=datetime.now(), logs=retval)

        tsk = djTask.objects.get(task_id=task_id)
        json_file = glob(os.path.join(settings.ARCHIVE_ROOT, f'reports/{tsk.ticket}.json'))
        status = 1
        if len(json_file) > 0:
            save_report(json_file[0], tsk)
            status = 0
        djTask.objects.filter(task_id=task_id).update(status=status)

        clean_storage(tsk.ticket, True)
        app.control.revoke(task_id, terminate=True)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        djTask.objects.filter(task_id=task_id).update(status=1
                                                      , completion_timestamp=datetime.now(),
                                                      logs=einfo)
        tsk = djTask.objects.get(task_id=task_id)
        clean_storage(tsk.ticket, False)
        app.control.revoke(task_id, terminate=True)


@app.task(base=Task_handler)
def spear_mtb(ticket):
    runner = [os.path.join(settings.WORKFLOW_ROOT, 'spear-mtb.sh'),
              "-w", settings.WORKING_ROOT,
              "-c", os.path.join(settings.WORKFLOW_ROOT, 'main.config'),
              "-a", settings.ASSETS_ROOT,
              "-t", ticket,
              "-f", 'local',
              "-o", settings.ARCHIVE_ROOT,
              "-v", settings.RAWSEQ_ROOT,
              os.path.join(settings.MEDIA_ROOT, ticket)]
    print(' '.join(runner))
    # time.sleep(1200)
    subprocess.call(' '.join(runner), stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    log_json = trace_to_json(os.path.join(settings.ARCHIVE_ROOT, f'traces/{ticket}.trace'))
    # log_json = {}
    return log_json


def trace_to_json(trace_txt):
    data = []
    with open(trace_txt, 'r') as hdl:
        headers = hdl.readline().strip().split('\t')
        for line in hdl:
            values = line.strip().split('\t')
            row_dict = {}
            for i in range(len(headers)):
                row_dict[headers[i]] = values[i]
            data.append(row_dict)
    return data


def update_status():
    def run_celery_inspect(command):
        # Execute the Celery inspect command
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
        output_b, error = process.communicate()

        if process.returncode != 0:
            print(f"Error: {error.decode('utf-8')}")
            return ""
        return output_b.decode('utf-8')

    def extract_tickets_id(output):
        out_list = []
        for out in output.split('*'):
            start_idx = out.find('{')
            end_idx = out.rfind('}')

            if end_idx > start_idx > -1:
                json_str = out[start_idx:end_idx + 1]
                json_str = json_str.replace("'", '"') \
                    .replace('True', 'true') \
                    .replace('False', 'false').replace('None', '""')
                try:
                    dic = json.loads(json_str)
                    if 'id' in dic:
                        out_list.append(dic['id'])
                except json.JSONDecodeError as e:
                    print(json_str)
                    print(f"JSON decode error: {e}")
        return out_list

    # TODO: Fix these paths
    commands = [
        "/home/h5admin/miniconda3/envs/microwarrior/bin/celery -A microwarrior inspect active",
        "/home/h5admin/miniconda3/envs/microwarrior/bin/celery -A microwarrior inspect reserved",
        "/home/h5admin/miniconda3/envs/microwarrior/bin/celery -A microwarrior inspect scheduled"
    ]

    results = {}
    for command in commands:
        key = command.split()[-1]
        results[key] = []
        output = run_celery_inspect(command)
        if output:
            results[key] = extract_tickets_id(output)
    return results


def save_report(report_json, task):
    # Load JSON data
    with open(report_json) as json_file:
        data = json.load(json_file)
    with transaction.atomic():
        # Iterate over each sample
        for seqid, sample_data in data.items():
            try:
                sid = transaction.savepoint()

                pe_file = File.objects.filter(ticket=task.ticket, sample=sample_data['seqid']).first()
                collection_date = None
                if pe_file.collection_date:
                    try:
                        collection_date = datetime.strptime(pe_file.collection_date, '%Y-%m-%d').date()
                    except ValueError:
                        pass

                # Create Sample
                sample, created = Sample.objects.get_or_create(
                    sample=sample_data['seqid'],
                    defaults={"task_id": task.id,
                              "collection_date": collection_date,
                              "category": sample_data["category"],
                              "passed_tbprofiler": sample_data["tbprofiler"],
                              "passed_cryptic": sample_data["cryptic"],
                              "genome_depth": sample_data["genome_median_depth"],
                              "mapped_reads": sample_data["num_mapped_reads"],
                              "mapped_reads_pct": sample_data["pct_mapped_reads"]
                              })
                # Create Lineage
                Lineage.objects.create(
                    sample=sample,
                    lin=sample_data['lineage']['lin'],
                    family=sample_data['lineage']['family'],
                    rd=sample_data['lineage']['rd'],
                    spoligotype=sample_data['lineage']['spoligotype'],
                    is_mixed=sample_data['lineage']['is_mixed'])

                # Create Mutations
                for variant in sample_data['variants']:
                    # Look up the Catalogue entry
                    catalog_entries = Catalog.objects.filter(
                        name=variant['catalog'],
                        gene=variant['gene'],
                        variant=variant['variant'])

                    for entry in catalog_entries:
                        # assign Mutation
                        Mutation.objects.create(
                            sample=sample,
                            variant=entry,
                            freq=variant.get('freq'),
                            depth=variant.get('depth'))

                # Create Unverified Mutations
                for unverified_key, unverified_value in sample_data.get('unverified_mutations', {}).items():
                    # Look up the Catalogue entry
                    catalog_entries = Catalog.objects.filter(
                        name=unverified_value['catalog'],
                        gene=unverified_value['gene'],
                        variant=unverified_value['variant'])
                    for entry in catalog_entries:
                        # Create UnverifiedMutation
                        UnverifiedMutation.objects.create(
                            sample=sample,
                            variant=entry)

            except Exception as e:
                print(f"Error occurred: {e}, rolling back this sample creation.")
                transaction.savepoint_rollback(sid)
            else:
                transaction.savepoint_commit(sid)


def clean_storage(ticket, was_success):
    subprocess.call(f'rm -rf {os.path.join(settings.WORKING_ROOT, ticket)}', stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, shell=True)
    # keep the sequences if it was failed run
    if was_success:
        subprocess.call(f'rm -rf {os.path.join(settings.MEDIA_ROOT, ticket)}', stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE, shell=True)
