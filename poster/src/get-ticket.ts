import { parseArgs } from 'util'
import { mkdirSync, writeFileSync } from 'fs'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'

const env = Env(
  z.object({
    BKKCHANGELOG_API_URL: z
      .string()
      .url()
      .default('https://bkkchangelog.azurewebsites.net'),
  }),
)

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one positional argument for the ticket ID',
    )
  }
  const response = await fetch(
    env.BKKCHANGELOG_API_URL + '/tickets/' + positionals[0],
  )
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ticket ${positionals[0]} - ${response.status}`,
    )
  }
  const records = ((await response.json()) as any).results
  console.log(JSON.stringify(records, null, 2))
  const path = `.data/tickets/${positionals[0]}.json`
  mkdirSync('.data/tickets', { recursive: true })
  writeFileSync(path, JSON.stringify(records, null, 2))
}

main()
