<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Users from "@lucide/svelte/icons/users";

  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";

  type SelectionPreset = "all" | "none" | "reset";

  export let selectionMode: SelectionPreset | null = null;
  export let onPreset: (mode: SelectionPreset) => void = () => {};
</script>

<ButtonGroup.Root class="w-full mb-2">
  <Button
    variant={selectionMode === "all" ? "default" : "outline"}
    size="sm"
    class="flex-1"
    onclick={() => onPreset("all")}
    data-testid="people-tab-select-all"
  >
    <Users class="size-3.5 mr-1" /> Vše
  </Button>
  <Button
    variant={selectionMode === "none" ? "default" : "outline"}
    size="sm"
    class="flex-1"
    onclick={() => onPreset("none")}
    data-testid="people-tab-select-none"
  >
    <Ban class="size-3.5 mr-1" /> Žádné
  </Button>
  <Button
    variant="outline"
    size="sm"
    class="flex-1"
    onclick={() => onPreset("reset")}
    data-testid="people-tab-reset"
  >
    <RotateCcw class="size-3.5 mr-1" /> Reset
  </Button>
</ButtonGroup.Root>

<p class="text-xs text-muted-foreground text-center">
  <strong>Vše:</strong> Jen fotky s lidmi. <strong>Žádné:</strong> Jen fotky bez lidí.
  <br /><strong>Reset:</strong> Všechny fotky.
</p>
