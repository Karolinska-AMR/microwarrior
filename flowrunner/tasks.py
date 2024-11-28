from __future__ import absolute_import, unicode_literals

import glob
import json
import os
import subprocess
from datetime import datetime
from glob import glob

from celery import Task
from django.conf import settings
from django.db import transaction
import uuid
from django.utils.timezone import now

from microwarrior.celery import app
from samplesbrowser.models import Sample, Lineage, Evidence, Mutation, UnverifiedMutation, Drug
from .models import Task as djTask


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
    # time.sleep(5)
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


def save_report(report_json, user_id=1, task=None):
    # Load JSON data
    with open(report_json) as json_file:
        data = json.load(json_file)

    catalogs = data['catalogs_repo']

    with transaction.atomic():

        if task is None:
            # Generate a new task_id and create a new Task object
            task_id = str(uuid.uuid4())
            task = Task.objects.create(
                task_id=task_id,
                ticket=task_id,
                name="JSON-IMPORT",
                samples_count=len(data.get('samples', [])),
                status=0,
                user_id=user_id,
                logs="",
                submission_timestamp=now(),
                completion_timestamp=now()
            )
        # Iterate over each sample
        for sample_data in data['samples']:
            try:
                sid = transaction.savepoint()
                cat_chck = {k: v in sample_data['catalogs'] for k, v in catalogs.item()}

                # Create Sample
                # Create or retrieve Sample object
                sample, created = Sample.objects.get_or_create(
                    sample=sample_data['seqid'],
                    defaults={
                        "task_id": task.id,
                        "category": sample_data["category"],
                        "passed_tbprofiler": cat_chck.get("tbdb", None),
                        "passed_cryptic": cat_chck.get("cryptic", None),
                        "passed_who": cat_chck.get("who", None),
                        "genome_depth": sample_data["genome_median_depth"],
                        "mapped_reads": sample_data["num_mapped_reads"],
                        "mapped_reads_pct": sample_data["percent_reads_mapped"]
                    }
                )
                # Create Lineage
                lineage_data = sample_data.get('lineage', {})
                Lineage.objects.create(
                    sample=sample,
                    lin=lineage_data.get('lineage', None),
                    family=lineage_data.get('family', None),
                    rd=lineage_data.get('rd', None),
                    spoligotype=lineage_data.get('spoligotype', None),
                    is_mixed=lineage_data.get('is_mixed', None)
                )

                # Create Mutations
                for var in sample_data['variants']:
                    drug = Drug.objects.filter(name=var['drug']).first()
                    if drug is None:
                        print('####COULD NOT FOUND THIS DRUG: ' + var['drug'])
                    cat = var.get('catalog')
                    Mutation.objects.create(
                        sample=sample,
                        catalog=cat,
                        gene=var.get('gene_name'),
                        position=var.get("pos"),
                        change=var.get("change"),
                        nucleotide_change=var.get("nucleotide_change"),
                        protein_change=var.get("protein_change"),
                        effect=var.get("effect"),
                        variant=var.get('variant'),
                        prediction=var.get('prediction'),
                        drug=drug,
                        freq=var.get('freq'),
                        depth=var.get('depth'),
                        comment=var.get('comment_1') if cat.startswith('TB-Profier') else None,
                        source=var.get("footnote") if cat.startswith('TB-Profier') else None)

                # Create Unverified Mutations
                for unverified_key, unverified_value in sample_data.get('unverified_mutations', {}).items():
                    # Look up the Catalogue entry
                    cat = unverified_value.get['catalog']
                    # just interested in unverified mutations from WHO catalogue
                    if cat != catalogs['who']:
                        continue

                    catalog_entries = Evidence.objects.filter(
                        name=cat,
                        gene=unverified_value.get('gene'),
                        variant=unverified_value.get('variant'))

                    # Create UnverifiedMutation
                    for entry in catalog_entries:
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
