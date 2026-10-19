# Changelog

## 0.1.0 (unreleased)

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
