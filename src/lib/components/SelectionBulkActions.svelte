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
  import * as m from "$lib/paraglide/messages";
  import type { Person } from "$lib/types/manifest";

  import { dev } from "$app/environment";

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
    onInvalidateDetections?: () => void;

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
    invalidateDisabled?: boolean;
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
    onInvalidateDetections,

    namedPeople = [],
    hiddenCount = 0,
    junkCount = 0,
    canHide = true,

    mergeDisabled = false,
    hideDisabled = false,
    junkDisabled = false,
    restoreDisabled = false,
    categoryDisabled = false,
    invalidateDisabled = false,
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
  const invalidateBtnDisabled = $derived(
    isGlobalDisabled || invalidateDisabled || !onInvalidateDetections,
  );
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
          <Merge class="mr-2 size-4" />
          {m.ui_merge()}
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{m.ui_merge_tooltip()}</Tooltip.Content>
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
          <EyeOff class="mr-2 size-4" />
          {m.filters_hide_title()}
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{m.ui_hide_tooltip()}</Tooltip.Content>
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
          {m.ui_cancel()}
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{m.ui_cancel_selection_tooltip()}</Tooltip.Content>
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
            aria-label={m.aria_more_actions()}
          >
            <MoreHorizontal class="size-4" />
          </DropdownMenu.Trigger>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>{m.aria_more_actions()}</Tooltip.Content>
    </Tooltip.Root>

    <DropdownMenu.Content align="end" class="w-56">
      <DropdownMenu.Item
        onclick={onMerge}
        data-testid="{testId}-merge-dropdown"
        disabled={mergeBtnDisabled}
      >
        <Merge class="mr-1 size-3.5" />
        {m.ui_merge_selected()}
      </DropdownMenu.Item>

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger data-testid="{testId}-merge-sub" disabled={mergeIntoDisabled}>
          <Merge class="mr-1 size-3.5" />
          {m.ui_merge_into()}
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
                {#if dev && person.detectionsCount && person.detectionsCount > person.faceCount}
                  ({person.detectionsCount} / {person.faceCount})
                {:else}
                  ({person.faceCount})
                {/if}
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
        {m.ui_hide_selected()}
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onclick={onRestore}
        data-testid="{testId}-restore"
        disabled={restoreBtnDisabled}
      >
        <Eye class="mr-1 size-3.5" />
        {m.ui_restore_hidden()}
        {#if hiddenCount > 0}({hiddenCount}){/if}
      </DropdownMenu.Item>

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        onclick={onMarkAsJunk}
        data-testid="{testId}-junk"
        class="text-destructive focus:text-destructive"
        disabled={junkBtnDisabled}
      >
        <UserMinus class="mr-1 size-3.5" />
        {m.ui_move_to_bin()}
      </DropdownMenu.Item>

      <DropdownMenu.Item
        onclick={onRestoreFromJunk}
        data-testid="{testId}-restore-junk"
        disabled={restoreJunkDisabled}
      >
        <Eye class="mr-1 size-3.5" />
        {m.ui_restore_from_bin()}
        {#if junkCount > 0}({junkCount}){/if}
      </DropdownMenu.Item>

      <DropdownMenu.Separator />

      <DropdownMenu.Item
        onclick={onInvalidateDetections}
        data-testid="{testId}-invalidate"
        class="text-destructive focus:text-destructive"
        disabled={invalidateBtnDisabled}
      >
        <UserMinus class="mr-1 size-3.5" />
        {m.ui_not_a_face_ignore()}
      </DropdownMenu.Item>

      <DropdownMenu.Separator />
      <DropdownMenu.Label>{m.ui_person_category()}</DropdownMenu.Label>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("person")}
        data-testid="{testId}-type-person"
        disabled={categoryBtnDisabled}
      >
        <User class="mr-1 size-3.5" />
        {m.ui_set_type_person()}
      </DropdownMenu.Item>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("statue")}
        data-testid="{testId}-type-statue"
        disabled={categoryBtnDisabled}
      >
        <Landmark class="mr-1 size-3.5" />
        {m.ui_set_type_statue()}
      </DropdownMenu.Item>
      <DropdownMenu.Item
        onclick={() => onUpdateCategory?.("painting")}
        data-testid="{testId}-type-painting"
        disabled={categoryBtnDisabled}
      >
        <Palette class="mr-1 size-3.5" />
        {m.ui_set_type_painting()}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</ButtonGroup.Root>
