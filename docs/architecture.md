# Architecture

microwarrior is a single Django 4.2 project (`microwarrior/`) with seven apps.
Pages are server-rendered templates; almost all data is loaded afterwards by
JavaScript (jQuery, Bootstrap Table, D3) from JSON endpoints in the same apps.

```
browser ──HTTP──> nginx ──> gunicorn ──> Django ──> SQLite (db.sqlite3)
                                            │
                                            └─ .delay() ─> RabbitMQ ─> Celery worker
                                                                         │
                                                         spear-mtb.sh (Nextflow)
```

## Project package: `microwarrior/`

| File | Purpose |
|------|---------|
| `settings.py` | All configuration. Paths, secrets and hosts are read from `microwarrior/.env` through `django-environ` (see `.env.example`). Static assets are bundled per page with `django-pipeline` (`PIPELINE` setting). |
| `urls.py` | Mounts every app at the root, plus `admin/`, `iom/` (uploads) and the i18n endpoints. |
| `celery.py` | Celery app; settings prefixed with `CELERY_` are taken from Django settings. |
| `wsgi.py` / `asgi.py` | Entry points; production uses `wsgi` through gunicorn. |

## Apps

### `users`
Login, logout, password change and user administration.

- Login uses the **e-mail** field: `login_user` looks up the `User` by e-mail and
  then authenticates with its username.
- `add_user`, `edit_user`, `reset_password` are called from the settings page
  (routes are registered in `settings/urls.py`).
- Uses Django's built-in `User` model; `models.py` is empty.

### `dashboard`
Landing page and the main working page.

| Route | View | Description |
|-------|------|-------------|
| `/` | `home` | Public landing page |
| `/dashboard` | `dashboard` | Upload form, job queue, overview |
| `/chk-ids/` | `check_sample_ids` | Rejects samples that are already analysed or queued |
| `/enqjob` | `enqueue_task` | Queues `spear_mtb` for a ticket, creates a `flowrunner.Task` |
| `/fetchjobs` | `get_jobs` | Job queue (last 60 days, at least 20 jobs) merged with live Celery state |
| `/fetchlog` | `get_log` | Per-sample outcome of a ticket |
| `/fetch-overview/` | `get_overview` | Category counts, lineage tree, most frequent WHO mutations |
| `/help/` | `under_construction` | Placeholder |

`language_middleware.py` activates the language stored in the language cookie
(falling back to `LANGUAGE_CODE`, Swedish) before Django's `LocaleMiddleware` runs. Front-end code: `static/js/dash.js` (upload, queue, D3 charts).

### `iomanager`
Chunked upload of FASTQ files (`/iom/upload/<ticket>`).

The browser slices each file and posts the chunks in order. The first chunk creates
`MEDIA_ROOT/<ticket>/<sample>_<read>.fastq.gz` and a `File` record; later chunks are
appended until the `end` flag sets `File.eof`. Duplicate records cause the upload to
be rolled back.

### `flowrunner`
Runs the pipeline and imports its results (`tasks.py`).

- `spear_mtb(ticket)`: Celery task that calls
  `WORKFLOW_ROOT/spear-mtb.sh` with the working, assets, archive and raw-sequence
  folders from settings, then converts the Nextflow trace
  (`ARCHIVE_ROOT/traces/<ticket>.trace`) into JSON.
- `Task_handler.on_success`: stores the trace as the task log, imports
  `ARCHIVE_ROOT/reports/<ticket>.json` with `save_report`, sets the status and calls
  `clean_storage`.
- `save_report(report_json, user_id, task=None)`: creates `Sample`, `Lineage`,
  `Mutation` and `UnverifiedMutation` rows. Each sample is imported inside its own
  savepoint, so one bad sample does not stop the rest. Samples already in the
  database are skipped. Also used by the JSON import on the settings page.
- `clean_storage`: removes the Nextflow work folder; the uploaded reads are removed
  only after a successful run.
- `update_status`: asks Celery (`celery inspect active/reserved/scheduled`) which
  tasks are running or waiting.

`Task.status` values:

| Value | Meaning |
|------:|---------|
| -2 | enqueued |
| -1 | running |
| 0 | completed, report imported |
| 1 | failed (no report or exception) |

### `samplesbrowser`
Results browser and the core data models.

| Route | View | Description |
|-------|------|-------------|
| `/samplesbrowser` | `samplesbrowser` | Page |
| `/get-samples/` | `fetch_samples` | Filter samples by ticket, ids, name, ISO week, date range, lineage, mutation, drug or resistance category |
| `/get-mutations/` | `fetch_mutations` | Mutations, predictions and unverified mutations per sample, grouped by drug and catalogue |
| `/get-meta/` | `fetch_meta` | Catalogue names (`Meta` table) and drugs for the filters |

Front-end code: `static/js/sambrow.js`.

### `catalogmanager`
Browse the catalogue evidence (`Evidence`) per drug and grade, and let users attach
notes with their own prediction (`Note`). Notes are never removed: deleting sets
`is_del`, and editing marks the old note deleted and stores a new one with
`action='edit'`, so the history is kept.

Routes: `/catalog/`, `/get-drgr/`, `/get-evidence/`, `/add-note/`, `/edit-note/`,
`/del-note/`. Front-end code: `static/js/cata.js`.

### `settings`
Staff-only administration page (`/settings`):

- **JSON import** (`/upload-json/`): import a spear-MTB report produced elsewhere.
  It is saved under `MEDIA_ROOT/json_uploads` and imported with `save_report` as a
  `JSON-IMPORT` task.
- **Remove samples** (`/get-del-samples/`, `/del-samples/`): look up and delete samples.
- **Users** (`/get-users/` plus the `users` views).

## Data model

```
auth.User ──< flowrunner.Task ──< samplesbrowser.Sample ──1 Lineage
                                         │
                                         ├──< Mutation >── Drug
                                         └──< UnverifiedMutation >── Evidence >── Drug
                                                                      │
                                                   catalogmanager.Note ┘ (author: User)
iomanager.File  (one row per uploaded FASTQ, linked to a Task by ticket)
samplesbrowser.Meta  (lists used by the filters)
```

- `Sample`: one analysed isolate, with QC (depth, mapped reads) and whether it passed
  each catalogue (`passed_who`, `passed_cryptic`, `passed_tbprofiler`).
- `Mutation`: a variant reported for a sample and drug by one catalogue, with
  prediction (`R`, `U`, `S`, ...), frequency and depth.
- `Evidence`: catalogue entries (WHO 2023 catalogue). PPV, sensitivity and
  specificity are stored as text with a `%` sign, as provided by the catalogue.
- `UnverifiedMutation`: WHO-catalogue entries linked to a sample that the pipeline
  could not confirm.
- `Drug`, `Evidence` and `Meta` are reference data, shipped as the fixture
  `samplesbrowser/fixtures/reference_data.json.gz`
  (`python manage.py loaddata reference_data`).

## Report format

`save_report` expects the spear-MTB JSON report:

```json
{
  "catalogs_repo": {"who": "...", "cryptic": "...", "tbdb": "..."},
  "samples": [{
    "seqid": "...", "category_who": "...", "analyzed_catalogs": ["..."],
    "genome_median_depth": 0, "num_mapped_reads": 0, "percent_reads_mapped": 0,
    "lineage": {"lineage": "", "family": "", "rd": "", "spoligotype": "", "is_mixed": false},
    "variants": [{"catalog": "", "drug": "", "gene_name": "", "pos": 0, "change": "",
                  "nucleotide_change": "", "protein_change": "", "effect": "",
                  "variant": "", "prediction": "", "freq": 0, "depth": 0,
                  "grade": "", "comment_1": "", "footnote": ""}],
    "unverified_mutations": {"<key>": {"catalog": "", "drug": "", "variant": ""}}
  }]
}
```

## Job life cycle

1. On the dashboard the browser creates a random ticket and checks the sample names
   with `/chk-ids/`.
2. Each FASTQ file is uploaded in chunks to `/iom/upload/<ticket>`.
3. `/enqjob` queues `flowrunner.tasks.spear_mtb(ticket)` and stores a `Task`
   (status -2).
4. The Celery worker (concurrency 1) runs `spear-mtb.sh` on
   `MEDIA_ROOT/<ticket>`. While it runs, `/fetchjobs` shows it as *Running*.
5. On completion the report is imported, the status becomes 0 (or 1), and the
   temporary files are removed.
6. Results appear in the samples browser; `/fetchlog` shows per-sample status.

## Translations

Source strings are written in Swedish and translated to English. Message files are
in `locale/` (shared templates) and in each app's `locale/` folder. After changing
strings:

```bash
python manage.py makemessages -l en -l sv
python manage.py makemessages -d djangojs -l en -l sv
python manage.py compilemessages
```

## Migrations

Each app has a single `0001_initial` migration generated from the current models
(the earlier migration history had diverged from the production database and was
squashed). `samplesbrowser/0002` stores the catalogue percentages as text.

## Security

- Admin endpoints (users, sample deletion, JSON import) require a staff user
  (`users/decorators.py: staff_required`); staff cannot edit or reset superusers.
- Tickets and sample names are validated (`flowrunner.tasks.is_valid_ticket`,
  `iomanager.views.SAMPLE_RE`) before they are used in file paths.
- The pipeline is started without a shell, and temporary folders are removed with
  `shutil.rmtree` only inside `WORKING_ROOT`/`MEDIA_ROOT`.
- Cookies are https-only when `DEBUG=False`.

## Maintenance script (`scripts/`)

`reshub_cleaner.py` removes a ticket (`--ticket`) or samples (`--samples a,b`) with
all their records, working directly on the SQLite file (`--db`). Make a copy of
the database before running it.

## Unfinished parts

- `/help/` renders `templates/under_contruction.html`.
- The home page *Updates* section is static placeholder text. (*News* and
  *Publications* are filled in the browser from RSS feeds via rss2json, see
  `dashboard/static/js/hm.js`.)
- Dashboard *Dropbox mode* switch and samples browser *Export* button have no
  behaviour attached.
- Not every app has a Swedish message file (`catalogmanager`, `settings`).
- `samplesbrowser/views.py`: request rate limiting is a TODO.
- `samplesbrowser/static/js/sambrow.js`: open TODO "Check if WHO passed, Don't show
  S for all" in the drug prediction cards.
- `tests.py` files are empty; there are no automated tests.
