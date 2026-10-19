// Global push-to-talk. Electron's globalShortcut has no key-up event, so this uses a low-level
// keyboard hook (uiohook-napi). Hold the combo to record; release to finish. Pressing any other
// key while holding cancels, so shortcuts like Ctrl+Win+D still work normally.
import { EventEmitter } from 'node:events'
import { uIOhook, UiohookKey as K } from 'uiohook-napi'

// Each slot lists keycodes that satisfy it (left or right modifier).
const COMBOS = {
  'ctrl-win': [[K.Ctrl, K.CtrlRight], [K.Meta, K.MetaRight]],
  'right-alt': [[K.AltRight]],
  'right-ctrl': [[K.CtrlRight]],
  'ctrl-shift-space': [[K.Ctrl, K.CtrlRight], [K.Shift, K.ShiftRight], [K.Space]]
}

const TAP_MS = 250 // shorter holds are treated as accidental

export class PushToTalk extends EventEmitter {
  constructor() {
    super()
    this.combo = COMBOS['ctrl-win']
    this.down = new Set()
    this.active = false
    this.startedAt = 0
    this.started = false
    this.paused = false
    uIOhook.on('keydown', (e) => this.onDown(e.keycode))
    uIOhook.on('keyup', (e) => this.onUp(e.keycode))
  }

  start() {
    if (!this.started) uIOhook.start()
    this.started = true
  }

  stop() {
    if (this.started) uIOhook.stop()
    this.started = false
  }

  setCombo(id) {
    this.combo = COMBOS[id] || COMBOS['ctrl-win']
    this.down.clear()
    if (this.active) this.finish(true)
  }

  // While the app types with simulated keys, ignore our own events.
  setPaused(paused) {
    this.paused = paused
  }

  inCombo(code) {
    return this.combo.some((slot) => slot.includes(code))
  }

  comboHeld() {
    return this.combo.every((slot) => slot.some((c) => this.down.has(c)))
  }

  onDown(code) {
    if (this.paused) return
    const repeat = this.down.has(code)
    this.down.add(code)
    if (repeat) return
    if (this.active && !this.inCombo(code)) return this.finish(true) // another key: it's a shortcut
    if (!this.active && this.comboHeld()) {
      this.active = true
      this.startedAt = Date.now()
      this.emit('start')
    }
  }

  onUp(code) {
    this.down.delete(code)
    if (this.paused) return
    if (this.active && this.inCombo(code)) this.finish(Date.now() - this.startedAt < TAP_MS)
  }

  finish(cancel) {
    this.active = false
    this.emit(cancel ? 'cancel' : 'stop')
  }
}
