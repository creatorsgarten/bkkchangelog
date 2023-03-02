import { client } from './_api'

type ChangelogEntry = Awaited<
  ReturnType<typeof client.getChangelog.query>
>['results'][number]

export async function getTweet(entry: ChangelogEntry) {
  const { results: snapshots } = await client.getTicketSnapshots.query({
    id: entry._id,
  })
  const finishedAt = entry.finished
  const finishedDate = toAsiaBangkokDate(Date.parse(finishedAt))

  const useNewVersion = finishedDate >= '2023-03-01'
  const threadId = useNewVersion ? finishedDate + '-' + entry.district : null

  const dateStartUtc = Date.parse(finishedDate + 'T00:00:00Z')
  const dateStartAsiaBangkok = dateStartUtc - 7 * 3600e3
  const dateEndAsiaBangkok = dateStartAsiaBangkok + 86400e3

  const { totalBeforeUntil: todayTotal } =
    await client.changelogEntries.count.query({
      since: new Date(dateStartAsiaBangkok).toISOString(),
      until: new Date(dateEndAsiaBangkok).toISOString(),
      ...(useNewVersion ? { district: entry.district } : {}),
    })
  const countData = await client.changelogEntries.count.query({
    since: new Date(dateStartAsiaBangkok).toISOString(),
    until: finishedAt,
    ...(useNewVersion ? { district: entry.district } : {}),
  })
  const todayNumber =
    countData.totalBeforeUntil +
    countData.idsOnUntil.filter((id) => id < entry._id).length +
    1

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

  const finishThaiDate = formatDate(Date.parse(finishedAt))
  const typeTags = entry.problemTypes
    .filter((x) => x.trim())
    .map((x) => ` #${x}`)
    .join('')
  const lines = useNewVersion
    ? [
        `#เขต${entry.district} ${finishThaiDate} (${todayNumber}/${todayTotal})`,
        `#แขวง${entry.subdistrict}${typeTags}`,
        log.join('\n'),
        `#${entry._id}`,
        '',
        String((entry.snapshot as any).data.address)
          .replace(/กรุงเทพมหานคร\s+\d+\s+ประเทศไทย/, '')
          .replace(/(แขวง|เขต|ซอย)\s+/g, '$1')
          .trim() + ` กทม. ${entry.postcode}`,
      ]
    : [
        `${finishThaiDate} (${todayNumber}/${todayTotal})`,
        `#แขวง${entry.subdistrict} #เขต${entry.district}${typeTags}`,
        log.join('\n'),
        `#${entry._id}`,
        '',
        String((entry.snapshot as any).data.address)
          .replace(/กรุงเทพมหานคร\s+\d+\s+ประเทศไทย/, '')
          .replace(/(แขวง|เขต|ซอย)\s+/g, '$1')
          .trim() + ` กทม. ${entry.postcode}`,
      ]
  const text = lines.join('\n').slice(0, 240)
  return {
    ticketId: entry._id,
    tweet: {
      status: text,
      lat: entry.location.coordinates[1],
      long: entry.location.coordinates[0],
    },
    threadId,
  }
}

function formatDate(ts: number) {
  const [y, m, d] = toAsiaBangkokDate(ts).split('-')
  return [+d, +m, +y].join('/')
}

function toAsiaBangkokDate(ts: number) {
  return new Date(ts + 7 * 3600e3).toJSON().split('T')[0]
}
