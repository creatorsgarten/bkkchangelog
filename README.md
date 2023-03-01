# bkkchangelog

A project to archive and generate a change log based on [Traffy Fondue](https://traffy.in.th/) data.

## Archiving

We continuously [archive](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/etl.yml) the recently-updated tickets into a MongoDB database. The database contains not only the latest ticket data, but also the history at various points in time. This allows us to generate a change log. Note, only tickets that contain a `ticket_id` are archived.

## Backups

The database is [backed up](https://github.com/creatorsgarten/bkkchangelog/actions/workflows/backup.yml) every Saturday night and the database dump can be downloaded from GitHub Artifacts. This allows you to access the raw data that we have, and maybe you can generate some cool visualizations or do other things with it.

## API

A public API is available for accessing small parts of the database. It provides an API to access the change log in chronological order, as well as an API to find the history of a single ticket. Note that it is hosted on a free [Azure App Service](https://azure.microsoft.com/en-us/products/app-service) instance which can be unstable. For use cases beyond these simple queries, you should probably download the database dump and run your own queries.

```http
@baseUrl = https://bkkchangelog.azurewebsites.net
```

**Tip:** In Visual Studio Code, the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension can be used to try out the below API calls.

### Query the changelog

```http
GET {{baseUrl}}/changelog?sort=asc&since=2023-02-28T17:00:00Z
```

Returns a list of completed tickets, ordered by time of last completion (when state changed to “เสร็จสิ้น”)

- `sort` - `asc` or `desc` (default: `desc`)
- `since` - ISO 8601 timestamp (default: `2021-01-01T00:00:00Z`)
- `until` - ISO 8601 timestamp (default: `now`)

### Get the history of a ticket

```http
GET {{baseUrl}}/tickets/2022-NNRWCZ
```

Returns the history of a ticket.
