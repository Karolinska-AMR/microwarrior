
import argparse, os
import sqlite3 as lit


def remove_ticket(db,ticket):
    print(f'DELETING a TICKET: {ticket}')
    conn = lit.connect(db)
    cur = conn.cursor()
    try:

        samples = []
        for s in cur.execute(f"SELECT DISTINCT sample FROM iomanager_file WHERE ticket = '{ticket}'"):
            samples.append(s[0])

        print(f'\t-These samples will be removed: {" ".join(samples)}')
        

        cur.execute(f"DELETE FROM iomanager_file WHERE ticket = '{ticket}';")
        print('\t-iomanger_file cleaned!')
        cur.execute(f"DELETE FROM flowrunner_task WHERE ticket = '{ticket}';")
        print('\t-flowrunner_task cleaned!')
        commands = []
        if(len(samples)>0):
            quoted_sample_names = "', '".join(samples)
            print(quoted_sample_names)
            sample_ids = [rr[0] for rr in cur.execute("SELECT id FROM samplesbrowser_sample WHERE sample IN ('{quoted_sample_names}');")]
            in_cond = f"IN ({','.join(sample_ids)})"
            commands.append( f"DELETE FROM samplesbrowser_unverifiedmutation WHERE sample_id {in_cond}")
            commands.append(f"DELETE FROM samplesbrowser_mutation WHERE sample_id {in_cond}")
            commands.append(f"DELETE FROM samplesbrowser_lineage WHERE sample_id {in_cond}")
            commands.append(f"DELETE FROM samplesbrowser_sample WHERE id {in_cond}")
            for cmd in commands:
                print(cmd)
                cur.execute(cmd)
        else:
             print('\t-Nothing further was saved.')

        conn.commit()
        print('Changes were applied!')

    except Exception as e:
        print(e)
        conn.rollback()
        print('Rolled Back!')


def remove_samples(db,samples):
    print(f'DELETING a SAMPLES: {samples}')
    conn = lit.connect(db)
    cur = conn.cursor()
    commands = []
    try:
        quoted_sample_names = "', '".join(samples.split(','))
  
        sample_ids = map(str,[rr[0] for rr in cur.execute(f"SELECT id FROM samplesbrowser_sample WHERE sample IN ('{quoted_sample_names}');")])
        in_cond = f"IN ({','.join(sample_ids)})"
        commands.append( f"DELETE FROM samplesbrowser_unverifiedmutation WHERE sample_id ")
        commands.append(f"DELETE FROM samplesbrowser_mutation WHERE sample_id {in_cond}")
        commands.append(f"DELETE FROM samplesbrowser_lineage WHERE sample_id {in_cond}")
        commands.append(f"DELETE FROM samplesbrowser_sample WHERE id {in_cond}")
        for cmd in commands:
            print(cmd)
            cur.execute(cmd)
        conn.commit()
        print('Changes were applied!')
    except Exception as e:
        print(e)
        conn.rollback()
        print('Rolled Back!')


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True,
                        help="Iput directory containing results of ")

    parser.add_argument("--ticket", required=False,help="Ticket number")
    parser.add_argument("--samples", required=False,help="Ticket number")
    
    opt = parser.parse_args()
    if opt.samples:
        remove_samples(opt.db,opt.samples)
    elif opt.ticket:
        remove_ticket(opt.db, opt.ticket)
    else:
       raise Exception("Require either samples in comma separated or ticket")