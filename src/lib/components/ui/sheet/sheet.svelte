<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let open = false;
  const dispatch = createEventDispatcher();
  function close() {
    open = false;
    dispatch("close");
  }
  function onOverlayKey(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }
</script>

<div class="fixed inset-0 z-50" aria-hidden={!open} style:display={open ? "block" : "none"}>
  <div
    class="fixed inset-0 bg-black/50"
    role="button"
    tabindex="0"
    on:click={close}
    on:keydown={onOverlayKey}
  ></div>
  <aside
    class="bg-background text-foreground fixed top-0 right-0 h-full w-80 overflow-auto p-4 shadow-xl"
  >
    <slot />
  </aside>
</div>
