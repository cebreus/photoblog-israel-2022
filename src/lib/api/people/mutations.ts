/**
 * @fileoverview People Mutation Hooks
 *
 * TanStack Query mutation hooks for People-related operations.
 * All mutations automatically invalidate relevant queries and refresh data.
 */

import { people } from "$lib/stores/people.svelte";
import { tracedFetch } from "$lib/utils/api";
import { GENERIC_MESSAGES, PERSON_MESSAGES } from "$lib/utils/messages";
import { createMutation, useQueryClient } from "@tanstack/svelte-query";
import { toast } from "svelte-sonner";
import type {
  ApiResponse,
  InvalidateDetectionParams,
  InvalidateDetectionResponse,
  MergePeopleParams,
  MergeResponse,
  ReassignFaceParams,
  ReassignResponse,
  SetAvatarParams,
  SetAvatarResponse,
  UnmatchFaceParams,
  UnmatchResponse,
  UpdateCategoryParams,
  UpdatePeopleParams,
} from "./types";
import { PEOPLE_QUERY_KEYS } from "./types";

// ---------------------------------------------------------------------------
// Mutation Functions (pure API calls)
// ---------------------------------------------------------------------------

async function updatePeopleFn(params: UpdatePeopleParams): Promise<ApiResponse> {
  const response = await tracedFetch("/api/people", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Update failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  const res = await response.json();
  if (res.success && res.updated === 0 && params.updates.length > 0) {
    const errors = res.results
      ?.filter((r: { success: boolean; error?: string }) => !r.success)
      .map((r: { id: string; error?: string }) => r.error)
      .filter(Boolean)
      .join(", ");
    throw new Error(errors || "Update applied to 0 records");
  }
  return res;
}

async function mergePeopleFn(params: MergePeopleParams): Promise<MergeResponse> {
  const response = await tracedFetch("/api/people/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Sloučení selhalo");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function unmatchFaceFn(params: UnmatchFaceParams): Promise<UnmatchResponse> {
  const response = await tracedFetch("/api/people/unmatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Unmatch failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function reassignFaceFn(params: ReassignFaceParams): Promise<ReassignResponse> {
  const response = await tracedFetch("/api/people/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Reassign failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function invalidateDetectionFn(
  params: InvalidateDetectionParams,
): Promise<InvalidateDetectionResponse> {
  const response = await tracedFetch("/api/people/invalidate-detection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Invalidation failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function setAvatarFn(params: SetAvatarParams): Promise<SetAvatarResponse> {
  const response = await tracedFetch("/api/people/set-avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Avatar update failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function updateCategoryFn(params: UpdateCategoryParams): Promise<ApiResponse> {
  const response = await tracedFetch("/api/people", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updates: [{ id: params.personId, category: params.category }],
    }),
  });
  if (!response.ok) {
    // Safely check for non-JSON response if SvelteKit returns an error page
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Category update failed");
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Updates one or more people (rename, hide, junk, category).
 * Automatically refreshes people store and invalidates manifest.
 */
export function useUpdatePeopleMutation() {
  return createMutation(() => ({
    mutationFn: updatePeopleFn,
    onSuccess: async (_data, variables) => {
      // await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.manifest }); // Unused
      await people.refresh();

      // Show specific toast based on variables
      if (variables.updates.some((u) => u.hidden !== undefined)) {
        toast.success("Viditelnost změněna");
      } else if (variables.updates.some((u) => u.junk !== undefined)) {
        toast.success("Stav koše změněn");
      } else if (variables.updates.some((u) => u.name !== undefined)) {
        toast.success(PERSON_MESSAGES.PERSON_RENAMED);
      } else {
        toast.success("Změny uloženy");
      }
    },
    onError: (error: Error) => {
      toast.error(PERSON_MESSAGES.UPDATE_FAILED, { description: error.message });
    },
  }));
}

/**
 * Merges multiple source people into a target person.
 * Shows success toast and refreshes all related data.
 */
export function useMergePeopleMutation() {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: mergePeopleFn,
    onMutate: (variables) => {
      people.optimisticMerge(variables.sourcePersonIds, variables.targetPersonId);
    },
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.MERGE_SUCCESS);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.constraints }),
        people.refresh(),
      ]);
    },
    onError: (error: Error) => {
      toast.error(PERSON_MESSAGES.MERGE_FAILED, { description: error.message });
    },
  }));
}

/**
 * Removes a face detection from a person.
 * Updates constraints and refreshes people data.
 */
export function useUnmatchFaceMutation() {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: unmatchFaceFn,
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.FACE_REMOVED);
      await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.constraints });
      await people.refresh();
    },
    onError: (error: Error) => {
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR, { description: error.message });
    },
  }));
}

/**
 * Moves a face from one person to another.
 * Updates constraints and refreshes people data.
 */
export function useReassignFaceMutation() {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: reassignFaceFn,
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.FACE_REASSIGNED);
      await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.constraints });
      await people.refresh();
    },
    onError: (error: Error) => {
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR, { description: error.message });
    },
  }));
}

/**
 * Marks a face detection as invalid (junk).
 * Updates constraints to prevent future clustering.
 */
export function useInvalidateDetectionMutation() {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: invalidateDetectionFn,
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.DETECTION_INVALIDATED);
      await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.constraints });
      await people.refresh();
    },
    onError: (error: Error) => {
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR, { description: error.message });
    },
  }));
}

/**
 * Sets a custom avatar for a person.
 * Refreshes people data to show updated thumbnail.
 */
export function useSetAvatarMutation() {
  return createMutation(() => ({
    mutationFn: setAvatarFn,
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.AVATAR_UPDATED);
      await people.refresh();
    },
    onError: (error: Error) => {
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR, { description: error.message });
    },
  }));
}

/**
 * Updates the category of a person (person/statue/painting).
 * Refreshes people data after successful update.
 */
export function useUpdateCategoryMutation() {
  return createMutation(() => ({
    mutationFn: updateCategoryFn,
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.CATEGORY_UPDATED);
      await people.refresh();
    },
    onError: (error: Error) => {
      toast.error(PERSON_MESSAGES.CATEGORY_UPDATE_FAILED, { description: error.message });
    },
  }));
}
