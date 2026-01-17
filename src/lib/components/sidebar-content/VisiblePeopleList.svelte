<script lang="ts">
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import User from "@lucide/svelte/icons/user";

  import InlineRename from "$lib/components/ui/InlineRename.svelte";
  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import * as m from "$lib/paraglide/messages";
  import type { Person } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  import { dev } from "$app/environment";

  let {
    visiblePeople = [],
    processingIds = new Set<string>(),
    selectedForMerge = [],
    editingPersonId = null,
    editingName = "",
    isSaving = false,
    getThumbnailSrc,
    openPersonDetail,
    startEditing,
    onEditingNameChange,
    confirmRename,
    cancelEditing,
    toggleHide,
    toggleMergeSelection,
  }: {
    visiblePeople: Person[];
    processingIds?: Set<string>;
    selectedForMerge?: string[];
    editingPersonId?: string | null;
    editingName?: string;
    isSaving?: boolean;
    getThumbnailSrc: (person: Person) => string;
    openPersonDetail: (person: Person, e?: MouseEvent) => void;
    startEditing: (person: Person) => void;
    onEditingNameChange: (value: string) => void;
    confirmRename: () => Promise<void>;
    cancelEditing: () => void;
    toggleHide: (personId: string) => Promise<void>;
    toggleMergeSelection: (
      personId: string,
      eventOrShift?: MouseEvent | KeyboardEvent | boolean,
    ) => void;
  } = $props();

  const named = $derived(
    visiblePeople
      .filter((p) => !p.hidden && p.isUserNamed)
      .sort((a, b) => a.name.localeCompare(b.name, "cs", { sensitivity: "base" })),
  );
  const generic = $derived(
    visiblePeople
      .filter((p) => !p.hidden && !p.isUserNamed)
      .sort((a, b) => b.faceCount - a.faceCount),
  );
  const hidden = $derived(
    visiblePeople.filter((p) => p.hidden).sort((a, b) => b.faceCount - a.faceCount),
  );
</script>

{#snippet personItem(person: Person)}
  <div
    class="group hover:bg-accent/50 relative flex items-center gap-3 border-b p-3 px-4 transition-colors"
  >
    <LoadingOverlay
      visible={(isSaving && editingPersonId === person.id) || processingIds.has(person.id)}
      class="bg-background/90 rounded"
      spinnerClass="text-primary h-6 w-6"
    />
    <Button
      disabled={processingIds.has(person.id)}
      variant="outline"
      class="border-border ring-primary relative h-10 w-10 shrink-0 overflow-hidden rounded border bg-slate-200 p-0 transition-all hover:ring-2 focus:outline-none dark:bg-slate-800"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        openPersonDetail(person, e);
      }}
      aria-label={m.person_open_detail_aria()}
      data-testid="people-tab-person-thumbnail-button"
    >
      {#if person.thumbnail}
        <img
          src={getThumbnailSrc(person)}
          alt={person.name}
          class="h-full w-full object-cover"
          data-testid="people-tab-person-thumbnail"
        />
      {:else}
        <div class="flex h-full w-full items-center justify-center">
          <User class="h-5 w-5 text-slate-400" />
        </div>
      {/if}
    </Button>

    <div class="min-w-0 flex-1">
      <InlineRename
        value={person.name}
        isEditing={editingPersonId === person.id}
        onSave={async (newName) => {
          onEditingNameChange(newName);
          await confirmRename();
        }}
        isSaving={isSaving && editingPersonId === person.id}
        canEdit={dev}
        showEditIcon={dev}
        testId="people-tab-person-name"
        labelClass="hover:text-primary h-auto flex-1 cursor-pointer justify-start border-none bg-transparent p-0 text-left text-sm font-medium transition-colors hover:underline"
        inputClass="flex-1 text-sm font-medium"
      />
      <div class="text-muted-foreground text-xs" data-testid="people-tab-person-count">
        {#if dev}
          {#if person.detectionsCount !== undefined}
            {m.person_detections_count({ count: person.detectionsCount })}
            {#if person.detectionsCount !== person.faceCount}
              / {m.person_photos_count({ count: person.faceCount })}
            {/if}
          {:else}
            {m.person_detections_count({ count: person.faceCount })}
          {/if}
        {:else}
          {m.person_photos_count({ count: person.faceCount })}
        {/if}
      </div>
    </div>

    {#if dev}
      {@const isMergeSelected = selectedForMerge.includes(person.id)}
      <button
        type="button"
        class={cn(
          "ml-2 flex shrink-0 items-center justify-center rounded border border-white p-0 shadow-sm transition-colors focus-visible:outline-none",
          isMergeSelected
            ? "bg-primary border-primary"
            : "bg-black/20 hover:bg-black/40 dark:bg-white/10 dark:hover:bg-white/20",
        )}
        style="width: 20px; height: 20px;"
        onclick={(event) => {
          event.stopPropagation();
          toggleMergeSelection(person.id, event.shiftKey);
        }}
        aria-pressed={isMergeSelected}
        aria-label={isMergeSelected ? m.person_unselect_merge_aria() : m.person_select_merge_aria()}
        data-testid="people-tab-person-merge-checkbox"
      >
        {#if isMergeSelected}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-white"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {/if}
      </button>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label={m.person_hide_person_aria()}
        title={m.person_hide_person_aria()}
        disabled={processingIds.has(person.id)}
        data-testid="people-tab-person-hide-button"
        onclick={(event) => {
          event.stopPropagation();
          toggleHide(person.id);
        }}
      >
        <EyeOff class="size-4" strokeWidth={2.5} />
      </Button>
    {/if}
  </div>
{/snippet}

<div class="flex flex-col">
  {#if visiblePeople.length > 0}
    <div class="flex flex-col" data-testid="people-tab-named-list">
      {#each named as person (person.id)}
        {@render personItem(person)}
      {/each}
    </div>

    {#if named.length > 0 && generic.length > 0}
      <div class="bg-muted/10 py-2">
        <Separator />
      </div>
    {/if}

    <div class="flex flex-col" data-testid="people-tab-generic-list">
      {#each generic as person (person.id)}
        {@render personItem(person)}
      {/each}
    </div>

    {#if (named.length > 0 || generic.length > 0) && hidden.length > 0}
      <div class="bg-muted/10 py-2">
        <Separator />
      </div>
    {/if}

    <div class="flex flex-col opacity-60 grayscale" data-testid="people-tab-hidden-list">
      {#each hidden as person (person.id)}
        {@render personItem(person)}
      {/each}
    </div>
  {:else}
    <div class="text-muted-foreground p-8 text-center text-sm" data-testid="people-tab-empty-state">
      {m.person_no_detections()}
      <br />
      <span class="text-xs opacity-70"
        >{m.person_face_clustering_hint()} <code>bun scripts/face-clustering.ts</code></span
      >
    </div>
  {/if}
</div>
