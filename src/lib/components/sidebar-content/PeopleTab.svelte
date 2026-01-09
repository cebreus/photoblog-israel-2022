<script lang="ts">
  import { useMergePeopleMutation, useUpdatePeopleMutation } from "$lib/api/people/mutations";
  import { useConstraintsQuery } from "$lib/api/people/queries";
  import TaskOverlay from "$lib/components/ui/TaskOverlay.svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { createPeopleTabModel } from "$lib/logic/people-tab-model.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import { people } from "$lib/stores/people.svelte";
  import { system } from "$lib/stores/system.svelte";
  import type { Person } from "$lib/types/manifest";

  import PeopleBulkActions from "./people/PeopleBulkActions.svelte";
  import PeopleMergeDialogs from "./people/PeopleMergeDialogs.svelte";
  import PeopleStats from "./people/PeopleStats.svelte";

  import CategoryPersonCard from "./CategoryPersonCard.svelte";
  import PeopleSelectionControls from "./PeopleSelectionControls.svelte";
  import VisiblePeopleList from "./VisiblePeopleList.svelte";

  // TanStack Query hooks
  const constraintsQuery = useConstraintsQuery();
  const mergeMutation = useMergePeopleMutation();
  const updateMutation = useUpdatePeopleMutation();

  // Derive invalidDetections from query
  const invalidDetections = $derived(constraintsQuery.data?.invalidDetections ?? []);

  // Create model with data from query and mutations
  const model = createPeopleTabModel({
    getInvalidDetections: () => invalidDetections,
    mergeMutation,
    updateMutation,
  });

  // Initialize logic
  model.initDetailSync();

  // Derive processing state from system store OR mutations
  const isProcessing = $derived(
    system.activeTask !== null || mergeMutation.isPending || updateMutation.isPending,
  );

  // Background sync indicator
  const isBackgroundFetching = $derived(constraintsQuery.isFetching);

  // Subscribe to derived store with optimized stats for list rendering
  const peopleList = $derived(people.peopleWithStats);

  function getThumbnailSrc(person: Person) {
    if (!person.thumbnail) return "";
    return `/${person.thumbnail}?t=${model.lastUpdateTimestamp}`;
  }
</script>

<div class="relative flex h-full flex-col">
  {#if isProcessing}
    <div
      class="bg-background/50 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
    >
      <TaskOverlay />
    </div>
  {/if}

  <Sidebar.Header class="p-0">
    <PeopleStats stats={model.stats} />

    <div class="space-y-2 border-b p-4">
      <PeopleSelectionControls
        selectionMode={model.selectionMode as any}
        onPreset={(mode: "all" | "unknown" | "reset" | null) => model.handleSelectionPreset(mode)}
      />
    </div>

    {#if isBackgroundFetching}
      <div
        class="border-b bg-blue-50 px-4 py-1 text-center text-xs text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
      >
        Synchronizace dat...
      </div>
    {/if}
  </Sidebar.Header>

  <Sidebar.Content class="p-0">
    <div class="flex-1 overflow-hidden">
      <div class="space-y-2 p-2">
        {#if people.categoryPeople.length > 0 || people.categoryStatues.length > 0 || people.categoryPaintings.length > 0}
          <Accordion.Root type="multiple" class="w-full">
            {#if people.categoryPeople.length > 0}
              <Accordion.Item value="people">
                <Accordion.Trigger class="px-2">Lidé</Accordion.Trigger>
                <Accordion.Content>
                  <div class="grid grid-cols-2 gap-2 p-2">
                    {#each people.categoryPeople as person (person.id)}
                      <CategoryPersonCard
                        {person}
                        {getThumbnailSrc}
                        testId="people-tab-category-person-card"
                        selected={model.selectedForMerge.includes(person.id)}
                        onToggle={(id: string, e?: MouseEvent | KeyboardEvent) =>
                          model.toggleMergeSelection(person.id, e)}
                      />
                    {/each}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/if}

            {#if people.categoryStatues.length > 0}
              <Accordion.Item value="statues">
                <Accordion.Trigger class="px-2">Sochy</Accordion.Trigger>
                <Accordion.Content>
                  <div class="grid grid-cols-2 gap-2 p-2">
                    {#each people.categoryStatues as person (person.id)}
                      <CategoryPersonCard
                        {person}
                        {getThumbnailSrc}
                        testId="people-tab-category-statue-card"
                        selected={model.selectedForMerge.includes(person.id)}
                        onToggle={(id: string, e?: MouseEvent | KeyboardEvent) =>
                          model.toggleMergeSelection(person.id, e)}
                      />
                    {/each}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/if}

            {#if people.categoryPaintings.length > 0}
              <Accordion.Item value="paintings">
                <Accordion.Trigger class="px-2">Malby / Fresky</Accordion.Trigger>
                <Accordion.Content>
                  <div class="grid grid-cols-2 gap-2 p-2">
                    {#each people.categoryPaintings as person (person.id)}
                      <CategoryPersonCard
                        {person}
                        {getThumbnailSrc}
                        testId="people-tab-category-painting-card"
                        selected={model.selectedForMerge.includes(person.id)}
                        onToggle={(id: string, e?: MouseEvent | KeyboardEvent) =>
                          model.toggleMergeSelection(person.id, e)}
                      />
                    {/each}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/if}
          </Accordion.Root>
        {/if}

        <VisiblePeopleList
          visiblePeople={peopleList}
          {getThumbnailSrc}
          selectedPeople={filters.selectedPeople}
          togglePerson={(id: string, shift?: boolean) => model.togglePerson(id, shift)}
          openPersonDetail={(p: Person, e?: MouseEvent) => model.openPersonDetail(p, e)}
          startEditing={(p: Person) => model.startEditing(p)}
          editingPersonId={model.editingPersonId}
          editingName={model.editingName}
          onEditingNameChange={(val: string) => (model.editingName = val)}
          confirmRename={() => model.confirmRename()}
          cancelEditing={() => model.cancelEditing()}
          toggleHide={(id: string) => (model.toggleHide ? model.toggleHide(id) : Promise.resolve())}
          toggleMergeSelection={(id: string, e?: MouseEvent | KeyboardEvent | boolean) =>
            model.toggleMergeSelection(id, e)}
          processingIds={model.processingIds}
          selectedForMerge={model.selectedForMerge}
        />
      </div>
    </div>
  </Sidebar.Content>

  <Sidebar.Footer class="p-0">
    {#if model.selectedForMerge.length > 0}
      <PeopleBulkActions {model} />
    {/if}
  </Sidebar.Footer>

  <PeopleMergeDialogs {model} />
</div>
