import { marked } from "marked";
import type { Separator } from "$lib/types/manifest";

/**
 * Convert storyContent (markdown) to HTML. Kept as a pure TS helper
 * so rendering/parsing is testable and lives in the data/transform layer.
 */
export function renderStoryHtml(
  storyContent: string | undefined,
  preRenderedHtml?: string,
): string {
  if (!storyContent && !preRenderedHtml) return "";
  if (preRenderedHtml) return preRenderedHtml;

  if (!storyContent) return "";
  const parsed = marked.parse(storyContent);
  return typeof parsed === "string" ? parsed : "";
}

/**
 * Generic markdown rendering helper for other markdown sources in the app
 * (pages, frontmatter). Accepts optional pre-rendered HTML which will be
 * returned immediately when present (useful when the build pipeline emits
 * pre-rendered HTML).
 */
export function renderMarkdown(
  content?: string,
  preRenderedHtml?: string,
): string {
  if (!content && !preRenderedHtml) return "";
  if (preRenderedHtml) return preRenderedHtml;

  const parsed = marked.parse(content ?? "");
  return typeof parsed === "string" ? parsed : "";
}
