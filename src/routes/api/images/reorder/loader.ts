import fsp from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { createLogger } from "$lib/logger";
import type { StoryDataMap } from "$shared/types/manifest";

const logger = createLogger("api:reorder:loader");

/**
 * Lightweight story loader for the API endpoint.
 * Avoids importing the heavy build script infrastructure.
 */
export async function loadStoryData(contentRoot: string): Promise<StoryDataMap> {
  const storyDataMap: StoryDataMap = {};

  try {
    // We need to scan for MD files.
    // Since we don't want to use fast-glob (heavy?), we can do a simple recursive crawl
    // or just assume a flat structure if that's how it is.
    // But the original loader uses `scanGlob("**/*.md")`.
    // Let's use `bun.Glob` which is native and fast.

    const glob = new Bun.Glob("**/*.md");
    for await (const file of glob.scan({ cwd: contentRoot, absolute: true })) {
      try {
        const fileContent = await fsp.readFile(file, "utf8");
        const { data, content } = matter(fileContent);
        const storyBody = (data.content || content).trim();
        const filename = path.basename(file, ".md");
        const locationKey =
          data.location ||
          (data.date ? new Date(data.date).toISOString().substring(0, 10) : filename);

        storyDataMap[locationKey] = {
          title: data.title || "",
          content: storyBody,
          location: data.location || undefined,
          date: data.date ? new Date(data.date).toISOString().substring(0, 10) : undefined,
        };
      } catch (e: any) {
        logger.warn(`Could not parse story file ${file}: ${e.message}`);
      }
    }
  } catch (e: any) {
    logger.error(`Failed to load stories: ${e.message}`);
  }

  return storyDataMap;
}
