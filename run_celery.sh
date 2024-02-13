#!/bin/bash
LOG_FILE="/srv/data_sata/reshub/.log/celery.log"
ERROR_LOG_FILE="/srv/data_sata/reshub/.log/celery_error.log"
conda activate microwarrior
until celery -A microwarrior worker -l info -E --concurrency 1 >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE"; do
    echo "Celery worker crashed with exit code $?. Respawning..." >&2
    sleep 1
done