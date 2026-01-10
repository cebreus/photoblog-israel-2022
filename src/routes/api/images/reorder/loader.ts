import { createLogger } from "$lib/logger";
import { readFileText, scanGlob } from "$scripts/utils/runtime";
import type { StoryDataMap } from "$shared/types/manifest";
import { toPureWallClockISO } from "$shared/utils/dates";
import matter from "gray-matter";
import path from "node:path";

const logger = createLogger("api:reorder:loader");

/**
 * Story loader for the API endpoint.
 * Loads all required fields from markdown files including startDate, endDate, city, and visits.
 * Uses string-based date handling with toPureWallClockISO for consistency.
 */
export async function loadStoryData(contentRoot: string): Promise<StoryDataMap> {
  const storyDataMap: StoryDataMap = {};

  try {
    const files = await scanGlob("**/*.md", { cwd: contentRoot, absolute: true });
    for (const file of files) {
      try {
        const fileContent = await readFileText(file);
        const { data, content } = matter(fileContent);
        if (data.type === "settings") continue;

        const storyBody = (data.content || content).trim();
        const filename = path.basename(file, ".md");

        // Determine startDate: priority is data.startDate > data.date
        const startDateRaw = data.startDate || data.date;
        const startDate = toPureWallClockISO(startDateRaw);
        const endDate = toPureWallClockISO(data.endDate);

        // Parse visits array if present
        const visits = Array.isArray(data.visits)
          ? data.visits.map((v: { startDate?: string | Date; endDate?: string | Date }) => ({
              startDate: toPureWallClockISO(v.startDate),
              endDate: toPureWallClockISO(v.endDate),
            }))
          : undefined;

        // Location key: use location field, or derive from date if present
        const locationKey = data.location || (startDate ? startDate.substring(0, 10) : filename);

        storyDataMap[locationKey] = {
          title: data.title || "",
          content: storyBody,
          location: data.location || undefined,
          city: data.city || undefined,
          date: data.date ? toPureWallClockISO(data.date)?.substring(0, 10) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          visits,
        };
      } catch (e: unknown) {
        logger.warn({ err: e, file }, "Could not parse story file");
      }
    }
  } catch (e: unknown) {
    logger.error({ err: e }, "Failed to load stories");
  }

  return storyDataMap;
}
