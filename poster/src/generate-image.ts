import 'fetch-types'
import createCanvasKit, { EmulatedCanvas2DContext } from 'canvaskit-wasm'
import fs, { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import Jimp from 'jimp'
import { resolve } from 'path'
import { parseArgs } from 'util'
import { createHash } from 'crypto'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'

const canvasKitPromise = createCanvasKit({
  locateFile: (file) => resolve(require.resolve('canvaskit-wasm'), '..', file),
})

const fontData = fs.readFileSync(require.resolve('../vendor/tf_uthong.ttf'))
const mapboxEnv = Env(
  z.object({
    MAPBOX_URL_TEMPLATE: z.string(),
  }),
)

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

  const getMapBoxImage = () => {
    const coords = latest.data.coords.join(',')
    return mapboxEnv.MAPBOX_URL_TEMPLATE.replaceAll('%s', coords)
  }

  const imageParams: ImageParams = {
    before: latest.data.photo_url,
    after: latest.data.after_photo || getMapBoxImage(),
    afterType: latest.data.after_photo ? 'photo' : 'map',
    comment: latest.data.description,
    note: latest.data.note,
    ticketId,
  }
  const image = await generateImage(imageParams)
  const imagePath = `.data/output/${ticketId}.jpg`
  mkdirSync('.data/output', { recursive: true })
  writeFileSync(imagePath, image)
  console.log(imagePath)
}

async function generateImage(imageParams: ImageParams) {
  const png = await generatePng(imageParams)
  const image = await Jimp.read(png)
  const jpg = await image.quality(72).getBufferAsync(Jimp.MIME_JPEG)
  return jpg
}

async function generatePng(imageParams: ImageParams) {
  const canvasKit = await canvasKitPromise
  const before = new FrameImage(
    await loadImage(imageParams.before),
    'Before',
    'Comment: ' + imageParams.comment,
  )
  const after = new FrameImage(
    await loadImage(imageParams.after),
    imageParams.afterType === 'map' ? 'Location' : 'After',
    imageParams.note.trim() ? 'การแก้ไข: ' + imageParams.note.trim() : '',
    imageParams.afterType === 'map' ? 64 : 0,
  )
  const canvasWidth = before.renderWidth + after.renderWidth + 120
  const canvasHeight = 1080
  const canvas = canvasKit.MakeCanvas(canvasWidth, canvasHeight)
  canvas.loadFont(fontData, {
    family: 'default',
    style: 'normal',
    weight: '400',
  })
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#15202b'
  ctx.font = '24px default'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = '#8b98a5'
  const text =
    `#${imageParams.ticketId}` +
    ' | Data and image sourced from Traffy Fondue (traffy.in.th)'
  ctx.fillText(
    text,
    canvasWidth - ctx.measureText(text).width - 8,
    canvasHeight - 12,
  )
  before.drawAt(ctx, 40, 40)
  after.drawAt(ctx, 40 + before.renderWidth + 40, 40)

  const dataUrl = canvas.toDataURL('image/png')
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

interface ImageParams {
  before: string
  after: string
  ticketId: string
  comment: string
  note: string
  afterType: 'photo' | 'map'
}

const imageLoaderPromise = canvasKitPromise.then((c) => c.MakeCanvas(1, 1))

const loadImage = async (url: string) => {
  // const cachePath = `.data/images/${url.split('/').pop()}`
  const hash = createHash('md5').update(url).digest('hex')
  const cachePath = `.data/images/${hash}`
  const buffer = existsSync(cachePath)
    ? readFileSync(cachePath)
    : Buffer.from(await fetch(url).then((res) => res.arrayBuffer()))
  const imageLoader = await imageLoaderPromise
  const image = imageLoader.decodeImage(buffer)
  if (!existsSync(cachePath)) {
    mkdirSync('.data/images', { recursive: true })
    writeFileSync(cachePath, buffer)
  }
  return image as unknown as {
    width: number
    height: number
  }
}

class FrameImage {
  renderWidth: number
  renderHeight: number

  constructor(
    private image: Awaited<ReturnType<typeof loadImage>>,
    private text: string,
    private comment: string,
    private textYOffset: number = 0,
  ) {
    this.renderHeight = 1000 - 32
    this.renderWidth = Math.round(
      // Math.max(9 / 16, Math.min(16 / 9, image.width / image.height)) *
      Math.max(1 / 2, Math.min(16 / 9, image.width / image.height)) *
        this.renderHeight,
    )
  }
  drawAt(ctx: EmulatedCanvas2DContext, x: number, y: number) {
    ctx.save()
    try {
      const scale = Math.min(
        this.renderWidth / this.image.width,
        this.renderHeight / this.image.height,
      )
      const drawWidth = Math.round(this.image.width * scale)
      const drawHeight = Math.round(this.image.height * scale)
      const drawX = Math.floor(x + (this.renderWidth - drawWidth) / 2)
      const drawY = Math.floor(y + (this.renderHeight - drawHeight) / 2)
      const barHeight = 32
      ctx.fillStyle = '#00000044'
      ctx.fillRect(x, y + barHeight, this.renderWidth, this.renderHeight)
      ctx.fillStyle = '#000000'
      ctx.drawImage(this.image, drawX, drawY + barHeight, drawWidth, drawHeight)
      ctx.fillStyle = '#273340'
      ctx.fillRect(x, y, this.renderWidth, barHeight)
      ctx.font = '36px default'
      ctx.fillStyle = '#8b98a5'
      ctx.fillText(
        this.text,
        drawX + (drawWidth - ctx.measureText(this.text).width) / 2,
        drawY + 24,
      )

      if (this.comment) {
        ctx.font = '28px default'
        const lines = wrapWords(ctx, this.comment, drawWidth - 36)
        ctx.save()
        ctx.fillStyle = '#273340'
        ctx.globalAlpha = 0.7
        const lineHeight = 32
        const textBgHeight = lines.length * lineHeight + 38
        const textYOffset = this.textYOffset
        ctx.fillRect(
          drawX,
          drawY + barHeight + drawHeight - textBgHeight - textYOffset,
          drawWidth,
          textBgHeight,
        )
        ctx.restore()
        ctx.fillStyle = '#ffffff'
        for (const [i, line] of lines.entries()) {
          ctx.fillText(
            line,
            drawX + 16,
            drawY +
              barHeight +
              drawHeight -
              24 -
              (lines.length - i - 1) * lineHeight -
              textYOffset,
          )
        }
      }
    } finally {
      ctx.restore()
    }
  }
}

function wrapWords(ctx: EmulatedCanvas2DContext, text: string, w: number) {
  const words = Array.from(
    new Intl.Segmenter('th', { granularity: 'word' }).segment(
      text.replace(/\s+/g, ' ').trim(),
    ),
  )
  const lines = []
  for (const { segment: word } of words) {
    if (
      lines.length === 0 ||
      ctx.measureText(lines[lines.length - 1] + word).width > w
    ) {
      lines.push(word)
    } else {
      lines[lines.length - 1] += word
    }
  }
  return lines.map((x) => x.trim())
}

main()