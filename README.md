# IV Voice

Infinite Variance voice dictation for Windows. Hold a shortcut, speak, let go, and clean text
appears wherever you're typing: email, Slack, docs, prompts, code comments.

Speech recognition runs **locally on your GPU** with [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
and OpenAI's Whisper large-v3 turbo model, so your voice never leaves the PC. PCs without a capable
GPU can use the CPU build, or bring their own Groq or OpenAI API key.

## Run it

```bash
npm install
npm run dev
```

Run these from your own terminal. Apps started from the Claude desktop app's shell have their
AppData redirected into Claude's package folder.

On first launch, Home offers a one-click setup:

| PC | Downloads | Total |
|---|---|---|
| NVIDIA GPU | whisper.cpp CUDA 12 build + Turbo model | ~1.3 GB |
| No NVIDIA GPU | whisper.cpp CPU build + Small model | ~200 MB |

Every file is verified before it's used. The engine is checked against GitHub's published SHA-256
digest and the model against Hugging Face's LFS SHA-256. They're stored in
`%APPDATA%\IV Voice\engine` and `\models`.

## How it works

1. **Shortcut** (`src/main/hotkey.js`): a low-level keyboard hook (uiohook-napi), because
   Electron's global shortcuts have no key-up event. Holding the combo records and releasing it
   finishes. Tap Space while holding to lock into hands-free mode, then press the combo again to
   finish (Esc cancels). Pressing any other key while holding cancels, so shortcuts like Ctrl+Win+D
   still work.
2. **Microphone** (`src/renderer/src/recorder.js`, inside the floating pill window): 16 kHz mono
   capture, live waveform, encoded as WAV. Near-silent or very short clips are dropped, because
   Whisper invents text from silence.
3. **Speech to text**:
   - **Local** (`src/main/whisper.js`): whisper.cpp's `whisper-server` on localhost with the model
     kept loaded. On an RTX 4090 the first clip took 2.7 s (model load) and later clips about 0.1 s.
     It stops after an idle period you choose, to free GPU memory for ComfyUI and other tools.
   - **Cloud** (`src/main/cloud.js`): any OpenAI-compatible `/audio/transcriptions` endpoint. The
     key is encrypted with Windows DPAPI (Electron `safeStorage`) and never reaches the UI.
   - **Dictionary words** are passed to Whisper as hints, so names and jargon come out spelled right.
4. **Cleanup** (`src/main/cleanup.js`): removes filler words and silence artefacts, turns "new line"
   and "new paragraph" into breaks, and applies your replacements ("my website" → infinitevariance.ai).
5. **Typing** (`src/main/insert.js`): saves your clipboard, pastes with a simulated Ctrl+V, then
   puts your clipboard back.

The pill window can't take focus, so the text lands in the app you were using. Windows run
sandboxed with context isolation. The only permissions granted are the microphone and clipboard writes.

History, dictionary and settings are JSON files in `%APPDATA%\IV Voice`. Audio is never saved.

## Control it from other apps

IV Voice listens on a local named pipe, `\\.\pipe\iv-voice-<your Windows username>`. Send one JSON
object per line:

```
{"cmd":"toggle"}     start hands-free dictation, or finish the current one
{"cmd":"start"} {"cmd":"stop"} {"cmd":"cancel"}
{"cmd":"paste-last"} type the most recent dictation again
{"cmd":"status"}     -> {"ok":true,"state":"idle|recording|working","locked":false}
{"cmd":"subscribe"}  keep the connection open; a status line arrives on every change
```

Code is in `src/main/control.js`. Baby Mode Control's on-screen keyboard uses it for its Voice button.

## Build the installer

```bash
npm run dist
```

This writes `dist\IV-Voice-Setup.exe`, a per-user NSIS installer. Releases, code signing and
auto-updates work the same way as IV Downloader; see `docs/RELEASING.md` and `docs/CODE-SIGNING.md`.

## Known limits (v0.1)

- With Instant start turned off, the first ~0.1–0.2 s after pressing is lost while the microphone
  opens.
- Apps running as administrator don't accept simulated input from a normal app, so pasting into
  them fails. Windows blocks this on purpose.
- Windows only for now.

## Licence

MIT (see `LICENSE`). Third-party components are listed in `THIRD_PARTY_NOTICES.txt`.
libuiohook, inside the keyboard-hook module, is LGPL-3.0 and ships as a separate, replaceable file.
