<script lang="ts">
  

  import type { SequenceInfo } from "$lib/types/manifest";
import { DEFAULT_BADGE_ICON, SEQUENCE_BADGE_ICONS } from "$shared/constants/sequences";

  let { info }: { info: SequenceInfo } = $props();

  const icon = $derived(SEQUENCE_BADGE_ICONS[info.type] ?? DEFAULT_BADGE_ICON);
  const showMultiplier = $derived(info.type === "zoom");
</script>

<div
  class="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
  data-testid="sequence-badge"
>
  <span>{icon}</span>
  <span>{info.total}{showMultiplier ? "×" : ""}</span>
</div>
