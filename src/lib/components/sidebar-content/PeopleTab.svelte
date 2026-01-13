<script lang="ts">
  import {
    useInvalidateDetectionMutation,
    useMergePeopleMutation,
    useUpdatePeopleMutation,
  } from "$lib/api/people/mutations";
  import { useConstraintsQuery } from "$lib/api/people/queries";
  import PersonInvalidateDialog from "$lib/components/PersonInvalidateDialog.svelte";
  import SelectionBulkActions from "$lib/components/SelectionBulkActions.svelte";
  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import TaskOverlay from "$lib/components/ui/TaskOverlay.svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Separator } from "$lib/components/ui/separator";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { createPeopleTabModel } from "$lib/logic/people-tab-model.svelte";
  import * as m from "$lib/paraglide/messages";
  import { people } from "$lib/stores/people.svelte";
  import { system } from "$lib/stores/system.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { Person } from "$lib/types/manifest";

  import { dev } from "$app/environment";

  import PeopleMergeDialogs from "./people/PeopleMergeDialogs.svelte";
  import PeopleStats from "./people/PeopleStats.svelte";

  import CategoryPersonCard from "./CategoryPersonCard.svelte";
  import VisiblePeopleList from "./VisiblePeopleList.svelte";

  // TanStack Query hooks
  const constraintsQuery = useConstraintsQuery();
  const mergeMutation = useMergePeopleMutation();
  const updateMutation = useUpdatePeopleMutation();
  const invalidateDetectionMutation = useInvalidateDetectionMutation();

  // Derive invalidDetections from query
  const invalidDetections = $derived(constraintsQuery.data?.invalidDetections ?? []);

  // Create model with data from query and mutations
  const model = createPeopleTabModel({
    getInvalidDetections: () => invalidDetections,
    mergeMutation,
    updateMutation,
    invalidateDetectionMutation,
  });

  // Initialize logic
  model.initDetailSync();

  // Derive processing state from system store OR mutations
  const isProcessing = $derived(
    system.activeTask !== null ||
      mergeMutation.isPending ||
      updateMutation.isPending ||
      invalidateDetectionMutation.isPending,
  );

  // Background sync indicator
  const isBackgroundFetching = $derived(constraintsQuery.isFetching);

  // Subscribe to derived store with optimized stats for list rendering
  const allPersons = $derived(people.displayPersons);
  const namedPersons = $derived(allPersons.filter((p) => !p.hidden && p.isUserNamed));
  const unnamedPersons = $derived(allPersons.filter((p) => p.hidden || !p.isUserNamed));

  function getThumbnailSrc(person: Person) {
    if (!person.thumbnail) return "";
    return `/${person.thumbnail}?t=${model.lastUpdateTimestamp}`;
  }
</script>

{#snippet groupedGrid(list: Person[], testIdBase: string)}
  {@const named = list.filter((p) => !p.hidden && p.isUserNamed)}
  {@const unnamed = list.filter((p) => !p.hidden && !p.isUserNamed)}
  {@const hidden = list.filter((p) => p.hidden)}

  <div class="flex flex-col gap-4 p-2">
    {#if named.length > 0}
      <div class="grid grid-cols-3 gap-2" data-testid={`${testIdBase}-named`}>
        {#each named as person (person.id)}
          <CategoryPersonCard
            {person}
            {getThumbnailSrc}
            testId={`${testIdBase}-card`}
            selected={model.selectedForMerge.includes(person.id)}
            onToggle={(id, e) => model.toggleMergeSelection(person.id, e)}
            onOpenDetail={(p) => model.openPersonDetail(p)}
          />
        {/each}
      </div>
    {/if}

    {#if named.length > 0 && unnamed.length > 0}
      <Separator />
    {/if}

    {#if unnamed.length > 0}
      <div class="grid grid-cols-3 gap-2" data-testid={`${testIdBase}-unnamed`}>
        {#each unnamed as person (person.id)}
          <CategoryPersonCard
            {person}
            {getThumbnailSrc}
            testId={`${testIdBase}-card`}
            selected={model.selectedForMerge.includes(person.id)}
            onToggle={(id, e) => model.toggleMergeSelection(person.id, e)}
            onOpenDetail={(p) => model.openPersonDetail(p)}
          />
        {/each}
      </div>
    {/if}

    {#if (named.length > 0 || unnamed.length > 0) && hidden.length > 0}
      <Separator />
    {/if}

    {#if hidden.length > 0}
      <div class="grid grid-cols-3 gap-2" data-testid={`${testIdBase}-hidden`}>
        {#each hidden as person (person.id)}
          <CategoryPersonCard
            {person}
            {getThumbnailSrc}
            testId={`${testIdBase}-card`}
            selected={model.selectedForMerge.includes(person.id)}
            onToggle={(id, e) => model.toggleMergeSelection(person.id, e)}
            onOpenDetail={(p) => model.openPersonDetail(p)}
          />
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="relative flex h-full flex-col overflow-y-auto" data-testid="people-tab">
  {#if isProcessing}
    <div
      class="bg-background/50 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      data-testid="people-tab-processing-overlay"
    >
      <TaskOverlay />
    </div>
  {/if}

  <LoadingOverlay
    visible={isBackgroundFetching && !isProcessing}
    label={m.people_tab_loading_label()}
    description={m.people_tab_loading_description()}
  />

  <Sidebar.Header class="p-0">
    <PeopleStats stats={model.stats} />
  </Sidebar.Header>

  {#if dev}
    <div
      class="bg-background/95 sticky top-0 z-20 border-b px-4 py-2 backdrop-blur-sm"
      data-testid="people-tab-bulk-actions-container"
    >
      <SelectionBulkActions
        count={model.selectedForMerge.length}
        onClear={() => (model.selectedForMerge = [])}
        isWorking={model.isSaving}
        disabled={!dev}
        class="w-full"
        testId="people-tab-bulk-actions"
        onMerge={() => model.openMergeDialog()}
        onMergeInto={(targetId) => model.handleMergeInto(targetId)}
        namedPeople={model.namedPeople}
        onHide={() => model.handleBulkHideAction()}
        onRestore={() => model.handleBulkRestore()}
        onMarkAsJunk={() => model.handleBulkMarkAsJunk()}
        onRestoreFromJunk={() => model.handleBulkRestoreFromJunk()}
        onUpdateCategory={(cat) => model.bulkUpdateCategory(cat)}
        onInvalidateDetections={() => model.handleBulkInvalidateDetections()}
        hiddenCount={model.selectedHiddenCount}
        junkCount={model.selectedJunkCount}
        canHide={model.canHide}
      />
    </div>
  {/if}

  <div class="flex flex-col p-0">
    <div class="flex flex-col">
      <div class="space-y-2 p-2">
        {#if namedPersons.length > 0}
          <VisiblePeopleList
            visiblePeople={namedPersons}
            {getThumbnailSrc}
            openPersonDetail={(p: Person, e?: MouseEvent) => model.openPersonDetail(p, e)}
            startEditing={(p: Person) => model.startEditing(p)}
            editingPersonId={model.editingPersonId}
            editingName={model.editingName}
            onEditingNameChange={(val: string) => (model.editingName = val)}
            confirmRename={() => model.confirmRename()}
            cancelEditing={() => model.cancelEditing()}
            toggleHide={(id: string) =>
              model.toggleHide ? model.toggleHide(id) : Promise.resolve()}
            toggleMergeSelection={(id: string, e?: MouseEvent | KeyboardEvent | boolean) =>
              model.toggleMergeSelection(id, e)}
            processingIds={model.processingIds}
            selectedForMerge={model.selectedForMerge}
          />
        {/if}

        {#if dev}
          <Accordion.Root
            type="multiple"
            class="w-full"
            data-testid="people-tab-accordion-root"
            bind:value={ui.peopleAccordionState}
          >
            {#if unnamedPersons.length > 0}
              <Accordion.Item value="persons" data-testid="people-tab-unnamed-item">
                <Accordion.Trigger class="px-2" data-testid="people-tab-unnamed-trigger">
                  {m.people_tab_unnamed_title()} ({unnamedPersons.length})
                </Accordion.Trigger>
                <Accordion.Content>
                  {@render groupedGrid(unnamedPersons, "people-tab-unnamed")}
                </Accordion.Content>
              </Accordion.Item>
            {/if}
            {#if people.displayStatues.length > 0}
              <Accordion.Item value="statues" data-testid="people-tab-category-statues-item">
                <Accordion.Trigger class="px-2" data-testid="people-tab-category-statues-trigger">
                  {m.people_tab_statues_title()} ({people.displayStatues.length})
                </Accordion.Trigger>
                <Accordion.Content>
                  {@render groupedGrid(people.displayStatues, "people-tab-statues")}
                </Accordion.Content>
              </Accordion.Item>
            {/if}

            {#if people.displayPaintings.length > 0}
              <Accordion.Item value="paintings" data-testid="people-tab-category-paintings-item">
                <Accordion.Trigger class="px-2" data-testid="people-tab-category-paintings-trigger">
                  {m.people_tab_paintings_title()} ({people.displayPaintings.length})
                </Accordion.Trigger>
                <Accordion.Content>
                  {@render groupedGrid(people.displayPaintings, "people-tab-paintings")}
                </Accordion.Content>
              </Accordion.Item>
            {/if}

            {#if people.displayJunk.length > 0}
              <Accordion.Item value="junk" data-testid="people-tab-category-junk-item">
                <Accordion.Trigger class="px-2" data-testid="people-tab-category-junk-trigger">
                  {m.people_tab_junk_title()} ({people.displayJunk.length})
                </Accordion.Trigger>
                <Accordion.Content>
                  {@render groupedGrid(people.displayJunk, "people-tab-category-junk")}
                </Accordion.Content>
              </Accordion.Item>
            {/if}
          </Accordion.Root>
        {/if}
      </div>
    </div>
  </div>

  <!-- <Sidebar.Footer class="bg-background sticky bottom-0 z-10 border-t px-6">oo</Sidebar.Footer> -->

  <PeopleMergeDialogs {model} />

  <PersonInvalidateDialog
    bind:open={model.showInvalidateConfirmDialog}
    candidates={model.bulkInvalidationCandidates}
    onConfirm={() => model.confirmBulkInvalidate()}
  />
</div>
