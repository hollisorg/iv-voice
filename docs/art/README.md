# IV Voice artwork

IV Voice matches IV Studio and IV Chat. IV Studio uses the red liquid "What If?" eye illustration and IV Chat a matching one with chat bubbles; IV Voice's version has a studio microphone with sound waves where the eye was.

## How it was made (2026-10-29)

- The same free local pipeline as IV Chat (see `iv-chat/docs/art/README.md`): ComfyUI on an RTX 4090, Flux.2 Klein 9B, `qwen_3_8b` text encoder, `flux2-vae`, 4 steps, euler, 1536 × 768.
- Style reference: IV Studio's eye art (`iv-chat-style-ref.png` in ComfyUI's input folder), passed in as a reference latent.
- Prompt: `prompt.txt`. Seeds 101, 202 and 303 were rendered; 101 was picked for the largest, clearest centre object. Raw outputs are in ComfyUI's `output\IV-Apps\`.

## Files

- `voice-art-master.png`: the full-resolution pick (seed 101).
- `src/renderer/src/assets/voice-art.webp`: the app copy (WebP, quality 88), used in the page banners and at the bottom of the sidebar.
- `src/renderer/src/assets/voice-mark.png`: the centre object cut out as an oval, the title-bar logo.
## App icon (2026-10-29)

- Matches IV Studio and IV Chat. Same pipeline at 1024 × 1024, with IV Studio's `build/icon.png` as the reference (composited on #100c0e) and `icon-prompt.txt` as the prompt.
- Seeds 11, 22 and 33 were rendered; 11 was picked because its shape reads best at small sizes. Master: `icon-master-seed-11.png`.
- The rounded tile uses IV Studio's icon transparency exactly. The .ico has 32-bit BMP frames from 16 to 128 px and a PNG at 256, which Explorer shows correctly.
