/**
 * @fileoverview People API Actions
 *
 * Extracted from PeopleTab.svelte for reusability and testability.
 * Contains API calls and business logic for managing people/persons in the gallery.
 */

import { toast } from "svelte-sonner";
import { createLogger } from "$lib/logger";
import { filters } from "$lib/stores/filters.svelte";
import { people } from "$lib/stores/people.svelte";

const logger = createLogger("people-actions");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonUpdate {
  id: string;
  name?: string;
  hidden?: boolean;
  junk?: boolean;
  category?: string;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
}

export interface MergeResponse extends ApiResponse {
  mergedPerson?: unknown;
  updatedImageCount?: number;
  sourceOldFaceCount?: number;
  sourceNewFaceCount?: number;
  targetOldFaceCount?: number;
  targetNewFaceCount?: number;
}

// ---------------------------------------------------------------------------
// Core API Functions
// ---------------------------------------------------------------------------

/**
 * Generic helper for PATCH updates to /api/people
 */
export async function updatePeople(updates: PersonUpdate[]): Promise<Response> {
  return fetch("/api/people", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
}

/**
 * Updates people and throws on error
 */
export async function updatePeopleOrThrow(updates: PersonUpdate[]): Promise<unknown> {
  const res = await updatePeople(updates);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Update failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Individual Person Actions
// ---------------------------------------------------------------------------

/**
 * Renames a person by ID
 */
export async function renamePerson(personId: string, newName: string): Promise<void> {
  if (!newName.trim()) return;
  await updatePeopleOrThrow([{ id: personId, name: newName.trim() }]);
}

/**
 * Toggles hidden state for a person
 */
export async function togglePersonHidden(personId: string): Promise<boolean> {
  const person = people.visiblePeople.find(function (p) {
    return p.id === personId;
  });
  const newHiddenState = !(person?.hidden ?? false);

  await updatePeopleOrThrow([{ id: personId, hidden: newHiddenState }]);

  // Also remove from selection if being hidden
  filters.selectedPeople = filters.selectedPeople.filter(function (id) {
    return id !== personId;
  });

  return newHiddenState;
}

/**
 * Marks a person as junk (ignored in future detection)
 */
export async function markPersonAsJunk(personId: string): Promise<void> {
  await updatePeopleOrThrow([{ id: personId, junk: true }]);
}

// ---------------------------------------------------------------------------
// Bulk Operations
// ---------------------------------------------------------------------------

/**
 * Hides multiple people at once
 */
export async function bulkHidePeople(personIds: string[]): Promise<number> {
  if (personIds.length === 0) return 0;

  const updates = personIds.map(function (id) {
    return { id, hidden: true };
  });
  await updatePeopleOrThrow(updates);

  // Remove from filter selection
  filters.selectedPeople = filters.selectedPeople.filter(function (id) {
    return !personIds.includes(id);
  });

  return personIds.length;
}

/**
 * Restores hidden people (un-hides them)
 */
export async function bulkRestorePeople(personIds: string[]): Promise<number> {
  if (personIds.length === 0) return 0;

  const updates = personIds.map(function (id) {
    return { id, hidden: false };
  });
  await updatePeopleOrThrow(updates);

  return personIds.length;
}

/**
 * Marks multiple people as junk
 */
export async function bulkMarkAsJunk(personIds: string[]): Promise<number> {
  if (personIds.length === 0) return 0;

  const updates = personIds.map(function (id) {
    return { id, junk: true };
  });
  await updatePeopleOrThrow(updates);

  return personIds.length;
}

/**
 * Restores people from junk status
 */
export async function bulkRestoreFromJunk(personIds: string[]): Promise<number> {
  if (personIds.length === 0) return 0;

  const updates = personIds.map(function (id) {
    return { id, junk: false };
  });
  await updatePeopleOrThrow(updates);

  return personIds.length;
}

/**
 * Updates category for multiple people
 */
export async function bulkUpdateCategory(
  personIds: string[],
  category: "person" | "statue" | "painting",
): Promise<number> {
  if (personIds.length === 0) return 0;

  const updates = personIds.map(function (id) {
    return { id, category };
  });
  await updatePeopleOrThrow(updates);

  return personIds.length;
}

// ---------------------------------------------------------------------------
// Merge Operations
// ---------------------------------------------------------------------------

/**
 * Merges multiple source people into a target person
 */
export async function mergePeopleIntoTarget(
  sourcePersonIds: string[],
  targetPersonId: string,
): Promise<void> {
  if (sourcePersonIds.length === 0) {
    throw new Error("No source people to merge");
  }

  const response = await fetch("/api/people/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourcePersonIds,
      targetPersonId,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as MergeResponse;
    throw new Error(error.error || "Sloučení selhalo");
  }
}

/**
 * Merges a single source into target (legacy single-merge API)
 */
export async function mergePersonIntoTarget(
  sourcePersonId: string,
  targetPersonId: string,
): Promise<void> {
  const response = await fetch("/api/people/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourcePersonId,
      targetPersonId,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Merge failed");
  }
}

// ---------------------------------------------------------------------------
// High-Level Action Handlers (with toast notifications)
// ---------------------------------------------------------------------------

/**
 * Toggles hide with loading state and toast feedback
 */
export async function handleToggleHide(
  personId: string,
  callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
  } = {},
): Promise<void> {
  callbacks.onStart?.();

  try {
    const isHidden = await togglePersonHidden(personId);

    // Add minimum delay to show loading state
    await new Promise(function (resolve) {
      setTimeout(resolve, 300);
    });

    await people.refresh();
    toast.success(isHidden ? "Osoba byla skryta." : "Osoba byla obnovena.");
  } catch (error) {
    logger.error("Failed to toggle hide:", error);
    toast.error("Chyba při komunikaci se serverem.");
  } finally {
    callbacks.onFinish?.();
  }
}

/**
 * Renames person with loading state and toast feedback
 */
export async function handleRename(
  personId: string,
  newName: string,
  callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
    onSuccess?: () => void;
  } = {},
): Promise<void> {
  if (!personId || !newName.trim()) return;

  callbacks.onStart?.();

  try {
    // Add minimum delay to keep overlay visible
    await Promise.all([
      renamePerson(personId, newName.trim()),
      new Promise(function (resolve) {
        setTimeout(resolve, 500);
      }),
    ]);

    await people.refresh();
    toast.success("Osoba byla úspěšně přejmenována.");
    callbacks.onSuccess?.();
  } catch (error) {
    logger.error("Failed to rename person:", error);
    toast.error("Přejmenování se nezdařilo.");
  } finally {
    callbacks.onFinish?.();
  }
}

/**
 * Marks person as junk with confirmation and toast feedback
 */
export async function handleMarkAsJunk(
  personId: string,
  callbacks: {
    onStart?: () => void;
    onFinish?: () => void;
  } = {},
): Promise<void> {
  callbacks.onStart?.();

  try {
    await markPersonAsJunk(personId);
    toast.success("Osoba je nyní ignorována.");
    await people.refresh();
  } catch (error) {
    logger.error("Failed to mark as junk:", error);
    toast.error("Chyba při komunikaci se serverem.");
  } finally {
    callbacks.onFinish?.();
  }
}
