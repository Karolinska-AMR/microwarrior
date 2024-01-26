from __future__ import absolute_import, unicode_literals

import glob
import subprocess
from celery import Task
from pathlib import Path
from microwarrior.celery import app
from .models import Task as djTask
from datetime import datetime
import os, time
from glob import glob
import json
from samplesbrowser.models import Sample, Lineage, Catalog, Mutation, UnverifiedMutation
from django.db import transaction

BASE_DIR = Path(__file__).resolve().parent.parent
working_dir = os.path.join(BASE_DIR, 'media/wf')
results_dir = os.path.join(working_dir, 'out')


class Task_handler(Task):
    def on_success(self, retval, task_id, args, kwargs):
        djTask.objects.filter(task_id=task_id).update(status=0,
                                                      completion_timestamp=datetime.now(),
                                                      logs=retval)
        tsk = djTask.objects.get(task_id=task_id)
        json_file = glob(os.path.join(results_dir, f'*{tsk.ticket}*.json'))
        if len(json_file) > 0:
            save_report(json_file[0],tsk)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        djTask.objects.filter(task_id=task_id).update(status=1
                                                      ,completion_timestamp=datetime.now(),
                                                      logs=einfo)


@app.task(base=Task_handler)
def spear_mtb(ticket):
    print(BASE_DIR)
    workflow_dir = os.path.join(BASE_DIR, 'workflow')
    working_dir = os.path.join(BASE_DIR, 'media/wf')
    results_dir = os.path.join(working_dir, 'out')
    input_dir = os.path.join(BASE_DIR, 'media/uploaded/', ticket)
    trace_file = f"{ticket}.txt"

    os.makedirs(working_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    command = ["cd", working_dir,
               "; nextflow run",
               os.path.join(workflow_dir, 'main.nf'), "-profile local",
               "-w", os.path.join(working_dir, 'tmp'),
               "--input_dir", input_dir,
               "--out_dir", results_dir,
               "-with-trace", trace_file
               ]
    time.sleep(10)
    subprocess.Popen(' '.join(command), shell=True).wait()
    log_json = trace_to_json(os.path.join(working_dir, trace_file))
    return log_json


@app.task(base=Task_handler)
def fake_spear_mtb(ticket):
    f = glob(os.path.join(results_dir,'*summary.json'))
    subprocess.Popen(f"cp {f[0]} {results_dir}/{ticket}.json",
                           stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE,
                           shell=True)
    time.sleep(5)
    return {}
    # working_dir = os.path.join(BASE_DIR, 'media/wf')
    # results_dir = os.path.join(working_dir, 'out_sim')
    # input_dir = os.path.join(BASE_DIR, 'media/uploaded/', ticket)
    # tmp_dir = os.path.join(working_dir, 'tmp')
    #
    # _tmp = os.path.join(tmp_dir, ticket)
    #
    # os.makedirs(working_dir, exist_ok=True)
    # os.makedirs(results_dir, exist_ok=True)
    # os.makedirs(_tmp, exist_ok=True)
    #
    # # get samples
    # for ff in glob.glob(os.path.join(input_dir, '*_1.fastq.gz')):
    #     sample = os.path.basename(ff).split('_1')[0]
    #     subprocess.Popen(f"cd {results_dir}; cp {f'{sample}.*'} {_tmp}", shell=True).wait()
    #
    # res = subprocess.Popen(f"python {working_dir}/report.py --in_dir {_tmp} --out_dir {_tmp} --prefix {ticket}",
    #                        stdout=subprocess.PIPE,
    #                        stderr=subprocess.PIPE, shell=True)
    # stdout, stderr = res.communicate()
    # if res.returncode != 0:
    #     print("Standard Output:")
    #     print(stdout.decode())
    #     print("Standard Error:")
    #     print(stderr.decode())
    #     raise subprocess.CalledProcessError(res.returncode, "Integrating results failed")
    #
    # return {}


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


def save_report(report_json,task):
    # Load JSON data
    with open(report_json) as json_file:
        data = json.load(json_file)
    with transaction.atomic():
        # Iterate over each sample
        for seqid, sample_data in data.items():
            try:
                sid = transaction.savepoint()
                # Create Sample
                sample, created = Sample.objects.get_or_create(sample=sample_data['seqid'],
                                                               defaults={"task_id":task.id})

                # TODO: Collect sample info such as collection_date from iomanager_file
                # TODO: Calculate the category of the sample MDR, pre-MDR, etc.
                # TODO: Specify whether both pipeline have been successfully run.

                # Create Lineage
                Lineage.objects.create(
                    sample=sample,
                    lin=sample_data['lineage']['lin'],
                    family=sample_data['lineage']['family'],
                    rd=sample_data['lineage']['rd'],
                    spoligotype=sample_data['lineage']['spoligotype'],
                    is_mixed= sample_data['lineage']['is_mixed'])

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
