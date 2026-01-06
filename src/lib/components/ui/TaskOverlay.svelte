<script lang="ts">
  import { Spinner } from "$lib/components/ui/spinner";
  import { system } from "$lib/stores/system.svelte";

  let { class: className = "" }: { class?: string } = $props();

  const isActive = $derived(system.activeTask !== null);
  const label = $derived(system.activeTask?.label || "");
</script>

{#if isActive}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm {className}"
    data-testid="task-overlay"
  >
    <div
      class="bg-card text-card-foreground flex flex-col items-center gap-4 rounded-lg border p-8 shadow-lg"
    >
      <Spinner class="h-12 w-12" />
      <div class="text-center">
        <p class="text-lg font-semibold">{label}</p>
        <p class="text-muted-foreground text-sm">Prosím čekejte...</p>
      </div>
    </div>
  </div>
{/if}
