#!/bin/bash
# Wrapper used by celery.service: activates the conda environment so that the
# worker (and the spear-mtb pipeline it launches) runs with the right PATH,
# then starts the Celery worker with the options from the EnvironmentFile.

CONDA_ROOT=${CONDA_ROOT:-$HOME/miniconda3}
CONDA_ENV=${CONDA_ENV:-microwarrior}

source "$CONDA_ROOT/etc/profile.d/conda.sh"
conda activate "$CONDA_ENV"

exec ${CELERY_BIN:-celery} -A ${CELERY_APP:-microwarrior} worker \
    --pidfile=${CELERYD_PID_FILE} \
    --logfile=${CELERYD_LOG_FILE} \
    --loglevel=${CELERYD_LOG_LEVEL:-INFO} \
    ${CELERYD_OPTS}
