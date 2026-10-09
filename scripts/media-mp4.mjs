// Re-encodes the finished product video (WebM from scripts/media-compose.py) to MP4 (H.264) and
// saves poster frames, using the installed Google Chrome's own encoder: the ffmpeg that Playwright
// installs writes VP8 only. Real time, so about as long as the video. Local only.
//
//   node scripts/media-mp4.mjs [source.webm] [output folder] [bits per second] [file name]
//
// A lower bitrate (3000000) and a name ending in -web give the page-weight copy for the landing page.
import { mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

const HERE = resolve('e2e/.out/mp4');
const SOURCE = resolve(process.argv[2] ?? 'drafts/media/video/senuma-28s-silent.webm');
const OUT = resolve(process.argv[3] ?? 'drafts/media/video');
const BITRATE = Number(process.argv[4] ?? 8_000_000);
const NAME = process.argv[5] ?? 'senuma-28s-silent.mp4';
mkdirSync(HERE, { recursive: true });
mkdirSync(OUT, { recursive: true });
copyFileSync(SOURCE, join(HERE, 'source.webm'));
writeFileSync(join(HERE, 'page.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><video id="v" src="source.webm" muted playsinline style="width:1280px"></video>');

// A local-only server: pages opened from file:// cannot read video frames back.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const TYPES = { html: 'text/html', webm: 'video/webm', mp4: 'video/mp4' };
const server = createServer((request, response) => {
    const name = decodeURIComponent(request.url.split('?')[0].slice(1));
    const file = [join(HERE, name), join(OUT, name)].find(existsSync);
    if (!file || name.includes('..')) { response.writeHead(404); return response.end(); }
    const data = readFileSync(file);
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? '');
    const type = TYPES[name.split('.').pop()] ?? 'application/octet-stream';
    if (range) {
        const start = Number(range[1]); const end = range[2] ? Number(range[2]) : data.length - 1;
        response.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        return response.end(data.subarray(start, end + 1));
    }
    response.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
    response.end(data);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1320,820'] });
const page = await browser.newPage();
await page.goto(BASE + 'page.html');
await page.waitForFunction(() => document.getElementById('v').readyState >= 2);
const support = await page.evaluate(() => ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'].map(type => [type, MediaRecorder.isTypeSupported(type)]));
console.log('MediaRecorder support:', JSON.stringify(support));
const type = support.find(([, ok]) => ok)?.[0];
if (!type) {
    console.log('NO MP4 ENCODER in this browser');
    await browser.close();
server.close();
    process.exit(2);
}

// Poster frames first (exact frames, PNG).
for (const [name, time] of [['poster-home', 2.2], ['poster-customize', 20.5], ['poster-endcard', 27.6]]) {
    const png = await page.evaluate(async t => {
        const v = document.getElementById('v');
        await new Promise(done => { v.onseeked = done; v.currentTime = t; });
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
    }, time);
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(png, 'base64'));
    console.log(name, statSync(join(OUT, `${name}.png`)).size);
}

const base64 = await page.evaluate(async ([mime, bitrate]) => {
    const v = document.getElementById('v');
    await new Promise(done => { v.onseeked = done; v.currentTime = 0; });
    const stream = v.captureStream();
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    recorder.ondataavailable = event => event.data.size && chunks.push(event.data);
    const stopped = new Promise(done => { recorder.onstop = done; });
    v.onended = () => recorder.stop();
    recorder.start();
    await v.play();
    await stopped;
    const blob = new Blob(chunks, { type: 'video/mp4' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
}, [type, BITRATE]);
writeFileSync(join(OUT, NAME), Buffer.from(base64, 'base64'));
console.log('mp4 bytes', statSync(join(OUT, NAME)).size, 'with', type, 'at', BITRATE);

// Read it back: duration, size, and that it plays.
writeFileSync(join(HERE, 'check.html'), '<!doctype html><video id="v" muted></video>');
const check = await browser.newPage();
await check.goto(BASE + 'check.html');
const meta = await check.evaluate(async url => {
    const v = document.getElementById('v');
    v.src = url;
    await new Promise((done, fail) => { v.onloadedmetadata = done; v.onerror = () => fail(new Error('cannot play')); });
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e9; await new Promise(done => { v.onseeked = done; }); }
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
}, BASE + NAME);
console.log('mp4 read back:', JSON.stringify(meta));
await browser.close();
server.close();
