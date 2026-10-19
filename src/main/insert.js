// Types text into whatever app has focus: put it on the clipboard, press Ctrl+V,
// then put the user's previous clipboard back.
import { clipboard, nativeImage } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function snapshotClipboard() {
  const formats = clipboard.availableFormats()
  const snap = { text: clipboard.readText(), html: null, rtf: null, image: null }
  if (formats.includes('text/html')) snap.html = clipboard.readHTML()
  if (formats.includes('text/rtf')) snap.rtf = clipboard.readRTF()
  if (formats.some((f) => f.startsWith('image/'))) {
    const img = clipboard.readImage()
    if (!img.isEmpty()) snap.image = img.toPNG()
  }
  return snap
}

function restoreClipboard(snap) {
  const data = {}
  if (snap.text) data.text = snap.text
  if (snap.html) data.html = snap.html
  if (snap.rtf) data.rtf = snap.rtf
  if (snap.image) data.image = nativeImage.createFromBuffer(snap.image)
  if (Object.keys(data).length) clipboard.write(data)
  else clipboard.clear()
}

export async function insertText(text, { restore = true } = {}) {
  const snap = restore ? snapshotClipboard() : null
  clipboard.writeText(text)
  await wait(30)
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])
  if (!snap) return
  // Give the target app time to read the clipboard before restoring it, and don't overwrite
  // anything the user copied in the meantime.
  await wait(450)
  if (clipboard.readText() === text) restoreClipboard(snap)
}
