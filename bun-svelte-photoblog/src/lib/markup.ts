import { marked } from "marked";
import type { Separator } from "$lib/types/manifest";

/**
 * Convert separator.storyContent (markdown) to HTML. Kept as a pure TS helper
 * so rendering/parsing is testable and lives in the data/transform layer.
 */
export function renderStoryHtml(separator: Separator): string {
  // Prefer pre-rendered HTML when available (build step can emit storyHtml).
  if (!separator) return "";
  const preRendered = separator.storyHtml;
  if (preRendered) return preRendered;

  // Render markdown if available
  if (!separator.storyContent) return "";

  // marked parsing can be sync or async depending on options, here assuming sync
  const parsed = marked.parse(separator.storyContent);
  if (typeof parsed === "string") return parsed;
  // Fallback if marked returns a Promise (should not happen with defaults)
  return "";
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
