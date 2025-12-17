<script>
  import { createEventDispatcher } from "svelte";
  export let checked = false;
  export let onCheckedChange = null;
  const dispatch = createEventDispatcher();

  function handleClick() {
    const next = !checked;
    if (typeof onCheckedChange === "function") onCheckedChange(next);
    // Emit event so bind:checked updates in parent
    dispatch("checked", next);
  }
</script>

<button on:click={handleClick} data-testid={$$props["data-testid"]}>
  <slot />
</button>
