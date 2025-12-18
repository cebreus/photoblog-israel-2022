import type { Separator } from "$lib/types/manifest";
import { marked } from "marked";

export function renderStoryHtml(separator: Separator): string {
  return separator.story ?? "";
}

export function renderMarkdown(content?: string, preRenderedHtml?: string): string {
  if (!content && !preRenderedHtml) return "";
  if (preRenderedHtml) return preRenderedHtml;

  const parsed = marked.parse(content ?? "");
  return typeof parsed === "string" ? parsed : "";
}
