<script lang="ts">
import { setContext } from "svelte";
import { writable } from "svelte/store";
import type { Snippet } from "svelte";
import { OFFCANVAS_CONTEXT_KEY, type OffcanvasContext } from "./offcanvas-context";

let {
  children,
  open = $bindable(false),
}: {
  children: Snippet;
  open?: boolean;
} = $props();

const openStore = writable(open);

function toggleOpen() {
  open = !open;
  openStore.set(open);
}

setContext<OffcanvasContext>(OFFCANVAS_CONTEXT_KEY, {
  openStore,
  toggleOpen,
});

// Update store when prop changes
$effect(() => {
  openStore.set(open);
});
</script>

{@render children?.()}
