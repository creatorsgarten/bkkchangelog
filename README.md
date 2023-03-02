# bkkchangelog

A project to archive and generate a change log based on [Traffy Fondue](https://traffy.in.th/) data.

## Archiving

We continuously [archive](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/etl.yml) the recently-updated tickets into a MongoDB database. The database is hosted on [Ruk-Com Cloud PaaS](https://ruk-com.cloud/). The database contains not only the latest ticket data, but also the history at various points in time. This allows us to generate a change log. Note, only tickets that contain a `ticket_id` are archived.

## Backups

The database is [backed up](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/backup.yml) every Saturday night and the database dump can be downloaded from GitHub Artifacts. This allows you to access the raw data that we have, and maybe you can generate some cool visualizations or do other things with it.

## API

A [public API](https://bkkchangelog.azurewebsites.net/api) is available for accessing small parts of the database. It provides an API to access the change log in chronological order, as well as an API to find the history of a single ticket. Note that it is hosted on a free [Azure App Service](https://azure.microsoft.com/en-us/products/app-service) instance which can be unstable. For use cases beyond these simple queries, you should probably download the database dump and run your own queries.

:construction: Note, the API is currently **very unstable**. There may be breaking changes at any time. :construction:

## Image and tweet generation

First, install dependencies:

```sh
pnpm install
```

Then run the `generate` script in the `poster` workspace:

```sh
pnpm -C poster run generate 2022-NNRWCZ
```

It will print the tweet text and the image path.

**For contributors:** To customize...

- The tweet text, edit [`poster/src/_tweet.ts`](poster/src/_tweet.ts).
- The image, edit [`poster/src/_image.ts`](poster/src/_image.ts).
