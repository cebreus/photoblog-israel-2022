/**
 * @fileoverview People Mutation Hooks
 *
 * TanStack Query mutation hooks for People-related operations.
 * All mutations automatically invalidate relevant queries and refresh data.
 */

import { invalidateAll } from "$app/navigation";
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
    const err = await response.json();
    throw new Error(err.error || "Update failed");
  }
  return response.json();
}

async function mergePeopleFn(params: MergePeopleParams): Promise<MergeResponse> {
  const response = await tracedFetch("/api/people/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Sloučení selhalo");
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
    const err = await response.json();
    throw new Error(err.error || "Unmatch failed");
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
    const err = await response.json();
    throw new Error(err.error || "Reassign failed");
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
    const err = await response.json();
    throw new Error(err.error || "Invalidation failed");
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
    const err = await response.json();
    throw new Error(err.error || "Avatar update failed");
  }
  return response.json();
}

async function updateCategoryFn(params: UpdateCategoryParams): Promise<ApiResponse> {
  const response = await tracedFetch("/api/people/update-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Category update failed");
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
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: updatePeopleFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.manifest });
      await people.refresh();
      toast.success(PERSON_MESSAGES.PERSON_RENAMED);
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
    onSuccess: async () => {
      toast.success(PERSON_MESSAGES.MERGE_SUCCESS);
      await queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.constraints });
      await people.refresh();
      await invalidateAll();
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
