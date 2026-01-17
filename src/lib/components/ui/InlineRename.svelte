<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";

  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as m from "$lib/paraglide/messages";
  import { cn } from "$lib/utils";

  let {
    value,
    onSave,
    isSaving = false,
    labelClass = "",
    inputClass = "",
    testId = "inline-rename",
    disabled = false,
    showEditIcon = false,
    canEdit = true,
    isEditing = $bindable(false),
  }: {
    value: string;
    onSave: (newValue: string) => Promise<void> | void;
    isSaving?: boolean;
    labelClass?: string;
    inputClass?: string;
    testId?: string;
    disabled?: boolean;
    showEditIcon?: boolean;
    canEdit?: boolean;
    isEditing?: boolean;
  } = $props();

  let internalValue = $state("");

  // Derived: can this component be interacted with?
  const isEditable = $derived(canEdit && !disabled);

  function startEditing() {
    if (!isEditable) return;
    internalValue = value;
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
  }

  async function handleSave() {
    const trimmed = internalValue.trim();
    if (!trimmed || trimmed === value) {
      cancelEditing();
      return;
    }

    try {
      await onSave(trimmed);
      cancelEditing();
    } catch {
      // Error should be handled by onSave (e.g. showing a toast)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSave();
    } else if (event.key === "Escape") {
      cancelEditing();
    }
  }
</script>

<div class="inline-flex items-center gap-1" data-testid={testId}>
  {#if isEditing}
    <div class="flex items-center gap-1">
      <Input
        bind:value={internalValue}
        onkeydown={handleKeydown}
        class={cn("h-8 py-1 text-sm focus:ring-2 focus:outline-none", inputClass)}
        data-testid="inline-rename-input"
        autofocus
        disabled={isSaving}
      />
      <Button
        size="icon"
        variant="ghost"
        class="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/30"
        onclick={handleSave}
        disabled={isSaving}
        title={m.clap_action_save()}
        data-testid="inline-rename-save-btn"
      >
        <Check class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="text-destructive hover:bg-destructive/10 h-8 w-8"
        onclick={cancelEditing}
        disabled={isSaving}
        title={m.ui_cancel()}
        data-testid="inline-rename-cancel-btn"
      >
        <X class="size-4" />
      </Button>
    </div>
  {:else}
    <Button
      variant="ghost"
      size="sm"
      class={cn(
        "group flex h-auto items-center gap-1 rounded transition-colors hover:bg-transparent",
        isEditable ? "hover:bg-muted cursor-pointer" : "cursor-default",
        "has-[>svg]:px-0",
        labelClass,
      )}
      onclick={startEditing}
      title={isEditable ? m.sidebar_edit() : undefined}
      data-testid="inline-rename-label-btn"
      {disabled}
    >
      <span data-testid="inline-rename-value">{value}</span>
      {#if showEditIcon && isEditable}
        <Pencil
          class="text-muted-foreground/30 group-hover:text-foreground size-3 shrink-0 transition-colors"
        />
      {/if}
    </Button>
  {/if}
</div>
