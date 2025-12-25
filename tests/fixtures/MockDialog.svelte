<script>
  let { open = $bindable() } = $props();
</script>

{#if open}
  <div data-testid="mock-dialog">
    Mock Dialog
    <button onclick={() => (open = false)}>Close</button>
  </div>
{/if}
