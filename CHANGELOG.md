# Changelog

## 0.2.0 (2026-10-19, unsigned test release)

- Instant start: the microphone stays ready with a 0.3 s rolling buffer, so recording begins the
  moment you press the shortcut and your first word isn't clipped. It pauses while the PC is locked
  or asleep, and you can turn it off in Settings.
- Hands-free mode: tap Space while holding the shortcut to lock recording, let go and keep talking,
  then press the shortcut again to finish (Esc cancels). With Ctrl + Shift + Space, lock with Enter.
- The pill shows a lock and how to finish while hands-free; a distinct sound plays when it locks.
- Recordings stop automatically after 10 minutes.
- Dictionary hints keep whole words, newest first, within Whisper's prompt limit (helps big
  imported dictionaries).

## 0.1.1 (2026-10-19, unsigned test release)

- Fixed: dictation failed to paste with "clipboard.availableFormats is not a function". The paste now
  uses Electron 44's async clipboard and restores every clipboard format afterwards.

## 0.1.0 (2026-10-19, unsigned test release)

First version of IV Voice, Infinite Variance voice dictation.

- Hold Ctrl + Win (or Right Alt, Right Ctrl, Ctrl + Shift + Space), speak, let go: text is typed
  into the app you're using.
- Local speech recognition with whisper.cpp on NVIDIA GPUs (CUDA) or the CPU, using the Whisper
  Turbo, Small or Base model; guided one-click setup with verified downloads.
- Optional cloud transcription with your own Groq, OpenAI or other OpenAI-compatible API key.
- Personal dictionary: vocabulary hints and spoken replacements.
- Cleanup: removes filler words; "new line" and "new paragraph" commands; your clipboard is restored.
- Floating pill with a live waveform while you talk.
- History of your dictations, kept only on your PC.
- Runs in the tray; can start with Windows; updates itself from GitHub Releases.
