import { Configuration, OpenAIApi } from 'openai'

const data = {
  type: 'ถนน,ทางเท้า',
  org: 'กรุงเทพมหานคร',
  description:
    '* ปัญหา: ร้านก๋วยเตี๋ยวไก่มีการตั้งวางสิงของบนทางเท้าเวลาช่วงเย็นตั้งแต่ 1 ทุ่ม ถึง 5 ทุ่ม เป็นประจำ รวมถึงหน้าโรงรับจำนำกล้วยน้ำไท จะมีซอยเล็กๆ ระหว่างร้านก๋วยเตี๋ยวกับโรงรับจำนำ จะมีมอเตอร์ไซค์มาจอดตอนดึกๆทำให้ได้รับความเดือดร้อนในการใช้ทางเข้าออก\n* จุดเกิดเหตุ:  ไกล้สี่แยกกล้วยน้ำไทถนนพระรามที่ ๔ แขวงพระโขนง เขตคลองเตย กรุงเทพมหานคร 10110\n* บ้านเลขที่:\n* ซอย: -\n* ถนน:ถนนพระรามที่ ๔\n* เขต:คลองเตย\r\n#1555',
  ticket_id: 'KVYZWH',
  coords: ['100.58395', '13.71421'],
  photo_url:
    'https://storage.googleapis.com/traffy_public_bucket/attachment/2023-03/1677986784043.jpeg',
  after_photo:
    'https://storage.googleapis.com/traffy_public_bucket/attachment/2023-03/1678183680139.jpeg',
  address:
    '- พระโขนง คลองเตย กรุงเทพมหานคร : 42/10 สุขุมวิท 42 แขวงพระโขนง เขตคลองเตย กรุงเทพมหานคร 10110 ประเทศไทย',
  timestamp: '2023-03-05 03:26:26.117157+00',
  problem_type_abdul: ['ถนน', 'ทางเท้า'],
  star: null,
  count_reopen: '0',
  note: 'ประชาสัมพันธ์ผู้ค้าขายก้วยเตี๋ยวเรียบร้อยทักนี้จักได้กวดขันผู้ค้าต่อไป',
  state: 'เสร็จสิ้น',
  last_activity: '2023-03-07 10:08:02.914625+00',
}

async function main() {
  const openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  )
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content:
          'Summarize the following report in one sentence in Thai.\n\n```' +
          JSON.stringify({
            address: data.address,
            description: data.description,
            note: data.note,
          }) +
          '```\n\nSummarize it concisely. Do not include the date or full address. Just who did what to resolve what problem in which area.',
      },
    ],
  })
  console.log(completion.data.choices)
  console.log(completion.data.usage)
}

main()
