from __future__ import absolute_import, unicode_literals

from subprocess import Popen

from celery import shared_task
from pathlib import Path
import os, json

BASE_DIR = Path(__file__).resolve().parent.parent


@shared_task(name="spear_mtb")
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
    Popen(' '.join(command), shell=True).wait()
    log_json = trace_to_json(os.path.join(working_dir, trace_file))
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
