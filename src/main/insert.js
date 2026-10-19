// Types text into whatever app has focus: put it on the clipboard, press Ctrl+V,
// then put the user's previous clipboard back.
// Electron 44's clipboard is async and W3C-style (ClipboardItem / read / write).
import { clipboard, ClipboardItem } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Copy out every format the clipboard currently holds so it can be written back unchanged.
export async function snapshotClipboard() {
  try {
    const items = await clipboard.read()
    const saved = []
    for (const item of items) {
      const record = {}
      for (const type of item.types) {
        try {
          record[type] = await item.getType(type)
        } catch {
          /* format vanished or unreadable; skip it */
        }
      }
      if (Object.keys(record).length) saved.push(record)
    }
    return saved
  } catch {
    return null // couldn't read; leave the clipboard holding the dictation
  }
}

export async function restoreClipboard(saved) {
  if (saved.length === 0) return clipboard.clear()
  await clipboard.write(saved.map((record) => new ClipboardItem(record)))
}

export async function insertText(text, { restore = true } = {}) {
  const saved = restore ? await snapshotClipboard() : null
  await clipboard.writeText(text)
  await wait(30)
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])
  if (!saved) return
  // Give the target app time to read the clipboard before restoring it, and don't overwrite
  // anything the user copied in the meantime.
  await wait(450)
  if ((await clipboard.readText()) === text) await restoreClipboard(saved)
}
