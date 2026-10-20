# Changelog

## v1.0.0 (2026-10-20)

First public release: the code that ran the ResHub service at Karolinska
Institutet (2024–2026), cleaned up and documented when the server was
decommissioned.

### Features
- Upload of paired-end FASTQ files and queued spear-MTB runs (Celery + RabbitMQ)
- Automatic import of spear-MTB reports, plus manual import of report JSON files
- Samples browser: lineage, drug resistance predictions and mutations per
  catalogue (WHO 2023, CRyPTIC, TB-Profiler), unverified mutations and QC
- Mutation catalogue with curator notes that appear in the sample reports
- Dashboard overview: resistance categories, samples over time, lineages and
  most frequent mutations
- User management for staff, Swedish and English interface

### Changes in this release
- Paths, hosts and secrets are read from `.env` (see `.env.example`)
- Clean initial migrations and a `reference_data` fixture (drugs and the WHO
  catalogue) so a new installation works out of the box
- Security fixes: no shell commands built from user input, validated tickets,
  sample names and upload paths, staff-only admin endpoints, login required for
  all data endpoints, https-only cookies, parameterised SQL in the cleaner script
- Deployment files for systemd, nginx and RabbitMQ in `deploy/`
- Documentation: user guide with screenshots, architecture and deployment guides

### Known limitations
- The help page and the home page *Updates* section are placeholders
- The *Export* button (samples browser) and *Dropbox mode* (dashboard) have no
  function yet
- No automated tests
