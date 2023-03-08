import { MongoClient } from 'mongodb'
import { getDiscordThreadCollection } from './_db'
import axios from 'axios'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'

const districtToChannel: Record<string, string | undefined> = {
  จตุจักร: '978525051747971073',
  ดอนเมือง: '978540147907911710',
  บางเขน: '978540249854672926',
  บางซื่อ: '978549418292834314',
  ลาดพร้าว: '978549497732927538',
  หลักสี่: '978549625298509845',
  ดินแดง: '978549873139925082',
  ดุสิต: '978549912897716264',
  ป้อมปราบฯ: '978553500009127947',
  พญาไท: '978553874346561566',
  พระนคร: '978553999169044550',
  ราชเทวี: '978554048456323112',
  วังทองหลาง: '978554150755389470',
  สัมพันธวงศ์: '978554209798610954',
  ห้วยขวาง: '978554270276284416',
  คลองสามวา: '978554416468721675',
  คันนายาว: '978554467777642497',
  บางกะปิ: '978554528616034334',
  บึงกุ่ม: '978554579732008991',
  ประเวศ: '978554629950431252',
  มีนบุรี: '978554787387822100',
  ลาดกระบัง: '978554848071024640',
  สะพานสูง: '978554969684856832',
  หนองจอก: '978555038429503488',
  คลองเตย: '978555188744974396',
  บางคอแหลม: '978555240922095636',
  บางนา: '978555288363888640',
  บางรัก: '978555325768691752',
  ปทุมวัน: '978555374066081802',
  พระโขนง: '978555434262732840',
  ยานนาวา: '978555482979594270',
  วัฒนา: '978555533348982834',
  สวนหลวง: '978555581965144064',
  สาทร: '978555620909273108',
  คลองสาน: '978555705529364530',
  จอมทอง: '978555861003804672',
  ตลิ่งชัน: '978555924241338388',
  ทวีวัฒนา: '978555988506472448',
  ธนบุรี: '978556063727091712',
  บางกอกน้อย: '978556127593775125',
  บางกอกใหญ่: '978556166298828820',
  บางพลัด: '978556203493904384',
  ทุ่งครุ: '978556343248101437',
  บางขุนเทียน: '978556417369866271',
  บางแค: '978556462710267935',
  บางบอน: '978556506100342844',
  ภาษีเจริญ: '978556569044283422',
  ราษฎร์บูรณะ: '978556644650795059',
  หนองแขม: '978556713017954344',
  สายไหม: '1070328081618833488',
}

const env = Env(
  z.object({
    DISCORD_TOKEN: z.string(),
  }),
)

async function getDiscordThreadId(client: MongoClient, district: string) {
  const districtChannelId = getDistrictChannelId(district)
  const collection = getDiscordThreadCollection(client)
  let thread = await collection.findOne({ _id: district })
  if (!thread) {
    const { data } = await axios.post(
      `https://discord.com/api/channels/${districtChannelId}/messages`,
      { content: `${district} changelog` },
      { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } },
    )
    thread = {
      _id: district,
      messageId: data.id,
    }
    await axios.post(
      `https://discord.com/api/channels/${districtChannelId}/messages/${data.id}/threads`,
      { name: `${district} changelog` },
      { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } },
    )
    await collection.insertOne(thread)
  }
  return thread
}

function getDistrictChannelId(district: string) {
  const districtChannelId = districtToChannel[district]
  if (!districtChannelId) {
    throw new Error(`Unknown district: ${district}`)
  }
  return districtChannelId
}

export async function postToDiscord(
  client: MongoClient,
  twitterId: string,
  district: string,
) {
  const threadId = await getDiscordThreadId(client, district)
  const tweetUrl = `https://twitter.com/bkkchangelog/status/${twitterId}`
  await axios.post(
    `https://discord.com/api/channels/${threadId.messageId}/messages`,
    { content: tweetUrl },
    { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } },
  )
}
