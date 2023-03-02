"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var import_fastify = __toESM(require("fastify"));

// src/_db.ts
var import_lazy_strict_env = require("lazy-strict-env");
var import_mongodb = require("mongodb");
var import_zod = require("zod");
var env = (0, import_lazy_strict_env.Env)(
  import_zod.z.object({
    POSTER_MONGODB_URI: import_zod.z.string().url()
  })
);
async function connectToDatabase() {
  return await import_mongodb.MongoClient.connect(env.POSTER_MONGODB_URI);
}
function getTweetTaskCollection(client2) {
  return client2.db().collection("tweet_tasks");
}
function getTwitterThreadCollection(client2) {
  return client2.db().collection("twitter_threads");
}
function getStateCollection(client2) {
  return client2.db().collection("state");
}

// src/_api.ts
var import_client = require("@trpc/client");
var import_lazy_strict_env2 = require("lazy-strict-env");
var import_zod2 = require("zod");
var apiEnv = (0, import_lazy_strict_env2.Env)(
  import_zod2.z.object({
    BKKCHANGELOG_API_URL: import_zod2.z.string().url().default("https://bkkchangelog.azurewebsites.net/api")
  })
);
var client = (0, import_client.createTRPCProxyClient)({
  links: [
    (0, import_client.httpBatchLink)({
      url: apiEnv.BKKCHANGELOG_API_URL
    })
  ]
});

// src/_tweet.ts
async function getTweet(entry) {
  const { results: snapshots } = await client.getTicketSnapshots.query({
    id: entry._id
  });
  const finishedAt = entry.finished;
  const finishedDate = toAsiaBangkokDate(Date.parse(finishedAt));
  const useNewVersion = finishedDate >= "2023-03-01";
  const threadId = useNewVersion ? finishedDate + "-" + entry.district : null;
  const dateStartUtc = Date.parse(finishedDate + "T00:00:00Z");
  const dateStartAsiaBangkok = dateStartUtc - 7 * 36e5;
  const dateEndAsiaBangkok = dateStartAsiaBangkok + 864e5;
  const { totalBeforeUntil: todayTotal } = await client.changelogEntries.count.query({
    since: new Date(dateStartAsiaBangkok).toISOString(),
    until: new Date(dateEndAsiaBangkok).toISOString(),
    ...useNewVersion ? { district: entry.district } : {}
  });
  const countData = await client.changelogEntries.count.query({
    since: new Date(dateStartAsiaBangkok).toISOString(),
    until: finishedAt,
    ...useNewVersion ? { district: entry.district } : {}
  });
  const todayNumber = countData.totalBeforeUntil + countData.idsOnUntil.filter((id) => id < entry._id).length + 1;
  let lastStatus = "\u0E23\u0E2D\u0E23\u0E31\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07";
  snapshots.sort((a, b) => a.updated < b.updated ? -1 : 1);
  const log = [];
  const addLog = (date, thing) => {
    log.push(date + " - " + thing);
  };
  addLog(
    formatDate(Date.parse(entry.snapshot.data.timestamp)),
    "\u0E23\u0E2D\u0E23\u0E31\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07"
  );
  for (const snapshot of snapshots) {
    const data = snapshot.data;
    if (data.state === lastStatus)
      continue;
    addLog(formatDate(Date.parse(snapshot.updated)), data.state);
    lastStatus = data.state;
  }
  const finishThaiDate = formatDate(Date.parse(finishedAt));
  const typeTags = entry.problemTypes.filter((x) => x.trim()).map((x) => ` #${x}`).join("");
  const lines = useNewVersion ? [
    `#\u0E40\u0E02\u0E15${entry.district} ${finishThaiDate} (${todayNumber}/${todayTotal})`,
    `#\u0E41\u0E02\u0E27\u0E07${entry.subdistrict}${typeTags}`,
    log.join("\n"),
    `#${entry._id}`,
    "",
    String(entry.snapshot.data.address).replace(/กรุงเทพมหานคร\s+\d+\s+ประเทศไทย/, "").replace(/(แขวง|เขต|ซอย)\s+/g, "$1").trim() + ` \u0E01\u0E17\u0E21. ${entry.postcode}`
  ] : [
    `${finishThaiDate} (${todayNumber}/${todayTotal})`,
    `#\u0E41\u0E02\u0E27\u0E07${entry.subdistrict} #\u0E40\u0E02\u0E15${entry.district}${typeTags}`,
    log.join("\n"),
    `#${entry._id}`,
    "",
    String(entry.snapshot.data.address).replace(/กรุงเทพมหานคร\s+\d+\s+ประเทศไทย/, "").replace(/(แขวง|เขต|ซอย)\s+/g, "$1").trim() + ` \u0E01\u0E17\u0E21. ${entry.postcode}`
  ];
  const text = lines.join("\n").slice(0, 240);
  return {
    ticketId: entry._id,
    tweet: {
      status: text,
      lat: entry.location.coordinates[1],
      long: entry.location.coordinates[0]
    },
    threadId
  };
}
function formatDate(ts) {
  const [y, m, d] = toAsiaBangkokDate(ts).split("-");
  return [+d, +m, +y].join("/");
}
function toAsiaBangkokDate(ts) {
  return new Date(ts + 7 * 36e5).toJSON().split("T")[0];
}

// src/_image.ts
var import_canvaskit_wasm = __toESM(require("canvaskit-wasm"));
var import_fs = __toESM(require("fs"));
var import_jimp = __toESM(require("jimp"));
var import_path = require("path");
var import_crypto = require("crypto");
var import_lazy_strict_env3 = require("lazy-strict-env");
var import_zod3 = require("zod");
var _canvasKitPromise;
function getCanvasKit() {
  _canvasKitPromise ??= (0, import_canvaskit_wasm.default)({
    locateFile: (file) => (0, import_path.resolve)(require.resolve("canvaskit-wasm"), "..", file)
  });
  return _canvasKitPromise;
}
var fontData = import_fs.default.readFileSync(require.resolve("../vendor/tf_uthong.ttf"));
var mapboxEnv = (0, import_lazy_strict_env3.Env)(
  import_zod3.z.object({
    MAPBOX_URL_TEMPLATE: import_zod3.z.string()
  })
);
async function generateImage(snapshot) {
  const getMapBoxImage = () => {
    const coords = snapshot.data.coords.join(",");
    return mapboxEnv.MAPBOX_URL_TEMPLATE.replaceAll("%s", coords);
  };
  const ticketId = snapshot.data.ticket_id;
  const imageParams = {
    before: snapshot.data.photo_url,
    after: snapshot.data.after_photo || getMapBoxImage(),
    afterType: snapshot.data.after_photo ? "photo" : "map",
    comment: snapshot.data.description,
    note: snapshot.data.note,
    ticketId
  };
  const image = await generateJpeg(imageParams);
  return image;
}
async function generateJpeg(imageParams) {
  const png = await generatePng(imageParams);
  const image = await import_jimp.default.read(png);
  const jpg = await image.quality(72).getBufferAsync(import_jimp.default.MIME_JPEG);
  return jpg;
}
async function generatePng(imageParams) {
  const canvasKit = await getCanvasKit();
  const before = new FrameImage(
    await loadImage(imageParams.before),
    "Before",
    "Comment: " + imageParams.comment,
    0,
    await loadFaces(imageParams.before)
  );
  const after = new FrameImage(
    await loadImage(imageParams.after),
    imageParams.afterType === "map" ? "Location" : "After",
    imageParams.note.trim() ? "\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02: " + imageParams.note.trim() : "",
    imageParams.afterType === "map" ? 64 : 0,
    imageParams.afterType === "map" ? void 0 : await loadFaces(imageParams.after)
  );
  const canvasWidth = before.renderWidth + after.renderWidth + 120;
  const canvasHeight = 1080;
  const canvas = canvasKit.MakeCanvas(canvasWidth, canvasHeight);
  canvas.loadFont(fontData, {
    family: "default",
    style: "normal",
    weight: "400"
  });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#15202b";
  ctx.font = "24px default";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#8b98a5";
  const text = `#${imageParams.ticketId} | Data and image sourced from Traffy Fondue (traffy.in.th)`;
  ctx.fillText(
    text,
    canvasWidth - ctx.measureText(text).width - 8,
    canvasHeight - 12
  );
  before.drawAt(ctx, 40, 40);
  after.drawAt(ctx, 40 + before.renderWidth + 40, 40);
  const dataUrl = canvas.toDataURL("image/png");
  return Buffer.from(dataUrl.split(",")[1], "base64");
}
var _imageLoaderPromise;
function getImageLoader() {
  _imageLoaderPromise ??= getCanvasKit().then((c) => c.MakeCanvas(1, 1));
  return _imageLoaderPromise;
}
var loadImage = async (url) => {
  const hash = (0, import_crypto.createHash)("md5").update(url).digest("hex");
  const cachePath = `.data/images/${hash}`;
  const buffer = (0, import_fs.existsSync)(cachePath) ? (0, import_fs.readFileSync)(cachePath) : Buffer.from(await fetch(url).then((res) => res.arrayBuffer()));
  const imageLoader = await getImageLoader();
  const image = imageLoader.decodeImage(buffer);
  if (!(0, import_fs.existsSync)(cachePath)) {
    (0, import_fs.mkdirSync)(".data/images", { recursive: true });
    (0, import_fs.writeFileSync)(cachePath, buffer);
  }
  return image;
};
var faceEnv = (0, import_lazy_strict_env3.Env)(
  import_zod3.z.object({
    FACE_API_KEY: import_zod3.z.string(),
    FACE_API_ENDPOINT: import_zod3.z.string()
  })
);
var loadFaces = async (imageUrl) => {
  if (!faceEnv.valid)
    return null;
  const hash = (0, import_crypto.createHash)("md5").update(imageUrl).digest("hex");
  const cachePath = `.data/faces/${hash}.json`;
  if ((0, import_fs.existsSync)(cachePath)) {
    return JSON.parse((0, import_fs.readFileSync)(cachePath, "utf-8"));
  }
  const apiUrl = faceEnv.FACE_API_ENDPOINT + "face/v1.0/detect?" + new URLSearchParams({
    returnFaceId: "false",
    recognitionModel: "recognition_04",
    detectionModel: "detection_03"
  });
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": faceEnv.FACE_API_KEY
    },
    body: JSON.stringify({ url: imageUrl })
  });
  if (!res.ok) {
    console.error("Face error", await res.text());
    throw new Error("Face API error " + res.status);
  }
  const data = await res.json();
  (0, import_fs.mkdirSync)(".data/faces", { recursive: true });
  (0, import_fs.writeFileSync)(cachePath, JSON.stringify(data, null, 2));
  return data;
};
var FrameImage = class {
  constructor(image, text, comment, textYOffset = 0, faces) {
    this.image = image;
    this.text = text;
    this.comment = comment;
    this.textYOffset = textYOffset;
    this.faces = faces;
    this.renderHeight = 1e3 - 32;
    this.renderWidth = Math.round(
      // Math.max(9 / 16, Math.min(16 / 9, image.width / image.height)) *
      Math.max(1 / 2, Math.min(16 / 9, image.width / image.height)) * this.renderHeight
    );
  }
  renderWidth;
  renderHeight;
  drawAt(ctx, x, y) {
    ctx.save();
    try {
      const scale = Math.min(
        this.renderWidth / this.image.width,
        this.renderHeight / this.image.height
      );
      const drawWidth = Math.round(this.image.width * scale);
      const drawHeight = Math.round(this.image.height * scale);
      const drawX = Math.floor(x + (this.renderWidth - drawWidth) / 2);
      const drawY = Math.floor(y + (this.renderHeight - drawHeight) / 2);
      const barHeight = 32;
      ctx.fillStyle = "#00000044";
      ctx.fillRect(x, y + barHeight, this.renderWidth, this.renderHeight);
      ctx.fillStyle = "#000000";
      ctx.drawImage(this.image, drawX, drawY + barHeight, drawWidth, drawHeight);
      if (this.faces) {
        for (const face of this.faces) {
          const faceWidth = face.faceRectangle.width * scale;
          const faceHeight = face.faceRectangle.height * scale;
          const faceX = face.faceRectangle.left * scale + drawX;
          const faceY = face.faceRectangle.top * scale + drawY + barHeight;
          ctx.fillStyle = "#15202b";
          ctx.fillRect(faceX, faceY, faceWidth, faceHeight);
          ctx.fillStyle = "#0005";
          ctx.fillRect(faceX, faceY, faceWidth, Math.min(faceHeight, 2));
          ctx.fillRect(faceX, faceY, Math.min(faceWidth, 2), faceHeight);
        }
      }
      ctx.fillStyle = "#273340";
      ctx.fillRect(x, y, this.renderWidth, barHeight);
      ctx.font = "36px default";
      ctx.fillStyle = "#8b98a5";
      ctx.fillText(
        this.text,
        drawX + (drawWidth - ctx.measureText(this.text).width) / 2,
        drawY + 24
      );
      if (this.comment) {
        ctx.font = "28px default";
        const lines = wrapWords(ctx, this.comment, drawWidth - 36);
        ctx.save();
        ctx.fillStyle = "#273340";
        ctx.globalAlpha = 0.7;
        const lineHeight = 32;
        const textBgHeight = lines.length * lineHeight + 38;
        const textYOffset = this.textYOffset;
        ctx.fillRect(
          drawX,
          drawY + barHeight + drawHeight - textBgHeight - textYOffset,
          drawWidth,
          textBgHeight
        );
        ctx.restore();
        ctx.fillStyle = "#ffffff";
        for (const [i, line] of lines.entries()) {
          ctx.fillText(
            line,
            drawX + 16,
            drawY + barHeight + drawHeight - 24 - (lines.length - i - 1) * lineHeight - textYOffset
          );
        }
      }
    } finally {
      ctx.restore();
    }
  }
};
function wrapWords(ctx, text, w) {
  const words = Array.from(
    new Intl.Segmenter("th", { granularity: "word" }).segment(
      text.replace(/\s+/g, " ").trim()
    )
  );
  const lines = [];
  for (const { segment: word } of words) {
    if (lines.length === 0 || ctx.measureText(lines[lines.length - 1] + word).width > w) {
      lines.push(word);
    } else {
      lines[lines.length - 1] += word;
    }
  }
  return lines.map((x) => x.trim());
}

// src/_tasks.ts
var import_lazy_strict_env4 = require("lazy-strict-env");
var import_zod4 = require("zod");
var import_child_process = require("child_process");
var forkMode = false;
function enableForkMode() {
  forkMode = true;
}
var stdlibEnv = (0, import_lazy_strict_env4.Env)(
  import_zod4.z.object({
    STDLIB_SECRET_TOKEN: import_zod4.z.string()
  })
);
async function getNextChangelogEntry(mongo, log = console.log) {
  const state = await getStateCollection(mongo).findOne({ _id: "state" }) || {
    _id: "state"
  };
  const nextSince = state.nextSince?.getTime() || 0;
  const since = Math.max(
    Date.now() - 3 * 864e5,
    Date.parse("2023-02-27T17:00:00Z"),
    nextSince
  );
  const today = new Date(Date.now() + 7 * 36e5).toISOString().split("T")[0];
  const until = Date.parse(today + "T00:00:00Z") - 7 * 36e5;
  const endOfDay = until + 864e5;
  const data = await client.getChangelog.query({
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    sort: "asc"
  });
  const timeLeft = Math.max(1, endOfDay - Date.now());
  const timePerTweet = Math.round(timeLeft / Math.max(1, data.total));
  log(
    `Got ${data.total} changelog entries in scope, ${timePerTweet}ms per tweet`
  );
  const lastTweetedAt = state.lastTweetedAt?.getTime() || 0;
  const collection = getTweetTaskCollection(mongo);
  const timeUntilNextTweet = lastTweetedAt + timePerTweet - 32e3 - Date.now();
  if (timeUntilNextTweet > 0) {
    log(`Gonna wait for ${timeUntilNextTweet}ms, so doing nothing for now`);
    return;
  }
  let nextNextSince = nextSince;
  try {
    for (const item of data.results) {
      nextNextSince = Date.parse(item.finished);
      const found = await collection.findOne({ _id: item._id });
      if (found)
        continue;
      return item;
    }
  } finally {
    if (nextNextSince > nextSince) {
      await getStateCollection(mongo).updateOne(
        { _id: "state" },
        { $set: { nextSince: new Date(nextNextSince) } },
        { upsert: true }
      );
    }
  }
}
async function workOnNextTask(mongo, log = console.log) {
  const entry = await getNextChangelogEntry(mongo);
  if (!entry) {
    log("No changelog entry found");
    return;
  }
  await workOnTask(mongo, entry, log);
}
async function workOnTask(mongo, entry, log = console.log) {
  const collection = getTweetTaskCollection(mongo);
  const threadStates = getTwitterThreadCollection(mongo);
  log(`Got changelog entry: ${entry._id} (finished at ${entry?.finished})`);
  const lib = require("lib")({ token: stdlibEnv.STDLIB_SECRET_TOKEN });
  const tweet = await getTweet(entry);
  log("Generated tweet: " + JSON.stringify(tweet));
  const threadState = tweet.threadId ? await threadStates.findOne({ _id: tweet.threadId }) : null;
  try {
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: "pending" } },
      { upsert: true }
    );
    const image = forkMode ? await generateImageWithFork(entry.snapshot) : await generateImage(entry.snapshot);
    log("Generated image, number of bytes: " + image.length);
    const media = await lib.twitter.media["@1.1.0"].upload.simple({
      media: image
    });
    log("Created media: " + JSON.stringify(media));
    const status = await lib.twitter.tweets["@1.1.2"].statuses.create({
      ...tweet.tweet,
      media_ids: media.media_id_string,
      display_coordinates: true,
      ...threadState ? { in_reply_to_status_id: threadState.lastTweetId } : {}
    });
    log("Created status: " + JSON.stringify(status));
    const result = { media, status };
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: "completed", result } },
      { upsert: true }
    );
    if (tweet.threadId) {
      await threadStates.updateOne(
        { _id: tweet.threadId },
        {
          $set: { lastTweetId: status.id_str },
          $setOnInsert: { firstTweetId: status.id_str }
        },
        { upsert: true }
      );
    }
    await getStateCollection(mongo).updateOne(
      { _id: "state" },
      { $set: { lastTweetedAt: /* @__PURE__ */ new Date() } },
      { upsert: true }
    );
    return result;
  } catch (error) {
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: "error", error: String(error) } },
      { upsert: true }
    );
    throw error;
  }
}
var generateImageWithFork = async (snapshot) => {
  const child = (0, import_child_process.fork)(__filename, ["--generate-image"], {
    timeout: 3e4,
    serialization: "advanced"
  });
  return new Promise((resolve2, reject) => {
    child.on("message", (message) => {
      if (message.result) {
        resolve2(message.result);
      } else if (message.error) {
        reject(new Error("Error from child process: " + message.error));
      }
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.send({ snapshot });
  });
};
async function forkGenerateImageWorker() {
  process.on("message", async (message) => {
    if (message.snapshot) {
      try {
        const result = await generateImage(message.snapshot);
        process.send({ result });
      } catch (error) {
        process.send({ error: String(error?.stack || error) });
      }
    }
  });
}

// src/server.ts
enableForkMode();
async function main() {
  if (process.argv.includes("--generate-image")) {
    await forkGenerateImageWorker();
  } else {
    await runServer();
  }
}
async function runServer() {
  const db = await connectToDatabase();
  const server = (0, import_fastify.default)({
    logger: true
  });
  server.get("/", async (request, reply) => {
    return { name: "bkkchangelog-poster" };
  });
  server.post("/work", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/plain"
    });
    workOnNextTask(db, (message) => {
      request.log.info(message);
      reply.raw.write(Buffer.from(message + "\n"));
    }).then(() => {
      reply.raw.end();
    }).catch((err) => {
      reply.raw.write(Buffer.from(String(err?.stack || err) + "\n"));
      reply.raw.end();
    });
  });
  try {
    await server.listen({ port: +process.env.PORT || 34763, host: "0.0.0.0" });
    const address = server.server.address();
    const port = typeof address === "string" ? address : address?.port;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
main();
