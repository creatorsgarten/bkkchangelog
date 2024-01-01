> [!IMPORTANT]
> This project has been shut down. The last tweet was posted on 2023-06-07, before access to Twitter API was shut down. The source code remains available here for reference (in case someone wants to revive it). The latest aggregated daily stats (from 2023-02-20 to 2023-08-30) is available at <https://creatorsgarten.github.io/bkkchangelog/finishedTicketStats.json>.

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

### Maps

Some tickets do not have an after-image. In this case, a map is rendered instead. This is powered by [Mapbox Static Maps](https://www.mapbox.com/static-maps). To work on this feature, you need to set these environment variables after getting an access token for your Mapbox account:

```sh
MAPBOX_URL_TEMPLATE="https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/pin-s+ef4444(%s)/%s,15,0/360x360@2x?access_token=____"
```

Replace `____` with your access token.

### Face redaction

When faces are detected in Before or After image, they will be redacted. This is powered by [Azure Face API](https://azure.microsoft.com/en-us/products/cognitive-services/face). To test this feature, you need to set these environment variables after [creating a Face resource in Azure Portal and getting the endpoint and API key](https://learn.microsoft.com/en-us/azure/cognitive-services/computer-vision/quickstarts-sdk/identity-client-library?tabs=visual-studio&pivots=programming-language-rest-api#prerequisites):

```sh
FACE_API_KEY=
FACE_API_ENDPOINT=
```

## Social posting schedule

Finished tickets within the day will be posted on social on the next day starting at 10:00.

<img width="971" alt="image" src="https://user-images.githubusercontent.com/193136/222732420-f61a472c-8b0f-48f0-8117-226803dfee17.png">

