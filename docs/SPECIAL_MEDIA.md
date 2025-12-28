# Special Media Support (Sequences & Panoramas)

This project supports special media interaction types directly in the grid and lightbox, identified by filename suffixes.

## Supported Types

| ID Suffix       | Type                   | Description                                                                                    | Interval | Transition |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------- | -------- | ---------- |
| `--zoomXfromY`  | Zoom                   | A sequence of images that crossfade to simulate a zoom-in/out effect. Slow dreamy effect.      | 2000ms   | 1.5s fade  |
| `--panXfromY`   | Pan (Multi-image)      | A sequence that pans across a scene (stitched from multiple photos).                           | 600ms    | 0.5s fade  |
| `--burstXfromY` | Burst                  | A fast sequence of action shots (burst mode).                                                  | 300ms    | 0.5s fade  |
| `--tlXfromY`    | Timelapse              | Series of photos taken at intervals (sunrise, clouds). Fast video-like playback.               | 100ms    | 0.5s fade  |
| `--focusXfromY` | Focus-Stack            | Macro photos with different focus depths. Shows "focus sweep" effect.                          | 500ms    | 0.5s fade  |
| `--pano`        | Panorama (Single-file) | A single wide image displayed with interactive horizontal scrolling. Height-limited to 1280px. | N/A      | Smooth pan |

## File Naming Convention

Files are named using the standard ID format with a specific suffix:

```
YYYY-MM-DD-HHMMSS-author--[type][index]from[total].ext
YYYY-MM-DD-HHMMSS-author--pano.ext
```

Examples:

- `2025-11-25-143000-cebreus--zoom1from3.jpg`, `...--zoom2from3.jpg`, `...--zoom3from3.jpg`
- `2025-11-26-080555-cebreus--pano.heic`

## Architecture

### Single Source of Truth

All sequence detection logic lives in `shared/utils/sequences.ts`:

```
shared/utils/sequences.ts           ← MASTER (regex, parsing, utilities)
shared/constants/sequences.ts       ← Playback config, timing, badge icons
  │
  ├── src/lib/utils/sequences.ts         ← Re-exports for Svelte components
  ├── src/lib/components/SequenceBadge.svelte  ← Reusable badge component
  └── scripts/lib/image/sequence-detector.ts  ← Re-exports + build-specific functions
```

### Detection

- **Build time:** The `sequence-detector.ts` sets `type: "sequence" | "sequence-member" | "panorama"` in manifest via `classifyMediaType()`.
- **Runtime:** `parseSequenceSuffix()` parses the ID to determine behavior.
- **Grid:** Only the "representative" image (last in sequence, e.g., `3from3` or `pano`) is displayed.

### Lightbox Integration

The project uses **Fancybox v5** with custom slide handling in `src/lib/actions/fancybox.ts`:

1. **Slide Creation:** Detects sequence IDs (`--` pattern) and injects a host element.
2. **Component Mount:** Mounts `SequencePlayer.svelte` into the host using Svelte's `mount()` API.
3. **Cleanup:** Unmounts on slide destroy via `unmount()`.

### Sequence Player

The `SequencePlayer.svelte` component handles all playback logic:

- **Auto-play:** Automatically cycles through sequence frames or scrolls panorama.
- **Controls:** Play/Pause button and a scrubber (slider) for manual control.
- **Zoom Mode:** Uses a slow crossfade (1.5s transition) with a 2s interval.
- **Panorama Mode:** Displays the full image height and scrolls horizontally.
  - _Variant:_ Uses `pano_detail` (1080px height) for high resolution.
  - _Auto-scroll:_ Slow speed (3% width/sec).
  - _Start Delay:_ Waits 1s before starting animation on first load.
  - _Interaction:_ User can scrub manually via slider.

## Image Variants

| Variant       | Size         | Usage                                |
| ------------- | ------------ | ------------------------------------ |
| `default`     | 370x208 crop | Grid thumbnail (mobile/desktop)      |
| `xl`          | 534x300 crop | Grid thumbnail (tablet)              |
| `detail`      | 1280 width   | Lightbox full view, sequences        |
| `pano_detail` | 1280 height  | Panorama full view (preserves width) |
| `admin_thumb` | 534x534      | Admin panel thumbnails               |
