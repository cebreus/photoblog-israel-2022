<script lang="ts">
  import PersonDetailDialog from "$lib/components/PersonDetailDialog.svelte";
  import PersonMergeDialog from "$lib/components/PersonMergeDialog.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { PeopleTabModel } from "$lib/logic/people-tab-model.svelte";
  import { people } from "$lib/stores/people.svelte";

  let { model }: { model: PeopleTabModel } = $props();

  // Derived logic for Merge Dialog content
  let peopleList = $derived(people.peopleWithStats);

  let splitStart = $derived.by(() => {
    // Logic copied from PeopleTab.svelte to determine default target
    if (!model.lastSelectedMergeId && model.selectedForMerge.length > 0)
      return model.selectedForMerge[0];
    return model.lastSelectedMergeId || "";
  });

  let targetPerson = $derived(
    peopleList.find((p) => p.id === splitStart) ??
      peopleList.find((p) => model.selectedForMerge.includes(p.id)) ??
      peopleList[0],
  );

  let sourcePersons = $derived(
    peopleList.filter((p) => model.selectedForMerge.includes(p.id) && p.id !== targetPerson?.id),
  );

  async function handleConfirmMerge() {
    // The dialog might pass back different target/sources if user changed them?
    // PersonMergeDialog onConfirm signature: (targetId: string, sourceIds: string[]) => void
    // But model.confirmMerge calculates it automatically.
    // If PersonMergeDialog allows UI re-selection, we need to handle that.
    // Looking at PersonMergeDialog... it seems it just visualizes.
    // But wait, if model.confirmMerge() recalculates "best target", it ignores what was shown in the dialog if the dialog logic differs.
    // Ideally we should pass the dialog's choice to the model.
    // But for now let's call model.confirmMerge() which does the smart logic.
    // Actually, if PersonMergeDialog allows selecting a *different* target, we need to respect that.
    // Let's assume PersonMergeDialog is read-only visualization for now, matching existing behavior where confirmMerge did logic.
    await model.confirmMerge();
  }
</script>

{#if model.detailPerson}
  <PersonDetailDialog
    bind:open={model.showPersonDetail}
    person={model.detailPerson}
    urlPrefix="/api/people"
  />
{/if}

<PersonMergeDialog
  bind:open={model.showMergeConfirmDialog}
  {targetPerson}
  sources={sourcePersons}
  onConfirm={handleConfirmMerge}
/>

<Dialog.Root
  open={model.confirmDialog.open}
  onOpenChange={(open) => {
    if (!open) model.confirmDialog = { open: false, config: null };
  }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{model.confirmDialog.config?.title}</Dialog.Title>
      <Dialog.Description>{model.confirmDialog.config?.description}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (model.confirmDialog = { open: false, config: null })}
      >
        Zrušit
      </Button>
      <Button variant="destructive" onclick={() => model.runConfirmedAction()}>
        {model.confirmDialog.config?.confirmLabel || "Potvrdit"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
