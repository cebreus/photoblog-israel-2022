# Stores (Svelte 5 Module-level $state)

> Dokumentace systému reaktivních stores s Svelte 5 runami (`$state`).

**Navigace:** [← INDEX](./INDEX.md) | [ARCH-COMPONENTS →](./ARCH-COMPONENTS.md)

---

## Obsah

1. [Introduction](#1-introduction)
2. [Core Stores](#2-core-stores)
3. [Usage Patterns](#3-usage-patterns)
4. [Side Effects](#4-side-effects)
5. [Derived State](#5-derived-state)
6. [Migration Guide](#6-migration-guide)

---

## 1. Introduction

### Why $state (Svelte 5)?

**Before (Svelte 4):**

```ts
import { writable } from 'svelte/store';

export const filters = writable<Set<string>>(new Set());

// Component:
filters.subscribe(value => { ... });
```

**After (Svelte 5):**

```ts
// stores/filters.svelte.ts
export let selectedAuthors = $state<Set<string>>(new Set());

// Component:
{#each selectedAuthors as author}...{/each}
```

**Benefits:**

- ✅ **Faster:** Direct object mutation vs subscription overhead
- ✅ **Smaller bundle:** No subscription machinery
- ✅ **Simpler:** No `$` auto-subscription syntax
- ✅ **Reactive:** Changes propagate instantly to components

### Module-level $state

```ts
// src/lib/stores/filters.svelte.ts
let selectedAuthors = $state<Set<string>>(new Set());
let selectedMedia = $state<Set<string>>(new Set());

export function addAuthor(id: string) {
  selectedAuthors.add(id); // Direct mutation
}

export function resetFilters() {
  selectedAuthors.clear();
  selectedMedia.clear();
}
```

**Key:** `$state` at module level = shared, reactive singleton

#### 2026 Pattern Update

Aktuální implementace používá kombinaci:

- Modulové proměnné s `$state` a `$derived`
- Exportované singletony (objekty s getters/setters) nebo třídy (`ManifestStore`, `PeopleState`)

Příklad (zjednodušený):

```ts
// stores/filters.svelte.ts
let selectedAuthors = $state<string[]>([]);
let selectedPeople = $state<string[]>([]);
const filteredPhotoDays = $derived.by(() => compute(...));

export const filters = {
  get selectedAuthors() { return selectedAuthors; },
  set selectedAuthors(v: string[]) { selectedAuthors = v; },
  get selectedPeople() { return selectedPeople; },
  set selectedPeople(v: string[]) { selectedPeople = v; },
  get filteredPhotoDays() { return filteredPhotoDays; },
  reset() { selectedAuthors = []; selectedPeople = []; },
};

// stores/manifest.svelte.ts
export class ManifestStore {
  people = $state<Person[]>(getPeopleManifest().people || []);
  photoDays = $state<PhotoDay[]>(getManifest().photoDays || []);
  update(data?: { photoDays?: PhotoDay[]; peopleManifest?: PeopleManifest } | null) { /* ... */ }
  refreshItem(updatedItem: ImageEntry) { /* ... */ }
}
export const manifest = new ManifestStore();
```

Tento vzor nahrazuje dřívější `export let ...` přístup a je plně v souladu se Svelte 5.

---

## 2. Core Stores

### filters.svelte.ts (aktualizováno)

**Location:** `src/lib/stores/filters.svelte.ts`

**Public API:** Exportovaný objekt s getters/setters a odvozeným stavem. Viz ukázka v sekci výše.

**Type:**

```ts
interface FilterCriteria {
  authors: Set<string>;
  media: Set<string>;
  people: Set<string>;
  labels: Set<string>;
  separators: Set<string>;
  quality: Set<"excellent" | "good" | "poor">;
  snapshots: SnapshotFilters;
}

interface SnapshotFilters {
  authors: Set<string>;
  others: Set<string>;
}
```

---

### selectedImages.svelte.ts (aktualizováno)

**Location:** `src/lib/stores/selectedImages.svelte.ts`

**Poznámka:** Implementace multi-výběru je součástí UI komponent a/nebo centralizovaná v `PhotoGrid` logice.

---

### editingMode.svelte.ts (aktualizováno)

Aktuální stav editace je součástí UI logiky a globálních stores (`ui.svelte.ts`).

---

_Poslední aktualizace: 2026-01-06_

**Location:** `src/lib/stores/editingMode.svelte.ts`

**State:**

```ts
export let isEditMode = $state(false);
export let editingImageId = $state<string | null>(null);
export let editingPersonId = $state<string | null>(null);
```

**Functions:**

```ts
export function toggleEditMode() {
  isEditMode = !isEditMode;
}

export function setEditMode(mode: boolean) {
  isEditMode = mode;
}

export function startEditingImage(id: string) {
  editingImageId = id;
  isEditMode = true;
}

export function stopEditing() {
  editingImageId = null;
  editingPersonId = null;
  isEditMode = false;
}
```

---

### manifest.svelte.ts

**Location:** `src/lib/stores/manifest.svelte.ts`

**Purpose:** Single Source of Truth (SSoT) pro galerii data

**State:**

```ts
export let manifest = $state<GalleryManifest>({
  metadata: {
    title: "Gallery",
    description: "",
    created: new Date().toISOString(),
  },
  images: [],
  people: [],
  separators: [],
});
```

**Functions:**

```ts
export function updateImageMetadata(id: string, updates: Partial<ImageEntry>) {
  const image = manifest.images.find((img) => img.id === id);
  if (image) {
    Object.assign(image, updates);
  }
}

export function getImage(id: string): ImageEntry | undefined {
  return manifest.images.find((img) => img.id === id);
}

export function getPerson(id: string): Person | undefined {
  return manifest.people.find((p) => p.id === id);
}

export function getSeparator(id: string): Separator | undefined {
  return manifest.separators.find((s) => s.id === id);
}
```

**Note:** Manifest se načítá ze serveru v `+page.ts`:

```ts
// src/routes/+page.ts
export async function load({ fetch }): PageLoad {
  const response = await fetch("/api/gallery-manifest");
  const manifest = await response.json();

  // Store se update v <script>
  return { manifest };
}
```

---

## 3. Usage Patterns

### Using Stores in Components

**Svelte 5 (with $state):**

```svelte
<script>
  import { filters } from "$lib/stores/filters.svelte";
  import { addImage, selectedImageIds, toggleImage } from "$lib/stores/selectedImages.svelte";
</script>

<div>
  <!-- Direct access (no $ prefix needed) -->
  <p>Selected: {selectedImageIds.size} images</p>

  <!-- Iterate over store state -->
  {#each Array.from(selectedImageIds) as imageId}
    <img src={imageId} />
  {/each}

  <!-- Call store functions -->
  <button on:click={() => toggleImage("IMG_001")}> Toggle image </button>

  <!-- Reactive filter count -->
  <p>{filters.selectedAuthors.size} authors selected</p>
</div>
```

**Old way (writable store):**

```svelte
<script>
  import { selectedImageIds } from "$lib/stores";
</script>

{#each $selectedImageIds as imageId}
  <img src={imageId} />
{/each}
```

---

### Compound State Updates

```svelte
<script>
  import { selectedImageIds } from '$lib/stores/selectedImages.svelte';

  function selectRange(start: number, end: number) {
    // Multi-step mutation is reactive
    selectedImageIds.clear();
    for (let i = start; i <= end; i++) {
      selectedImageIds.add(`IMG_${i}`);
    }
    // Components using selectedImageIds re-render ONCE
  }
</script>

<button on:click={() => selectRange(0, 10)}>
  Select first 10
</button>
```

---

## 4. Side Effects

### useEffect Pattern

Use `$effect` rune to run code when store changes:

```svelte
<script>
  import { editingImageId } from "$lib/stores/editingMode.svelte";

  let imageData = $state<ImageEntry | null>(null);

  $effect(() => {
    if (editingImageId) {
      // Fetch whenever editingImageId changes
      fetchImage(editingImageId).then((data) => {
        imageData = data;
      });
    }
  });
</script>

{#if imageData}
  <form>
    <input bind:value={imageData.title} />
  </form>
{/if}
```

### Persist to LocalStorage

```ts
// stores/preferences.svelte.ts
let preferences = $state<UserPreferences>({
  theme: "light",
  sortBy: "date",
  itemsPerPage: 20,
});

export function savePreferences() {
  localStorage.setItem("preferences", JSON.stringify(preferences));
}

export function loadPreferences() {
  const saved = localStorage.getItem("preferences");
  if (saved) {
    Object.assign(preferences, JSON.parse(saved));
  }
}
```

---

## 5. Derived State

### Computed Properties (not $derived)

For simple filtering, use functions:

```ts
export function getVisibleImages(allImages: ImageEntry[]): ImageEntry[] {
  const criteria = getFilterCriteria();

  return allImages.filter((img) => shouldIncludeItem(img, criteria));
}
```

### Real $derived (for reactive computation)

For complex derived state that needs reactivity:

```ts
export let totalSelectedCount = $derived(
  selectedImageIds.size + selectedPeople.size + selectedLabels.size,
);

export let hasFiltersActive = $derived(
  selectedAuthors.size > 0 || selectedMedia.size > 0 || selectedPeople.size > 0,
);
```

---

## 6. Migration Guide

### From writable Store

**Before:**

```ts
import { writable } from 'svelte/store';

export const authors = writable<Set<string>>(new Set());

// Component:
{#if $authors.has('alice')}...{/if}
```

**After:**

```ts
export let selectedAuthors = $state<Set<string>>(new Set());

// Component:
{#if selectedAuthors.has('alice')}...{/if}
```

### Step-by-step Migration

1. **Replace writable:**

```ts
- import { writable } from 'svelte/store';
- export const state = writable(initialValue);

+ export let state = $state(initialValue);
```

2. **Update component imports:**

```svelte
- import {state} from '$lib/stores'; + import {state} from '$lib/stores/state.svelte';
```

3. **Remove $ subscription:**

```svelte
- {#each $items as item}...{/each}
+ {#each items as item}...{/each}
```

4. **Update function calls:**

```ts
-state.update((s) => new Set([...s, item]));
+state.add(item); // Direct mutation
```

---

## 7. Best Practices

### ✅ DO

```ts
// 1. Keep stores focused (single responsibility)
export let selectedAuthors = $state<Set<string>>(new Set());
export let selectedMedia = $state<Set<string>>(new Set());

// 2. Export functions for state changes
export function addAuthor(id: string) {
  selectedAuthors.add(id);
}

// 3. Use derived for computed state
export let filterCount = $derived(selectedAuthors.size + selectedMedia.size);

// 4. Name stores clearly (no $ prefix in module-level)
export let editingMode = $state(false);
```

### ❌ DON'T

```ts
// 1. Don't overload stores with unrelated state
export let filters = $state({
  authors: new Set(),
  images: [],           // ← Unrelated, separate store
  currentUser: { ... }, // ← Unrelated, separate store
});

// 2. Don't expose internal state, use functions
export function clearFilters() {
  // ✅ Good: encapsulated
  selectedAuthors.clear();
  selectedMedia.clear();
}

// 3. Don't mutate in components (hard to track)
// ❌ Bad (in component):
selectedAuthors.add(id);

// ✅ Good (call store function):
addAuthor(id);

// 4. Don't forget reactivity
// ❌ Bad: reassignment doesn't notify (for objects)
preferences = { ...preferences, theme: 'dark' };

// ✅ Good: mutate instead
preferences.theme = 'dark';
```

---

## Related Documents

- [ARCH-COMPONENTS.md](./ARCH-COMPONENTS.md) — Component hierarchy
- [ARCH-FEATURES.md](./ARCH-FEATURES.md#2-stores) — Stores section
- [BREAKING_CHANGES.md](./BREAKING_CHANGES.md#4-stores-module-level-state-pattern) — Migration from writable

---

_Poslední aktualizace: 2026-01-05_
