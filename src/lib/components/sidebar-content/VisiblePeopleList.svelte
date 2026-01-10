<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import User from "@lucide/svelte/icons/user";
  import X from "@lucide/svelte/icons/x";
  import { fade } from "svelte/transition";

  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";
  import { Spinner } from "$lib/components/ui/spinner";
  import { Switch } from "$lib/components/ui/switch";
  import type { Person } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  import { dev } from "$app/environment";

  let {
    visiblePeople = [],
    processingIds = new Set<string>(),
    selectedPeople = [],
    selectedForMerge = [],
    editingPersonId = null,
    editingName = "",
    isSaving = false,
    getThumbnailSrc,
    togglePerson,
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
    selectedPeople?: string[];
    selectedForMerge?: string[];
    editingPersonId?: string | null;
    editingName?: string;
    isSaving?: boolean;
    getThumbnailSrc: (person: Person) => string;
    togglePerson: (personId: string, shiftKey?: boolean) => void;
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
      .filter((p) => p.isUserNamed)
      .sort((a, b) => a.name.localeCompare(b.name, "cs", { sensitivity: "base" })),
  );
  const generic = $derived(
    visiblePeople.filter((p) => !p.isUserNamed).sort((a, b) => b.faceCount - a.faceCount),
  );
</script>

{#snippet personItem(person: Person)}
  {@const isSelected =
    selectedPeople.length === 0
      ? true
      : selectedPeople.includes("none")
        ? false
        : selectedPeople.includes(person.id)}
  <div
    role="button"
    tabindex="0"
    aria-pressed={isSelected}
    class={`group hover:bg-accent/50 relative flex cursor-pointer items-center gap-3 border-b p-3 px-4 transition-colors ${isSelected ? "bg-accent/30" : ""}`}
    onclick={(e: MouseEvent) => {
      if (!editingPersonId) {
        togglePerson(person.id, e.shiftKey);
      }
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (editingPersonId) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePerson(person.id, e.shiftKey);
      }
    }}
    data-testid="people-tab-person-item"
  >
    {#if (isSaving && editingPersonId === person.id) || processingIds.has(person.id)}
      <div
        class="bg-background/90 absolute inset-0 flex items-center justify-center rounded backdrop-blur-sm"
        style="z-index: 10;"
        in:fade={{ duration: 100, delay: 300 }}
        out:fade={{ duration: 100 }}
        data-testid="people-tab-person-loading"
      >
        <Spinner class="text-primary h-6 w-6" />
      </div>
    {/if}
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
            <Check class="h-4 w-4 text-green-600" />
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
            <X class="h-4 w-4 text-red-600" />
          </Button>
        </div>
      {:else if dev}
        <Button
          variant="ghost"
          class="hover:text-primary h-auto w-full cursor-text justify-start border-none bg-transparent p-0 text-left text-sm font-medium transition-colors"
          data-testid="people-tab-person-name"
          onclick={(event) => {
            event.stopPropagation();
            startEditing(person);
          }}
        >
          {person.name}
        </Button>
      {:else}
        <div class="text-sm font-medium" data-testid="people-tab-person-name">
          {person.name}
        </div>
      {/if}
      <div class="text-muted-foreground text-xs" data-testid="people-tab-person-count">
        {#if dev && person.detectionsCount && person.detectionsCount > person.faceCount}
          {person.detectionsCount} tváří / {person.faceCount} fotek
        {:else}
          {person.faceCount} fotek
        {/if}
      </div>
    </div>

    <Switch
      checked={isSelected}
      class="pointer-events-none"
      data-testid="people-tab-person-switch"
    />

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
        disabled={processingIds.has(person.id)}
        data-testid="people-tab-person-ignore-button"
        onclick={(event) => {
          event.stopPropagation();
          toggleHide(person.id);
        }}
      >
        <EyeOff class="h-4 w-4" />
      </Button>
    {/if}
  </div>
{/snippet}

<div class="flex flex-col">
  {#if visiblePeople.length > 0}
    {#each named as person (person.id)}
      {@render personItem(person)}
    {/each}

    {#if named.length > 0 && generic.length > 0}
      <div class="bg-muted/10 py-2">
        <Separator />
      </div>
    {/if}

    {#each generic as person (person.id)}
      {@render personItem(person)}
    {/each}
  {:else}
    <div class="text-muted-foreground p-8 text-center text-sm" data-testid="people-tab-empty-state">
      Žádné osoby nebyly detekovány.
      <br />
      <span class="text-xs opacity-70">Spusťte <code>bun scripts/face-clustering.ts</code></span>
    </div>
  {/if}
</div>
