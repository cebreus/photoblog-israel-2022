<script lang="ts">
import { cn } from "$lib/utils";
import { Loader2 } from "lucide-svelte";
import type { ComponentProps } from "svelte";

interface Props {
  class?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  [key: string]: any;
}

let { class: className, ...restProps }: Props = $props();
</script>

<Loader2
  role="status"
  aria-label="Načítání"
  class={cn("size-4 animate-spin", className)}
  {...restProps}
/>
