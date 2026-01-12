<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Pencil from "@lucide/svelte/icons/pencil";
  import User from "@lucide/svelte/icons/user";
  import X from "@lucide/svelte/icons/x";

  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";
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
      aria-label="Otevřít detail osoby"
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
      {#if dev && editingPersonId === person.id}
        <div class="flex items-center gap-2">
          <Input
            type="text"
            value={editingName}
            oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) =>
              onEditingNameChange(event.currentTarget.value)}
            onclick={(event: MouseEvent) => event.stopPropagation()}
            onkeydown={(event: KeyboardEvent) => {
              if (event.key === "Enter") confirmRename();
              if (event.key === "Escape") cancelEditing();
            }}
            class="flex-1 text-sm font-medium"
            data-testid="people-tab-person-name-input"
          />
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-green-100 dark:hover:bg-green-900"
            aria-label="Potvrdit"
            data-testid="people-tab-person-confirm"
            onclick={(event) => {
              event.stopPropagation();
              confirmRename();
            }}
          >
            <Check class="size-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-900"
            aria-label="Zrušit"
            data-testid="people-tab-person-cancel"
            onclick={(event) => {
              event.stopPropagation();
              cancelEditing();
            }}
          >
            <X class="size-4 text-red-600" />
          </Button>
        </div>
      {:else if dev}
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            class="hover:text-primary h-auto flex-1 cursor-pointer justify-start border-none bg-transparent p-0 text-left text-sm font-medium transition-colors hover:underline"
            data-testid="people-tab-person-name"
            title="Otevřít detail / Dvojklik pro přejmenování"
            onclick={(event) => {
              event.stopPropagation();
              openPersonDetail(person, event);
            }}
            ondblclick={(event) => {
              event.stopPropagation();
              startEditing(person);
            }}
          >
            {person.name}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="text-muted-foreground/30 hover:text-foreground size-4 shrink-0 p-0"
            title="Přejmenovat"
            aria-label="Přejmenovat"
            onclick={(event) => {
              event.stopPropagation();
              startEditing(person);
            }}
            data-testid="people-tab-person-edit-btn"
          >
            <Pencil class="h-3 w-3" />
          </Button>
        </div>
      {:else}
        <Button
          variant="ghost"
          class="h-auto justify-start p-0 text-sm font-medium hover:underline"
          data-testid="people-tab-person-name"
          onclick={(event) => {
            event.stopPropagation();
            openPersonDetail(person, event);
          }}
        >
          {person.name}
        </Button>
      {/if}
      <div class="text-muted-foreground text-xs" data-testid="people-tab-person-count">
        {#if dev}
          {#if person.detectionsCount !== undefined}
            {person.detectionsCount} detekcí
            {#if person.detectionsCount !== person.faceCount}
              / {person.faceCount} fotek
            {/if}
          {:else}
            {person.faceCount} detekcí
          {/if}
        {:else}
          {person.faceCount} fotek
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
        aria-label={isMergeSelected ? "Zrušit výběr pro sloučení" : "Vybrat pro sloučení"}
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
        aria-label="Skrýt osobu"
        title="Skrýt osobu"
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
      Žádné osoby nebyly detekovány.
      <br />
      <span class="text-xs opacity-70">Spusťte <code>bun scripts/face-clustering.ts</code></span>
    </div>
  {/if}
</div>
