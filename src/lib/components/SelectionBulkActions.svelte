<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    count,
    onClear,
    isWorking = false,
    actions,
    dropdownItems,
    class: className,
    testId = "bulk-actions",

    // Default PeopleTab actions (optional)
    onMerge,
    onHide,
    onRestore,
    onMarkAsJunk,
    onUpdateCategory,
    hiddenCount = 0,
    canHide = true,
  } = $props<{
    count: number;
    onClear: () => void;
    isWorking?: boolean;
    actions?: Snippet;
    dropdownItems?: Snippet;
    class?: string;
    testId?: string;

    onMerge?: () => void;
    onHide?: () => void;
    onRestore?: () => void;
    onMarkAsJunk?: () => void;
    onUpdateCategory?: (cat: "person" | "statue" | "painting") => void;
    hiddenCount?: number;
    canHide?: boolean;
  }>();
</script>

<ButtonGroup.Root class={className} data-testid={testId}>
  <Button variant="outline" size="sm" disabled class="border-r-0" data-testid="{testId}-count">
    {count}
  </Button>

  <ButtonGroup.Separator />

  {#if actions}
    {@render actions()}
  {:else}
    <!-- Default PeopleTab Actions -->
    <Button
      variant="outline"
      size="sm"
      onclick={onMerge}
      class="flex-1"
      data-testid="{testId}-merge"
      disabled={count < 2 || isWorking}
    >
      <Merge class="w-4 h-4 mr-2" />
      Sloučit
    </Button>

    <Button
      variant="outline"
      size="sm"
      onclick={onHide}
      class="flex-1"
      data-testid="{testId}-hide"
      disabled={!canHide || isWorking}
    >
      <EyeOff class="w-4 h-4 mr-2" />
      Skrýt
    </Button>
  {/if}

  <Button
    variant="outline"
    size="sm"
    onclick={onClear}
    disabled={isWorking}
    data-testid="{testId}-clear"
  >
    Zrušit
  </Button>

  {#if dropdownItems || onRestore || onMarkAsJunk || onUpdateCategory}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class={buttonVariants({
          variant: "outline",
          size: "sm",
        })}
        disabled={isWorking}
        data-testid="{testId}-more-trigger"
      >
        <MoreHorizontal class="w-4 h-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-56">
        {#if dropdownItems}
          {@render dropdownItems()}
        {:else}
          <!-- Default PeopleTab Dropdown Items -->
          {#if onRestore}
            <DropdownMenu.Item
              onclick={onRestore}
              data-testid="{testId}-restore"
              disabled={hiddenCount === 0}
            >
              <Eye class="w-3.5 h-3.5 mr-2" /> Obnovit skryté ({hiddenCount})
            </DropdownMenu.Item>
          {/if}

          {#if onMarkAsJunk}
            <DropdownMenu.Item
              onclick={onMarkAsJunk}
              data-testid="{testId}-junk"
              class="text-destructive focus:text-destructive"
            >
              <UserMinus class="w-3.5 h-3.5 mr-2" /> Není osoba
            </DropdownMenu.Item>
          {/if}

          {#if onUpdateCategory}
            <DropdownMenu.Separator />
            <DropdownMenu.Label>Typ osoby</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onclick={() => onUpdateCategory?.("person")}
              data-testid="{testId}-type-person"
            >
              <User class="w-3.5 h-3.5 mr-2" /> Osoba
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onclick={() => onUpdateCategory?.("statue")}
              data-testid="{testId}-type-statue"
            >
              <Landmark class="w-3.5 h-3.5 mr-2" /> Socha
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onclick={() => onUpdateCategory?.("painting")}
              data-testid="{testId}-type-painting"
            >
              <Palette class="w-3.5 h-3.5 mr-2" /> Malba
            </DropdownMenu.Item>
          {/if}
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</ButtonGroup.Root>
