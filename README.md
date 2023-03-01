# bkkchangelog

A project to archive and generate a change log based on [Traffy Fondue](https://traffy.in.th/) data.

## Archiving

We continuously [archive](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/etl.yml) the recently-updated tickets into a MongoDB database. The database contains not only the latest ticket data, but also the history at various points in time. This allows us to generate a change log. Note, only tickets that contain a `ticket_id` are archived.

## Backups

The database is [backed up](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/backup.yml) every Saturday night and the database dump can be downloaded from GitHub Artifacts. This allows you to access the raw data that we have, and maybe you can generate some cool visualizations or do other things with it.
