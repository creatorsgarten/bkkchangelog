import axios from 'axios'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import axiosRetry from 'axios-retry'

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay })

async function main() {
  const now = Date.now()
  const toDate = (ts: number) => new Date(ts).toISOString().split('T')[0]
  const threeDaysAgo = toDate(now - 3 * 86400e3)
  const tomorrow = toDate(now + 86400e3)
  await fetchData(threeDaysAgo, tomorrow)
}

async function fetchData(start: string, end: string) {
  const limit = 1000
  let offset = 0
  let page = 1
  mkdirSync('.data/fetched', { recursive: true })
  for (; offset < 100_000; offset += limit) {
    console.log(`[${new Date().toISOString()}] Fetch page ${page++}`)
    const filename = `.data/fetched/${start}-${end}-${offset}.json`
    if (existsSync(filename)) continue
    const url = `https://publicapi.traffy.in.th/share/teamchadchart/search?limit=1000&last_activity_start=${start}&last_activity_end=${end}&offset=${offset}`
    const response = await axios.get(url)
    const { results, ...info } = response.data
    const buffer = Buffer.from(JSON.stringify(results))
    console.log(
      '=>',
      JSON.stringify(info),
      `n_rows=${results.length}, bytes=${buffer.length}`,
    )
    if (results.length === 0) break
    writeFileSync(filename, buffer)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

main()
