#!/bin/bash
LOG_FILE="/srv/data_sata/reshub/.logs/celery.log"
ERROR_LOG_FILE="/srv/data_sata/reshub/.logs/celery_error.log"
source activate microwarrior
until celery -A microwarrior worker -l info -E --concurrency 1 >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE"; do
    echo "Celery worker crashed with exit code $?. Respawning..." >&2
    sleep 1
done