import argparse
import os
import sqlite3 as lit
import pandas as pd

def update_catalog(db,catalog_csv):

    def sanitate_val(val):
        if str(val).lower().find('inf')>-1:
            return -999.0
        if pd.isna(val):
            return None
        
        return float(str(val).strip('%'))

    conn = lit.connect(db)
    cur = conn.cursor()

    df = pd.read_csv(catalog_csv,header=0,low_memory=False)
    drug_mapper = {rr[1]:rr[0] for rr in cur.execute("SELECT ID,name from samplesbrowser_drug")}
        
    Remove_PERC = lambda x: str(x).strip('%')

    for i,row in df.iterrows():
        gene = row['gene']
        mutation = row['mutation']
        drug = row['drug'].upper()
        if drug not in drug_mapper:
            print(f'COULD NOT FIND: {drug}')
            continue

        rec = cur.execute("SELECT id FROM samplesbrowser_catalog WHERE name = 'WHO-UCN-2023.5' and drug_id=? and gene=? and variant=?",
                             (drug_mapper[drug],gene,mutation)).fetchone()
        
        if rec is not None:
            cat_id = rec[0]
            values = list(map(sanitate_val,[row['PPV'],row['OR'],row['Sens'],row['Spec']]))
            cur.execute('Update samplesbrowser_catalog set ppv=?,odd_ratio=?,sensitivity=?,specificity=? where id=?',values+[cat_id])
            
   
    conn.commit()

if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    
    parser.add_argument("--db", required=True, help="Reference Reshub DB")
    parser.add_argument("--catalog", required=True, help="Catalogue csv")

    opt = parser.parse_args()

    update_catalog(opt.db,opt.catalog)