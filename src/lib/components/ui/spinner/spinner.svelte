<script lang="ts">
  import Loader2 from "lucide-svelte/icons/loader-2";

  import { cn } from "$lib/utils";

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
