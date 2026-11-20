# Concat Video Editing Integration

## Status

Concat 0.2.11 is installed on the JARVIS Mac at `/Applications/Concat.app`. Its built-in headless MCP server is enabled in the active Hermes profile as `concat`, with file access limited to:

- `/Users/Moatazi/Documents/ChatGPT`
- `/Users/Moatazi/Documents/Codex`

The upstream `run-concat` development skill and the JARVIS `concat-video-editing` operating skill are installed under `/Users/Moatazi/.hermes/skills`.

## Runtime Contract

Command:

```text
/Applications/Concat.app/Contents/MacOS/concat --mcp headless
```

Hermes discovers 46 tools covering projects, media inspection and import, cuts and trims, timeline sequencing, titles, timed captions, keyframes, effects, preview frames and H.264/HEVC/AV1 export.

Concat runs locally. The current integration creates and exports files on the Mac and does not require a cloud editing account.

## JARVIS Workflow

For a video request, JARVIS should:

1. Resolve the venture, approved assets, script, aspect ratio, destination and approval state.
2. Create an isolated Concat project in the venture workspace.
3. Probe and import source media.
4. Build the cut from the approved storyboard or script.
5. Add titles and timed captions.
6. Save the project, render a review frame and inspect it.
7. Export the MP4, wait for completion and verify it with `ffprobe`.
8. Return editable project and output paths, plus evidence of the final render.

Auto-transcription is not exposed by the Concat 0.2.11 MCP interface. When no approved script exists, JARVIS must run a separate speech-to-text step, review the transcript, and then provide timed captions to `captions_add`.

## Installation Evidence

- Release: `v0.2.11`
- macOS asset: `Concat-0.2.11-macos-arm64.dmg`
- Release digest: `sha256:2831aa93b228e7c88deae80758f3e9de5a48d35cdd85dcef3d89426d6331fc4b`
- Installed executable: `/Applications/Concat.app/Contents/MacOS/concat`
- Executable version: `concat 0.2.11`
- MCP discovery: connected in 622 ms with 46 tools
- Active profile: `/Users/Moatazi/.hermes/profiles/new/config.yaml`

## End-to-End Smoke

The smoke project at `/Users/Moatazi/Documents/ChatGPT/Jarvis/.concat-smoke-20261115/jarvis-concat-smoke` imported the approved HotelsVendors vertical reel, trimmed it to three seconds, added two captions, saved the project, rendered a review frame and exported:

- `smoke-preview.png`: 540x960 review frame
- `smoke-export.mp4`: 1080x1920, 30 fps, H.264 video, AAC audio, 3.00 seconds

The preview visibly contains both the source footage and the added captions. The exported file completed with 90 of 90 frames rendered and entered the done state.

## Operating Boundary

Concat may edit footage inside the configured roots. JARVIS must still preserve source media, verify the final media file and obtain campaign approval before publishing externally. The editor does not grant social publishing or advertising authority.
