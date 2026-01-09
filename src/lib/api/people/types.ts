/**
 * @fileoverview People API Types
 *
 * Centralized type definitions for all People-related API operations.
 * Used by TanStack Query hooks for type-safe data fetching and mutations.
 */

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export interface PersonUpdate {
  id: string;
  name?: string;
  hidden?: boolean;
  junk?: boolean;
  category?: "person" | "statue" | "painting";
}

export interface ApiResponse {
  success: boolean;
  error?: string;
}

export interface MergeResponse extends ApiResponse {
  mergedPerson?: { id: string; name: string };
  updatedImageCount?: number;
  sourceOldFaceCount?: number;
  sourceNewFaceCount?: number;
  targetOldFaceCount?: number;
  targetNewFaceCount?: number;
}

export interface UnmatchResponse extends ApiResponse {
  updatedImageId?: string;
}

export interface ReassignResponse extends ApiResponse {
  newPersonId?: string;
}

export interface InvalidateDetectionResponse extends ApiResponse {
  constraintAdded?: boolean;
}

export interface SetAvatarResponse extends ApiResponse {
  updatedPerson?: { id: string; thumbnail: string };
}

// ---------------------------------------------------------------------------
// Constraints Types
// ---------------------------------------------------------------------------

export interface ClusteringConstraint {
  imageId: string;
  personId: string;
}

export interface InvalidDetection {
  imageId: string;
  box: { x: number; y: number; width: number; height: number };
}

export interface ConstraintsData {
  connects: ClusteringConstraint[];
  disconnects: ClusteringConstraint[];
  invalidDetections?: InvalidDetection[];
}

// ---------------------------------------------------------------------------
// Avatars Types
// ---------------------------------------------------------------------------

export interface AvatarsData {
  avatars: string[];
}

// ---------------------------------------------------------------------------
// Mutation Parameters
// ---------------------------------------------------------------------------

export interface MergePeopleParams {
  sourcePersonIds: string[];
  targetPersonId: string;
}

export interface UnmatchFaceParams {
  personId: string;
  imageIds: string[];
  ignore?: boolean;
}

export interface ReassignFaceParams {
  sourcePersonId: string;
  targetPersonId: string;
  imageIds: string[];
}

export interface InvalidateDetectionParams {
  personId: string;
  imageId?: string;
  box?: { x: number; y: number; width: number; height: number };
  detections?: Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
}

export interface UpdateCategoryParams {
  personId: string;
  category: "person" | "statue" | "painting";
}

export interface SetAvatarParams {
  personId: string;
  avatarPath: string;
}

export interface UpdatePeopleParams {
  updates: PersonUpdate[];
}

// ---------------------------------------------------------------------------
// Query Keys (centralized for invalidation)
// ---------------------------------------------------------------------------

export const PEOPLE_QUERY_KEYS = {
  constraints: ["people", "constraints"] as const,
  avatars: ["people", "avatars"] as const,
  manifest: ["people", "manifest"] as const,
} as const;
