/**
 * @fileoverview People Query Hooks
 *
 * TanStack Query hooks for fetching People-related data.
 * All queries are deklarativní, cachované a automaticky re-fetchují při invalidaci.
 */

import { dev } from "$app/environment";
import { createQuery } from "@tanstack/svelte-query";
import type { AvatarsData, ConstraintsData } from "./types";
import { PEOPLE_QUERY_KEYS } from "./types";

// ---------------------------------------------------------------------------
// Fetch Functions (pure, testable)
// ---------------------------------------------------------------------------

async function fetchConstraints(): Promise<ConstraintsData> {
  const response = await fetch("/api/people/constraints");
  if (!response.ok) {
    throw new Error("Failed to load clustering constraints");
  }
  return response.json();
}

async function fetchAvatars(): Promise<string[]> {
  const response = await fetch("/api/people/avatars");
  if (!response.ok) {
    throw new Error("Failed to load avatars");
  }
  const data: AvatarsData = await response.json();
  return data.avatars ?? [];
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Loads clustering constraints (connects, disconnects, invalid detections).
 * Only enabled in dev mode.
 */
export function useConstraintsQuery() {
  return createQuery(() => ({
    queryKey: PEOPLE_QUERY_KEYS.constraints,
    queryFn: fetchConstraints,
    enabled: dev,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  }));
}

/**
 * Loads available avatar images for person profiles.
 * Only enabled in dev mode.
 */
export function useAvatarsQuery() {
  return createQuery(() => ({
    queryKey: PEOPLE_QUERY_KEYS.avatars,
    queryFn: fetchAvatars,
    enabled: dev,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  }));
}
