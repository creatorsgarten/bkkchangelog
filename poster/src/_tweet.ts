import { client } from './_api'

type ChangelogEntry = Awaited<
  ReturnType<typeof client.getChangelog.query>
>['results'][number]
type Snapshot = Awaited<
  ReturnType<typeof client.getTicketSnapshots.query>
>['results'][number]
export function getTweet(entry: ChangelogEntry, snapshots: Snapshot[]) {
  let lastStatus = 'รอรับเรื่อง'
  snapshots.sort((a, b) => (a.updated < b.updated ? -1 : 1))
  const log: string[] = []
  const addLog = (date: string, thing: string) => {
    log.push(date + ' - ' + thing)
  }
  addLog(
    formatDate(Date.parse((entry.snapshot as any).data.timestamp)),
    'รอรับเรื่อง',
  )
  for (const snapshot of snapshots) {
    const data = (snapshot as any).data
    if (data.state === lastStatus) continue
    addLog(formatDate(Date.parse(snapshot.updated)), data.state)
    lastStatus = data.state
  }

  const text = [
    `#แขวง${entry.subdistrict} #เขต${entry.district}${entry.problemTypes
      .map((x) => ` #${x}`)
      .join('')}`,
    log.join('\n'),
    `#${entry._id}`,
    '',
    String((entry.snapshot as any).data.address)
      .replace(/กรุงเทพมหานคร\s+\d+\s+ประเทศไทย/, '')
      .replace(/(แขวง|เขต|ซอย)\s+/g, '$1')
      .trim(),
  ]
    .join('\n')
    .slice(0, 240)
  return {
    ticketId: entry._id,
    tweet: {
      status: text,
      lat: entry.location.coordinates[1],
      long: entry.location.coordinates[0],
    },
  }
}
function formatDate(ts: number) {
  const [y, m, d] = new Date(ts + 7 * 3600e3).toJSON().split('T')[0].split('-')
  return [+d, +m, +y].join('/')
}
