#!/bin/bash


# LOG_FILE="/srv/data_sata/reshub/.logs/celery.log"
# ERROR_LOG_FILE="/srv/data_sata/reshub/.logs/celery_error.log"
# source activate /home/h5admin/miniconda3/envs/microwarrior
# until celery -A microwarrior worker -l info -E --concurrency 1 >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE"; do
#     echo "Celery worker crashed with exit code $?. Respawning..." >&2
#     sleep 1
# done

# Wrapper script to activate Conda environment and run Celery worker

# Source Conda initialization
source /home/h5admin/miniconda3/etc/profile.d/conda.sh

# Activate the microwarrior environment
conda activate microwarrior

# Run the Celery worker
exec ${CELERY_BIN} -A ${CELERY_APP} worker \
    --pidfile=${CELERYD_PID_FILE} \
    --logfile=${CELERYD_LOG_FILE} \
    --loglevel=${CELERYD_LOG_LEVEL} \
    ${CELERYD_OPTS}