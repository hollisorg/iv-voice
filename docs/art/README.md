# IV Voice artwork

IV Voice matches IV Studio and IV Chat. IV Studio uses the red liquid "What If?" eye illustration and IV Chat a matching one with chat bubbles; IV Voice's version has a studio microphone with sound waves where the eye was.

## How it was made (2026-10-29)

- The same free local pipeline as IV Chat (see `iv-chat/docs/art/README.md`): ComfyUI on Matthew's RTX 4090, Flux.2 Klein 9B, `qwen_3_8b` text encoder, `flux2-vae`, 4 steps, euler, 1536 × 768.
- Style reference: IV Studio's eye art (`iv-chat-style-ref.png` in ComfyUI's input folder), passed in as a reference latent.
- Prompt: `prompt.txt`. Seeds 101, 202 and 303 were rendered; 101 was picked for the largest, clearest centre object. Raw outputs are in `F:\ComfyUI\ComfyUI\output\IV-Apps\`.

## Files

- `voice-art-master.png`: the full-resolution pick (seed 101).
- `src/renderer/src/assets/voice-art.webp`: the app copy (WebP, quality 88), used in the page banners and at the bottom of the sidebar.
- `src/renderer/src/assets/voice-mark.png`: the centre object cut out as an oval, the title-bar logo.