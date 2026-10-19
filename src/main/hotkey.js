// Global push-to-talk. Electron's globalShortcut has no key-up event, so this uses a low-level
// keyboard hook (uiohook-napi).
//
//   Hold the combo        -> record; release to finish.
//   Tap Space while held  -> lock (hands-free); let go and keep talking.
//   Locked: press combo   -> finish.   Esc -> cancel.
//   Any other key while holding cancels, so shortcuts like Ctrl+Win+D still work normally.
import { EventEmitter } from 'node:events'
import { uIOhook, UiohookKey as K } from 'uiohook-napi'

// Each slot lists keycodes that satisfy it (left or right modifier).
const COMBOS = {
  'ctrl-win': [[K.Ctrl, K.CtrlRight], [K.Meta, K.MetaRight]],
  'right-alt': [[K.AltRight]],
  'right-ctrl': [[K.CtrlRight]],
  'ctrl-shift-space': [[K.Ctrl, K.CtrlRight], [K.Shift, K.ShiftRight], [K.Space]]
}

export const TAP_MS = 250 // shorter holds are treated as accidental

export class PushToTalk extends EventEmitter {
  constructor({ hook = true } = {}) {
    super()
    this.combo = COMBOS['ctrl-win']
    this.lockKey = K.Space
    this.down = new Set()
    this.mode = 'idle' // idle | holding | locked
    this.armed = false // locked: true once the combo keys have been released after locking
    this.startedAt = 0
    this.started = false
    this.paused = false
    if (hook) {
      uIOhook.on('keydown', (e) => this.onDown(e.keycode))
      uIOhook.on('keyup', (e) => this.onUp(e.keycode))
    }
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
    // Space is part of one combo; that preset locks with Enter instead.
    this.lockKey = this.inCombo(K.Space) ? K.Enter : K.Space
    this.down.clear()
    if (this.mode !== 'idle') this.finish(true)
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

    if (this.mode === 'idle') {
      if (this.comboHeld()) {
        this.mode = 'holding'
        this.startedAt = Date.now()
        this.emit('start')
      }
    } else if (this.mode === 'holding') {
      if (code === this.lockKey) {
        this.mode = 'locked'
        this.armed = false
        this.emit('lock')
      } else if (!this.inCombo(code)) {
        this.finish(true) // another key: it's a shortcut, not dictation
      }
    } else if (this.mode === 'locked') {
      if (code === K.Escape) this.finish(true)
      else if (this.armed && this.comboHeld()) this.finish(false)
    }
  }

  onUp(code) {
    this.down.delete(code)
    if (this.paused) return
    if (this.mode === 'holding' && this.inCombo(code)) {
      this.finish(Date.now() - this.startedAt < TAP_MS)
    } else if (this.mode === 'locked' && !this.combo.some((slot) => slot.some((c) => this.down.has(c)))) {
      this.armed = true // every combo key is up; the next full press finishes
    }
  }

  // Called by the app (e.g. a time limit) to end recording as if the user finished.
  release() {
    if (this.mode !== 'idle') this.finish(false)
  }

  finish(cancel) {
    this.mode = 'idle'
    this.armed = false
    this.emit(cancel ? 'cancel' : 'stop')
  }
}
