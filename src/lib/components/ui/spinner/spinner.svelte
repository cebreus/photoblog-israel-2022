<script lang="ts">
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import type { ComponentProps } from "svelte";

  import * as m from "$lib/paraglide/messages";
  import { cn } from "$lib/utils";

  let { class: className, ...restProps }: ComponentProps<typeof Loader2Icon> = $props();
</script>

<Loader2Icon
  role="status"
  aria-label={m.aria_loading()}
  class={cn("size-4 animate-spin", className)}
  {...restProps}
/>
