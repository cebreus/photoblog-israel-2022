/**
 * @fileoverview Person Property Updater
 *
 * Generic utility for updating boolean/enum properties on Person objects.
 * Reduces code duplication across hide, junk, and update-category endpoints.
 */

import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { Logger } from "$lib/logger";
import type { Person } from "$lib/types/manifest";
import { config } from "$scripts/build.config";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadPeopleManifest, savePeopleManifest } from "$scripts/lib/manifests/repository";

export type PropertyUpdateResult = {
  success: boolean;
  count: number;
  results: Array<{ id: string; [key: string]: unknown }>;
  error?: string;
};

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string; status?: number };

/**
 * Generic handler for updating a single property on multiple Person records.
 *
 * @param propertyName - The Person property to update
 * @param request - The incoming request
 * @param validator - Validation function for the request body
 * @param logger - Logger instance
 */
export async function handlePropertyUpdate<
  K extends keyof Person,
  T extends { personId?: string; personIds?: string[] } & Record<K, Person[K]>,
>(
  propertyName: K,
  request: Request,
  validator: (body: unknown) => ValidationResult<T>,
  logger: Logger,
): Promise<Response> {
  if (!dev) {
    throw error(403, "Manifest edits restricted to DEV.");
  }

  const body = await request.json();
  const validation = validator(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: 400 });
  }

  const { personId, personIds, ...rest } = validation.data;
  const propertyValue = (rest as unknown as Record<K, Person[K]>)[propertyName];
  const targetIds = personIds || (personId ? [personId] : []);
  const dataDir = path.resolve(process.cwd(), config.paths.dataRoot);

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      if (!peopleManifest) throw new Error("People manifest missing.");

      const modifiedIds: string[] = [];
      for (const id of targetIds) {
        const targetPerson = peopleManifest.people.find(function (person) {
          return person.id === id;
        });
        if (targetPerson && targetPerson[propertyName] !== propertyValue) {
          targetPerson[propertyName] = propertyValue;
          modifiedIds.push(id);
        }
      }

      if (modifiedIds.length > 0) {
        await savePeopleManifest(dataDir, peopleManifest);
      }

      return json({
        success: true,
        count: modifiedIds.length,
        results: modifiedIds.map(function (id) {
          return { id, [propertyName]: propertyValue };
        }),
      });
    });
  } catch (err) {
    logger.error({ err }, `[API/PEOPLE/${propertyName.toString().toUpperCase()}] Error`);
    return json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
