import { Env } from 'lazy-strict-env'
import { z } from 'zod'
import axios from 'axios'
import { mkdirSync, writeFileSync } from 'fs'

const env = Env(
  z.object({
    SERVICE_API_TOKEN: z.string(),
  }),
)

async function main() {
  const results = await Promise.allSettled([
    generateFinishedTicketStats(),
    generateTwitterThreads(),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(result.reason)
      process.exitCode = 1
    }
  }
}

async function generateFinishedTicketStats() {
  const finishedTicketStats = await axios.get(
    'https://bkkchangelog.azurewebsites.net/api/changelogEntries.countByDateAndDistrict',
    {
      headers: {
        Authorization: `Bearer ${env.SERVICE_API_TOKEN}`,
      },
    },
  )
  mkdirSync('dist', { recursive: true })
  writeFileSync(
    'dist/finishedTicketStats.json',
    JSON.stringify(finishedTicketStats.data.result.data.results),
  )
  console.log('Finished ticket stats generated')
}

async function generateTwitterThreads() {
  const twitterThreads = await axios.get(
    'https://bkkchangelogposter.up.railway.app/twitterThreads',
    {
      headers: {
        Authorization: `Bearer ${env.SERVICE_API_TOKEN}`,
      },
    },
  )
  mkdirSync('dist', { recursive: true })
  writeFileSync('dist/twitterThreads.json', JSON.stringify(twitterThreads.data))
  console.log('Twitter threads generated')
}

main()
