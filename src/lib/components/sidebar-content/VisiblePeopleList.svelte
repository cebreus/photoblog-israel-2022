<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import User from "@lucide/svelte/icons/user";
  import X from "@lucide/svelte/icons/x";
  import { dev } from "$app/environment";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import { Switch } from "$lib/components/ui/switch";
  import type { Person } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  export let visiblePeople: Person[] = [];
  export let processingIds = new Set<string>();
  export let selectedPeople: string[] = [];
  export let selectedForMerge: string[] = [];
  export let editingPersonId: string | null = null;
  export let editingName = "";
  export let isSaving = false;
  export let getThumbnailSrc: (person: Person) => string;
  export let togglePerson: (personId: string, shiftKey?: boolean) => void;
  export let openPersonDetail: (person: Person, e?: MouseEvent) => void;
  export let startEditing: (person: Person) => void;
  export let onEditingNameChange: (value: string) => void;
  export let confirmRename: () => Promise<void>;
  export let cancelEditing: () => void;
  export let toggleHide: (personId: string) => Promise<void>;
  export let toggleMergeSelection: (
    personId: string,
    eventOrShift?: MouseEvent | KeyboardEvent | boolean,
  ) => void;
</script>

<div class="flex flex-col">
  {#if visiblePeople.length > 0}
    {#each visiblePeople as person (person.id)}
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
        class={`relative group border-b flex items-center gap-3 p-3 px-4 hover:bg-accent/50 transition-colors cursor-pointer ${isSelected ? "bg-accent/30" : ""}`}
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
            class="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center rounded"
            style="z-index: 10;"
            data-testid="people-tab-person-loading"
          >
            <Spinner class="w-6 h-6 text-primary" />
          </div>
        {/if}
        <Button
          disabled={processingIds.has(person.id)}
          variant="outline"
          class="relative w-10 h-10 p-0 rounded overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-border hover:ring-2 ring-primary transition-all focus:outline-none"
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            openPersonDetail(person, e);
          }}
          data-testid="people-tab-person-thumbnail-button"
        >
          {#if person.thumbnail}
            <img
              src={getThumbnailSrc(person)}
              alt={person.name}
              class="w-full h-full object-cover"
              data-testid="people-tab-person-thumbnail"
            />
          {:else}
            <div class="flex items-center justify-center w-full h-full">
              <User class="w-5 h-5 text-slate-400" />
            </div>
          {/if}
        </Button>

        <div class="flex-1 min-w-0">
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
                class="font-medium text-sm flex-1"
                data-testid="people-tab-person-name-input"
              />
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 hover:bg-green-100 dark:hover:bg-green-900"
                title="Potvrdit"
                data-testid="people-tab-person-confirm"
                onclick={(event) => {
                  event.stopPropagation();
                  confirmRename();
                }}
              >
                <Check class="w-4 h-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-900"
                title="Zrušit"
                data-testid="people-tab-person-cancel"
                onclick={(event) => {
                  event.stopPropagation();
                  cancelEditing();
                }}
              >
                <X class="w-4 h-4 text-red-600" />
              </Button>
            </div>
          {:else if dev}
            <Button
              variant="ghost"
              class="font-medium text-sm w-full text-left hover:text-primary transition-colors cursor-text bg-transparent border-none p-0 h-auto justify-start"
              data-testid="people-tab-person-name"
              onclick={(event) => {
                event.stopPropagation();
                startEditing(person);
              }}
            >
              {person.name}
            </Button>
          {:else}
            <div class="font-medium text-sm" data-testid="people-tab-person-name">
              {person.name}
            </div>
          {/if}
          <div class="text-xs text-muted-foreground" data-testid="people-tab-person-count">
            {person.faceCount} fotek
          </div>
        </div>

        <Switch
          checked={isSelected}
          class="pointer-events-none"
          data-testid="people-tab-person-switch"
        />

        {#if dev}
          {@const isMergeSelected = selectedForMerge.includes(person.id)}
          <Button
            variant="ghost"
            class={cn(
              "ml-2 h-5 w-5 rounded border border-white flex items-center justify-center transition-colors shadow-sm shrink-0 focus-visible:outline-none p-0",
              isMergeSelected ? "bg-primary border-primary" : "bg-black/20 hover:bg-black/40",
            )}
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
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Skrýt osobu"
            disabled={processingIds.has(person.id)}
            data-testid="people-tab-person-ignore-button"
            onclick={(event) => {
              event.stopPropagation();
              toggleHide(person.id);
            }}
          >
            <EyeOff class="w-4 h-4" />
          </Button>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="p-8 text-center text-muted-foreground text-sm" data-testid="people-tab-empty-state">
      Žádné osoby nebyly detekovány.
      <br />
      <span class="text-xs opacity-70">Spusťte <code>bun scripts/face-clustering.ts</code></span>
    </div>
  {/if}
</div>
