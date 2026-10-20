
import argparse
import sqlite3 as lit


def _placeholders(values):
    return ','.join('?' * len(values))


def _delete_sample_rows(cur, sample_names):
    if not sample_names:
        return
    sample_ids = [rr[0] for rr in cur.execute(
        f"SELECT id FROM samplesbrowser_sample WHERE sample IN ({_placeholders(sample_names)})", sample_names)]
    if not sample_ids:
        print('\t-No analysed samples found.')
        return
    in_cond = f"IN ({_placeholders(sample_ids)})"
    for table, column in [("samplesbrowser_unverifiedmutation", "sample_id"),
                          ("samplesbrowser_mutation", "sample_id"),
                          ("samplesbrowser_lineage", "sample_id"),
                          ("samplesbrowser_sample", "id")]:
        cur.execute(f"DELETE FROM {table} WHERE {column} {in_cond}", sample_ids)
        print(f'\t-{table}: {cur.rowcount} rows removed')


def remove_ticket(db, ticket):
    print(f'DELETING a TICKET: {ticket}')
    conn = lit.connect(db)
    cur = conn.cursor()
    try:
        samples = [s[0] for s in cur.execute(
            "SELECT DISTINCT sample FROM iomanager_file WHERE ticket = ?", (ticket,))]
        print(f'\t-These samples will be removed: {" ".join(samples)}')

        cur.execute("DELETE FROM iomanager_file WHERE ticket = ?", (ticket,))
        print('\t-iomanger_file cleaned!')
        cur.execute("DELETE FROM flowrunner_task WHERE ticket = ?", (ticket,))
        print('\t-flowrunner_task cleaned!')

        _delete_sample_rows(cur, samples)

        conn.commit()
        print('Changes were applied!')

    except Exception as e:
        print(e)
        conn.rollback()
        print('Rolled Back!')
    finally:
        conn.close()


def remove_samples(db, samples):
    print(f'DELETING a SAMPLES: {samples}')
    conn = lit.connect(db)
    cur = conn.cursor()
    try:
        _delete_sample_rows(cur, [s.strip() for s in samples.split(',') if s.strip()])
        conn.commit()
        print('Changes were applied!')
    except Exception as e:
        print(e)
        conn.rollback()
        print('Rolled Back!')
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remove a ticket or samples and all their records from the ResHub DB")
    parser.add_argument("--db", required=True, help="Path to db.sqlite3")
    parser.add_argument("--ticket", required=False, help="Ticket number")
    parser.add_argument("--samples", required=False, help="Comma separated sample names")

    opt = parser.parse_args()
    if opt.samples:
        remove_samples(opt.db, opt.samples)
    elif opt.ticket:
        remove_ticket(opt.db, opt.ticket)
    else:
        raise Exception("Require either samples in comma separated or ticket")
