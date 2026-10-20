# Deployment

Production runs as four services on one Linux host:

| Service | Role | Config in this repo |
|---------|------|---------------------|
| nginx | TLS, serves `/static/`, proxies to gunicorn | `deploy/nginx/microwarrior.conf` |
| gunicorn | Django WSGI server (5 workers, unix socket) | `deploy/systemd/gunicorn.service` |
| RabbitMQ | Celery message broker | `deploy/rabbitmq/` |
| Celery worker | runs spear-MTB jobs, one at a time | `deploy/systemd/celery.service`, `deploy/celery.conf`, `deploy/run_celery.sh` |

The files under `deploy/` use placeholders: `<USER>`, `<APP_DIR>` (this repository),
`<CONDA_ENV_DIR>` (e.g. `~/miniconda3/envs/microwarrior`) and the certificate paths.

## 1. Prerequisites

- Linux with systemd, nginx and RabbitMQ (`apt install nginx rabbitmq-server`)
- Miniconda
- [spear-MTB](https://github.com/Karolinska-AMR/spear-mtb) installed with its own
  conda environment (`spear-mtb`), Nextflow and Java, and its reference assets
- Enough disk for uploads, Nextflow work files and the archive

## 2. Application

```bash
git clone https://github.com/Karolinska-AMR/microwarrior.git
cd microwarrior
conda env create -f environment.yaml

cp .env.example microwarrior/.env      # fill in, see Configuration
conda activate microwarrior
python manage.py migrate
python manage.py collectstatic
python manage.py compilemessages
```

## 3. Configuration (`microwarrior/.env`)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `False` in production |
| `ALLOWED_HOSTS` | comma separated host names |
| `CELERY_BROKER_URL` | `amqp://user:password@localhost:5672//` |
| `CELERY_RESULT_BACKEND` | `db+sqlite:///tasks_q.sqlite3` (relative to the working directory) |
| `SQLITE_DB` | folder containing `db.sqlite3` (default: project folder) |
| `WORKFLOW_ROOT` | spear-MTB checkout, must contain `spear-mtb.sh` and `main.config` |
| `MEDIA_ROOT` | uploaded FASTQ files, one folder per ticket; also `json_uploads/` |
| `WORKING_ROOT` | Nextflow work directory |
| `ASSETS_ROOT` | spear-MTB reference assets |
| `ARCHIVE_ROOT` | pipeline output: `reports/<ticket>.json`, `traces/<ticket>.trace` |
| `RAWSEQ_ROOT` | archive of raw reads |
| `STATIC_ROOT` | target of `collectstatic` (default: `<project>/static`) |
| `LOG_DIR` | Django log folder, `debug.log` (default: `<project>/logs`) |

## 4. RabbitMQ

```bash
sudo cp deploy/rabbitmq/rabbitmq-env.conf deploy/rabbitmq/enabled_plugins /etc/rabbitmq/
sudo systemctl restart rabbitmq-server
```

`consumer_timeout` is raised to 24 h. With the default (30 min) RabbitMQ closes the
channel while a long pipeline run is still in progress. `enabled_plugins` turns on
the management UI (port 15672).

## 5. Celery worker

```bash
sudo mkdir -p /etc/conf.d
sudo cp deploy/celery.conf /etc/conf.d/celery                 # edit <USER>
sudo cp deploy/systemd/celery.service /etc/systemd/system/    # edit placeholders
sudo systemctl daemon-reload
sudo systemctl enable --now celery
```

`celery.service` starts `deploy/run_celery.sh`, which activates the conda
environment and then `exec`s the Celery worker with the options from
`/etc/conf.d/celery`. The service is bound to `rabbitmq-server` and restarts with
it. Worker logs: `/var/log/celery/`.

## 6. gunicorn and nginx

```bash
sudo mkdir -p /var/log/gunicorn && sudo chown <USER>:www-data /var/log/gunicorn
sudo cp deploy/systemd/gunicorn.service /etc/systemd/system/  # edit placeholders
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn

sudo cp deploy/nginx/microwarrior.conf /etc/nginx/sites-available/microwarrior
sudo ln -s /etc/nginx/sites-available/microwarrior /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

nginx serves `/static/` from `/var/www/static`, so `STATIC_ROOT` must be
`/var/www/static` for this config. After changing static files run
`python manage.py collectstatic` again.

## 7. Updating

```bash
git pull
conda activate microwarrior
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py compilemessages
sudo systemctl restart gunicorn celery
```

## Useful commands

```bash
systemctl status celery gunicorn rabbitmq-server nginx
journalctl -u celery -f
celery -A microwarrior inspect active
sudo rabbitmqctl list_queues
```

## ResHub server (reshub.labmed.ki.se)

The original deployment, kept for reference when moving or restoring the service.

| Item | Location |
|------|----------|
| Code | `/home/h5admin/private/source/microwarrior` |
| spear-MTB | `/home/h5admin/private/source/spear-mtb` |
| conda env | `/home/h5admin/miniconda3/envs/microwarrior` |
| Database | `/srv/data_ssd/reshub/db/db.sqlite3` |
| Uploads / work / assets | `/srv/data_ssd/reshub/{uploads,working_dir,assets}` |
| Archive / raw reads | `/srv/data_sata/reshub/{spear_out,raw_seq}` |
| Django log | `/srv/data_sata/reshub/.logs/debug.log` |
| Static files | `/var/www/static` |
| TLS certificate | HARICA, `/etc/ssl/harica/`, key in `/etc/ssl/private/` |
| Celery node | `hamal1`, logs in `/var/log/celery/` |

### What to keep when decommissioning

Not stored in git and needed to restore the service with its data:

- `db.sqlite3` (all users, samples, results, notes and the reference tables `Drug`,
  `Evidence`, `Meta`)
- `microwarrior/.env` (secrets; keep it somewhere safe, not in git)
- the spear-MTB output archive (`ARCHIVE_ROOT`) and raw reads (`RAWSEQ_ROOT`)
- the spear-MTB reference assets (`ASSETS_ROOT`)
- the WHO catalogue CSV used by `scripts/update_catalog.py`

Make a consistent copy of the database with
`sqlite3 db.sqlite3 ".backup db-backup.sqlite3"` while the services are stopped.
