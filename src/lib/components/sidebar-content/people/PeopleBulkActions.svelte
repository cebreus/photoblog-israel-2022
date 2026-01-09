<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import FolderOutput from "@lucide/svelte/icons/folder-output";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Users from "@lucide/svelte/icons/users";

  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { PeopleTabModel } from "$lib/logic/people-tab-model.svelte";

  let { model }: { model: PeopleTabModel } = $props();
</script>

<div class="bg-muted/40 border-t p-2">
  <div class="flex flex-col gap-2">
    <div class="text-muted-foreground flex items-center justify-between text-xs">
      <span>Vybráno: {model.selectedForMerge.length}</span>
      <div class="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-xs"
          onclick={() => (model.selectedForMerge = [])}
        >
          Zrušit výběr
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap gap-1">
      <Tooltip.Root>
        <Tooltip.Trigger
          class={buttonVariants({ variant: "outline", size: "icon" }) + " text-destructive h-8 w-8"}
          onclick={() => model.handleBulkHideAction()}
        >
          <EyeOff class="h-4 w-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>Skrýt vybrané</Tooltip.Content>
      </Tooltip.Root>

      {#if model.selectedHiddenCount > 0}
        <Tooltip.Root>
          <Tooltip.Trigger
            class={buttonVariants({ variant: "outline", size: "icon" }) + " h-8 w-8 text-green-600"}
            onclick={() => model.handleBulkRestore()}
          >
            <Eye class="h-4 w-4" />
          </Tooltip.Trigger>
          <Tooltip.Content>Obnovit skryté ({model.selectedHiddenCount})</Tooltip.Content>
        </Tooltip.Root>
      {/if}

      <Separator orientation="vertical" class="mx-1 h-8" />

      <Tooltip.Root>
        <Tooltip.Trigger
          class={buttonVariants({ variant: "outline", size: "icon" }) + " h-8 w-8"}
          onclick={() => model.openMergeDialog()}
          disabled={model.selectedForMerge.length < 2}
        >
          <Users class="h-4 w-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          {#if model.selectedForMerge.length < 2}
            Vyberte alespoň 2 osoby pro sloučení
          {:else}
            Sloučit vybrané
          {/if}
        </Tooltip.Content>
      </Tooltip.Root>

      <Separator orientation="vertical" class="mx-1 h-8" />

      <Tooltip.Root>
        <Tooltip.Trigger
          class={buttonVariants({ variant: "outline", size: "icon" }) + " text-destructive h-8 w-8"}
          onclick={() => model.handleBulkMarkAsJunk()}
        >
          <Trash2 class="h-4 w-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>Ignorovat (Junk)</Tooltip.Content>
      </Tooltip.Root>

      {#if model.selectedJunkCount > 0}
        <Tooltip.Root>
          <Tooltip.Trigger
            class={buttonVariants({ variant: "outline", size: "icon" }) + " h-8 w-8 text-green-600"}
            onclick={() => model.handleBulkRestoreFromJunk()}
          >
            <Undo2 class="h-4 w-4" />
          </Tooltip.Trigger>
          <Tooltip.Content>Obnovit z ignorovaných ({model.selectedJunkCount})</Tooltip.Content>
        </Tooltip.Root>
      {/if}

      <Separator orientation="vertical" class="mx-1 h-8" />

      <Tooltip.Root>
        <Tooltip.Trigger
          class={buttonVariants({ variant: "outline", size: "icon" }) + " h-8 w-8"}
          onclick={() => model.bulkUpdateCategory("statue")}
        >
          <FolderOutput class="h-4 w-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>Nastavit jako Socha</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>
</div>
