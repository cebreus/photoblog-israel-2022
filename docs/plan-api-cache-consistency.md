# Implementation Plan - API Cache Consistency

This plan addresses a systemic issue where several API endpoints modify data on disk but fail to invalidate the server's in-memory cache. This causes the UI in development mode to show stale data (e.g., deleted people still appearing, old names persisting) until a full server restart or manual refresh timing luck.

## Goal Description

Ensure that **all** API endpoints that modify manifest data explicitly call `reloadManifests()` upon success. This forces the server to re-read the JSON files from disk, providing the frontend with the latest "Source of Truth" immediately.

## Proposed Changes

We will add `import { reloadManifests } from "$lib/utils/images";` and `await reloadManifests();` to the success path of the following handlers:

### `src/routes/api/images/+server.ts`

- **PATCH**: Updates image metadata (keywords, etc.). Needs reload.

### `src/routes/api/people/*`

- **PATCH (`people/+server.ts`)**: Renaming, hiding, categorization.
- **POST (`merge/+server.ts`)**: Merging people (destructive). Critical.
- **POST (`reassign/+server.ts`)**: Moving faces between people.
- **POST (`unmatch/+server.ts`)**: Splitting people.
- **POST (`invalidate-detection/+server.ts`)**: Marking faces as invalid.
- **POST (`set-avatar/+server.ts`)**: Changing person thumbnails.

## Verification Plan

### Automated Tests

Run `pnpm check` to ensure no import errors.

### Manual Verification

1.  **Person Rename**: Rename a person in the UI. Confirm the new name persists on refresh without restarting the server.
2.  **Merge**: Merge two people. Confirm the source person disappears immediately.
