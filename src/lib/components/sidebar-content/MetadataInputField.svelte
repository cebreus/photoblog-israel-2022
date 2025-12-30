<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";

  let {
    label,
    name,
    value,
    onInput,
    onClear,
    isCleared = false,
    type = "text",
    placeholder = "",
  } = $props<{
    label: string;
    name: string;
    value: string;
    onInput: (value: string) => void;
    onClear: () => void;
    isCleared?: boolean;
    type?: "text" | "textarea";
    placeholder?: string;
  }>();
</script>

<div class="space-y-2">
  <Label>{label}</Label>
  <div class="flex items-start gap-2">
    {#if type === "textarea"}
      <Textarea {name} {value} {placeholder} oninput={(e) => onInput(e.currentTarget.value)} />
    {:else}
      <Input {name} {value} {placeholder} oninput={(e) => onInput(e.currentTarget.value)} />
    {/if}
    <Button
      variant={isCleared ? "destructive" : "ghost"}
      size="icon"
      type="button"
      onclick={onClear}
      aria-label="Smazat hodnotu"
    >
      <Trash2 class="size-4" />
    </Button>
  </div>
</div>
