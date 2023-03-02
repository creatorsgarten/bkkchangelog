import { parseArgs } from 'util'
import { ConnectFn, withDb } from './_db'
import { workOnNextTask, workOnTask } from './_tasks'
import { client } from './_api'

async function main(connect: ConnectFn) {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length > 1) {
    console.error('Too many arguments')
    process.exit(1)
  } else if (positionals.length === 1) {
    const mongo = await connect()
    const entry = await client.changelogEntries.get.query({
      id: positionals[0],
    })
    const result = await workOnTask(mongo, entry)
    console.log(result)
  } else {
    const mongo = await connect()
    const result = await workOnNextTask(mongo)
    console.log(result)
  }
}

withDb(main)
