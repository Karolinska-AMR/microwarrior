import argparse
import os
import sqlite3 as lit
import json
from glob import glob

def add_missing_cryptic(db, report_json):

    conn = lit.connect(db)
    cur = conn.cursor()

    with open(report_json) as hdl:
        results = json.load(hdl)

    cryptic_mu = {}
    for s, cnt in results.items():
        rec = cur.execute(
            "SELECT id FROM samplesbrowser_sample WHERE sample = ?", (s,)).fetchone()
        if rec is None:
            print(f'Could not find {s}')
            continue

        sample_id = rec[0]
        for v in cnt['variants']:
            if v['catalog'].lower().startswith('cryptic'):
                if sample_id not in cryptic_mu:
                    cryptic_mu[sample_id] = []
                cryptic_mu[sample_id].append(v)

    for sid, muations in cryptic_mu.items():

        for mu in  muations:
            var =  mu['variant']
            rec = cur.execute(
                "SELECT id FROM samplesbrowser_catalog WHERE name =? AND variant = ?", ('CRyPTIC', var)).fetchone()
            
            if rec is not None:
                var_id = rec[0]
                rec = cur.execute(
                    "SELECT id FROM samplesbrowser_mutation WHERE variant_id =? AND sample_id = ?", (var_id, sid)).fetchone()
                if rec is None:
                    print(f'Updating {sid},{var_id}')
                    cur.execute(
                        "insert into samplesbrowser_mutation (sample_id,variant_id) values (?,?);", (sid, var_id))
            else:
                print(f"Could not find {mu}")

    conn.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True,
                        help="reference reshub db")
    parser.add_argument("--report_dir", required=False,
                        help="spear-mtb json report dir")

    opt = parser.parse_args()

    for report in glob(os.path.join(opt.report_dir,'*.json')):
        add_missing_cryptic(opt.db,report)