import 'fetch-types'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { parseArgs } from 'util'
import { generateImage } from './_image'

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one positional argument for the ticket ID',
    )
  }
  const ticketId = positionals[0]
  const ticketPath = `.data/tickets/${ticketId}.json`
  const snapshots = JSON.parse(readFileSync(ticketPath, 'utf-8'))
  snapshots.sort((a: any, b: any) => (a.updated < b.updated ? -1 : 1))
  const latest = snapshots[snapshots.length - 1]
  const image = await generateImage(latest)
  const imagePath = `.data/output/${ticketId}.jpg`
  mkdirSync('.data/output', { recursive: true })
  writeFileSync(imagePath, image)
  console.log(imagePath)
}

main()
