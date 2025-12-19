import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { renderMarkdown } from "$lib/utils/markup";

export type PageFrontMatter = {
  type?: string;
  title_h1?: string;
  excerpt?: string;
  jumbo?: {
    title?: string;
    excerpt?: string;
    content?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    robots?: string;
    canonical?: string;
  };
};

export type PageData = {
  route: string;
  jumbo: {
    title?: string;
    excerpt?: string;
    content?: string; // plain markdown
    html?: {
      excerpt?: string;
      content?: string;
    };
  } | null;
  body?: string; // raw markdown body
  bodyHtml?: string; // rendered HTML body
  seo?: PageFrontMatter["seo"];
};

const CONTENT_ROOT = path.resolve(process.cwd(), "content/pages");

export async function loadPage(route: string): Promise<PageData> {
  const file = path.join(CONTENT_ROOT, route, "index.md");
  const raw = await fs.readFile(file, "utf8");
  const { data, content } = matter(raw);
  const fm: PageFrontMatter = data || {};

  const jumbo = fm.jumbo
    ? {
        title: fm.jumbo.title ?? "",
        excerpt: fm.jumbo.excerpt ?? "",
        content: fm.jumbo.content ?? "",
        html: {
          excerpt: fm.jumbo.excerpt ? renderMarkdown(fm.jumbo.excerpt) : "",
          content: fm.jumbo.content ? renderMarkdown(fm.jumbo.content) : "",
        },
      }
    : null;

  const bodyHtml = content ? renderMarkdown(content) : "";

  return {
    route,
    jumbo,
    body: content,
    bodyHtml,
    seo: fm.seo,
  };
}
