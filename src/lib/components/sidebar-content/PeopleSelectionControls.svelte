<script lang="ts">
  import { Switch } from "$lib/components/ui/switch";

  type SelectionPreset = "all" | "unknown" | "reset";

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
  <label
    class={`flex cursor-pointer items-center justify-between text-sm ${
      selectionMode === "all" ? "text-primary" : "text-muted-foreground"
    }`}
    data-testid="people-tab-select-all-control"
  >
    <span>Pouze fotky s lidmi</span>
    <Switch
      checked={selectionMode === "all"}
      onCheckedChange={handleAllToggle}
      data-testid="people-tab-select-all-switch"
    />
  </label>

  <label
    class={`flex cursor-pointer items-center justify-between text-sm ${
      selectionMode === "unknown" ? "text-primary" : "text-muted-foreground"
    }`}
    data-testid="people-tab-select-unknown-control"
  >
    <span>Pouze fotky bez lidí</span>
    <Switch
      checked={selectionMode === "unknown"}
      onCheckedChange={handleUnknownToggle}
      data-testid="people-tab-select-unknown-switch"
    />
  </label>
</div>
