import type { PhotoDay, Separator } from "$lib/types/manifest"; // Added Separator for the cast
import { getPhotoDays } from "$lib/utils/images";
import { renderStoryHtml } from "$lib/utils/markup"; // Corrected import path

export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();

  // Render markdown to html on the server
  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "separator" && item.storyContent) {
        item.storyHtml = renderStoryHtml(item.storyContent);
      }
    }
  }

  return {
    photoDays,
  };
}
