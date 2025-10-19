import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

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
  seo?: PageFrontMatter['seo'];
};

const CONTENT_ROOT = path.resolve(process.cwd(), 'content/pages');

/**
 * Načtení markdownu pro danou stránku a převod vybraných částí na HTML.
 * Očekává soubor content/pages/<route>/index.md
 */
export async function loadPage(route: string): Promise<PageData> {
  const file = path.join(CONTENT_ROOT, route, 'index.md');
  const raw = await fs.readFile(file, 'utf8');
  const { data, content } = matter(raw);
  const fm = (data || {}) as PageFrontMatter;

  const jumbo = fm.jumbo
    ? {
      title: fm.jumbo.title ?? '',
      excerpt: fm.jumbo.excerpt ?? '',
      content: fm.jumbo.content ?? '',
      html: {
        excerpt: fm.jumbo.excerpt ? marked.parse(fm.jumbo.excerpt) as string : '',
        content: fm.jumbo.content ? marked.parse(fm.jumbo.content) as string : '',
      },
    }
    : null;

  const bodyHtml = content ? (marked.parse(content) as string) : '';

  return {
    route,
    jumbo,
    body: content,
    bodyHtml,
    seo: fm.seo,
  };
}
