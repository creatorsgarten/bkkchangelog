import { parseArgs } from 'util'
import { mkdirSync, writeFileSync } from 'fs'
import { client } from './_api'

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one positional argument for the ticket ID',
    )
  }
  const { results: records } = await client.getTicketSnapshots.query({
    id: positionals[0],
  })
  console.log(JSON.stringify(records, null, 2))
  const path = `.data/tickets/${positionals[0]}.json`
  mkdirSync('.data/tickets', { recursive: true })
  writeFileSync(path, JSON.stringify(records, null, 2))
}

main()
