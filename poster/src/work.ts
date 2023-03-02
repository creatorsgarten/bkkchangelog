import { ConnectFn, withDb } from './_db'
import { workOnNextTask } from './_tasks'

async function main(connect: ConnectFn) {
  const mongo = await connect()
  const result = await workOnNextTask(mongo)
  console.log(result)
}

withDb(main)
