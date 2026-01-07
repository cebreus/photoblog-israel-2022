<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Landmark from "@lucide/svelte/icons/landmark";
  import Merge from "@lucide/svelte/icons/merge";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import Palette from "@lucide/svelte/icons/palette";
  import User from "@lucide/svelte/icons/user";
  import UserMinus from "@lucide/svelte/icons/user-minus";
  import { mergeProps } from "bits-ui";

  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { Person } from "$lib/types/manifest";

  interface Props {
    count: number;
    onClear: () => void;
    isWorking?: boolean;
    disabled?: boolean;
    class?: string;
    testId?: string;

    // Actions
    onMerge?: () => void;
    onMergeInto?: (targetPersonId: string) => void;
    onHide?: () => void;
    onRestore?: () => void;
    onMarkAsJunk?: () => void;
    onRestoreFromJunk?: () => void;
    onUpdateCategory?: (cat: "person" | "statue" | "painting") => void;

    // State/Metadata
    namedPeople?: Person[];
    hiddenCount?: number;
    junkCount?: number;
    canHide?: boolean;

    // Explicit disable overrides
    mergeDisabled?: boolean;
    hideDisabled?: boolean;
    junkDisabled?: boolean;
    restoreDisabled?: boolean;
    categoryDisabled?: boolean;
  }

  let {
    count,
    onClear,
    isWorking = false,
    disabled = false,
    class: className,
    testId = "bulk-actions",

    onMerge,
    onMergeInto,
    onHide,
    onRestore,
    onMarkAsJunk,
    onRestoreFromJunk,
    onUpdateCategory,

    namedPeople = [],
    hiddenCount = 0,
    junkCount = 0,
    canHide = true,

    mergeDisabled = false,
    hideDisabled = false,
    junkDisabled = false,
    restoreDisabled = false,
    categoryDisabled = false,
  }: Props = $props();

  const isGlobalDisabled = $derived(disabled || count === 0 || isWorking);

  // Derived disable states for specific actions
  const mergeBtnDisabled = $derived(isGlobalDisabled || mergeDisabled || !onMerge || count < 2);
  const hideBtnDisabled = $derived(isGlobalDisabled || hideDisabled || !onHide || !canHide);
  const restoreBtnDisabled = $derived(
    isGlobalDisabled || restoreDisabled || !onRestore || hiddenCount === 0,
  );
  const junkBtnDisabled = $derived(isGlobalDisabled || junkDisabled || !onMarkAsJunk);
  const restoreJunkDisabled = $derived(
    isGlobalDisabled || restoreDisabled || !onRestoreFromJunk || junkCount === 0,
  );
  const mergeIntoDisabled = $derived(
    isGlobalDisabled || mergeDisabled || !onMergeInto || namedPeople.length === 0,
  );
  const categoryBtnDisabled = $derived(isGlobalDisabled || categoryDisabled || !onUpdateCategory);
</script>

<ButtonGroup.Root class={className} data-testid={testId}>
  <Button
    variant="outline"
    size="sm"
    disabled
    class="border-r-0 font-medium"
    data-testid="{testId}-count"
  >
    {count}
  </Button>

  <ButtonGroup.Separator />

  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...mergeProps(props)}
          variant="outline"
          size="sm"
          onclick={onMerge}
          class="flex-1"
          data-testid="{testId}-merge"
          disabled={mergeBtnDisabled}
        >
          <Merge class="mr-2 h-4 w-4" />
          Sloučit
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Sloučit vybrané osoby do jedné</Tooltip.Content>
  </Tooltip.Root>

  <!-- Primary Hide Action -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...mergeProps(props)}
          variant="outline"
          size="sm"
          onclick={onHide}
          class="flex-1"
          data-testid="{testId}-hide"
          disabled={hideBtnDisabled}
        >
          <EyeOff class="mr-2 h-4 w-4" />
          Skrýt
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Skrýt vybrané osoby z hlavního přehledu</Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...mergeProps(props)}
          variant="outline"
          size="sm"
          onclick={onClear}
          disabled={isGlobalDisabled}
          data-testid="{testId}-clear"
        >
          Zrušit
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Zrušit výběr</Tooltip.Content>
  </Tooltip.Root>

  <DropdownMenu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <DropdownMenu.Trigger
            {...mergeProps(props)}
            class={buttonVariants({
              variant: "outline",
              size: "sm",
            })}
            disabled={isGlobalDisabled}
            data-testid="{testId}-more-trigger"
            aria-label="Další akce"
          >
            <MoreHorizontal class="size-4" />
          </DropdownMenu.Trigger>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Další akce</Tooltip.Content>
    </Tooltip.Root>

    <DropdownMenu.Content align="end" class="w-56">
      <DropdownMenu.Item
        onclick={onMerge}
        data-testid="{testId}-merge-dropdown"
        disabled={mergeBtnDisabled}
      >
        <Merge class="mr-1 size-3.5" />
        Sloučit vybrané
      </DropdownMenu.Item>

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger data-testid="{testId}-merge-sub" disabled={mergeIntoDisabled}>
          <Merge class="mr-1 size-3.5" /> Sloučit do...
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {#each namedPeople as person (person.id)}
            <DropdownMenu.Item
              onclick={() => onMergeInto?.(person.id)}
              data-testid="{testId}-merge-into-{person.id}"
            >
              <User class="mr-1 size-3.5" />
              {person.name}
              <span class="text-muted-foreground ml-auto font-mono text-xs">
                ({person.faceCount})
              </span>
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        onclick={onHide}
        data-testid="{testId}-hide-dropdown"
        disabled={hideBtnDisabled}
      >
        <EyeOff class="mr-1 size-3.5" />
        Skrýt vybrané
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onclick={onRestore}
        data-testid="{testId}-restore"
        disabled={restoreBtnDisabled}
      >
        <Eye class="mr-1 size-3.5" />
        Obnovit skryté {#if hiddenCount > 0}({hiddenCount}){/if}
      </DropdownMenu.Item>

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        onclick={onMarkAsJunk}
        data-testid="{testId}-junk"
        class="text-destructive focus:text-destructive"
        disabled={junkBtnDisabled}
      >
        <UserMinus class="mr-1 size-3.5" />
        Přesunout do koše
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onclick={onRestoreFromJunk}
        data-testid="{testId}-restore-junk"
        disabled={restoreJunkDisabled}
      >
        <Eye class="mr-1 size-3.5" />
        Obnovit z koše {#if junkCount > 0}({junkCount}){/if}
      </DropdownMenu.Item>

      <DropdownMenu.Separator />
      <DropdownMenu.Label>Kategorie osob</DropdownMenu.Label>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("person")}
        data-testid="{testId}-type-person"
        disabled={categoryBtnDisabled}
      >
        <User class="mr-1 size-3.5" />
        Nastavit: Osoba
      </DropdownMenu.Item>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("statue")}
        data-testid="{testId}-type-statue"
        disabled={categoryBtnDisabled}
      >
        <Landmark class="mr-1 size-3.5" />
        Nastavit: Socha
      </DropdownMenu.Item>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("painting")}
        data-testid="{testId}-type-painting"
        disabled={categoryBtnDisabled}
      >
        <Palette class="mr-1 size-3.5" />
        Nastavit: Malba
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</ButtonGroup.Root>
