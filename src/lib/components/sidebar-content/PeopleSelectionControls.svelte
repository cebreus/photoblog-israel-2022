<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";

  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";

  type SelectionPreset = "all" | "unknown" | "reset" | "none";

  export let selectionMode: SelectionPreset | null = null;
  export let onPreset: (mode: SelectionPreset) => void = () => {};

  function handleAllToggle(checked: boolean) {
    onPreset(checked ? "all" : "reset");
  }

  function handleUnknownToggle(checked: boolean) {
    onPreset(checked ? "unknown" : "reset");
  }
</script>

<div class="flex flex-col gap-3 pb-2">
  <!-- Visible People Controls -->
  <div class="flex flex-col gap-2">
    <span class="text-xs font-semibold tracking-wider text-slate-500 uppercase"
      >Viditelné osoby</span
    >
    <div class="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        class="flex-1 gap-2"
        onclick={() => onPreset("all")}
        data-testid="people-tab-select-all-btn"
      >
        <Check class="h-3.5 w-3.5" />
        Zobrazit vše
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="flex-1 gap-2"
        onclick={() => onPreset("none")}
        data-testid="people-tab-select-none-btn"
      >
        <X class="h-3.5 w-3.5" />
        Skrýt vše
      </Button>
    </div>
  </div>

  <!-- Special Modes -->
  <div class="border-border/50 flex flex-col gap-2 border-t pt-2">
    <label
      class={`flex cursor-pointer items-center justify-between text-sm ${
        selectionMode === "unknown" ? "text-primary font-medium" : "text-slate-500"
      }`}
      data-testid="people-tab-select-unknown-control"
    >
      <span>Pouze fotky cizích lidí</span>
      <Switch
        checked={selectionMode === "unknown"}
        onCheckedChange={handleUnknownToggle}
        data-testid="people-tab-select-unknown-switch"
      />
    </label>
  </div>
</div>
