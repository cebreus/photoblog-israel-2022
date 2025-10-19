import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { getManifest, type Manifest, type ManifestEntry } from './images';

const CONTENT_DIR = '../content/israel-2022';

export interface ContentItem extends ManifestEntry {
  id: string;
  slug: string;
  isIntro: boolean;
  content: string;
  title: string;
  date: string;
}

let contentCache: ContentItem[];

export async function loadContent(options: { bestOf?: boolean } = {}): Promise<ContentItem[]> {
  if (contentCache && !options.bestOf) {
    return contentCache;
  }

  const manifest = getManifest();
  const mdFilesPaths = await fg(path.join(CONTENT_DIR, '*.md'));

  const markdownContentMap = new Map<string, { data: any; content: string }>();
  for (const mdFilePath of mdFilesPaths) {
    const fileName = path.basename(mdFilePath, '.md');
    const fileContent = await fs.readFile(mdFilePath, 'utf-8');
    const { data, content } = matter(fileContent);
    markdownContentMap.set(fileName, { data, content });
  }

  const items: ContentItem[] = [];

  // Add intro/general narrative if available (e.g., from a specific date-based markdown)
  const introMarkdown = markdownContentMap.get('2022-20-20'); // Assuming this is the intro markdown
  if (introMarkdown) {
    items.push({
      // Default ManifestEntry properties (can be empty or placeholder if no image)
      original: { width: null, height: null, format: null, bytes: 0, path: null },
      variants: {},
      placeholder: null,
      color: null,
      hash: '',
      outputs: [],
      // ContentItem specific properties
      id: 'intro',
      slug: 'intro',
      isIntro: true,
      content: introMarkdown.content,
      title: introMarkdown.data.title || 'Israel 2022',
      date: introMarkdown.data.date || '2022-01-01',
    });
  }

  for (const imageKey in manifest) {
    const imageEntry = manifest[imageKey];
    const baseSlug = path.basename(imageKey, path.extname(imageKey)); // e.g., IMG_0792

    // Try to find a markdown entry that matches the image key or a date within it
    let matchingMarkdown = null;
    // For now, we don't have date in ManifestEntry, so direct filename match is hard
    // If imageKey contains a date, we could try to match that, but it's not explicit.

    // Default values if no specific markdown is found for this image
    let content = '';
    let title = baseSlug.replace(/[_-]+/g, ' ');
    let date = '2022-01-01'; // Placeholder date

    // If there's a markdown file with the same base name as the image, use it
    const imageSpecificMarkdown = markdownContentMap.get(baseSlug);
    if (imageSpecificMarkdown) {
      matchingMarkdown = imageSpecificMarkdown;
    }

    if (matchingMarkdown) {
      content = matchingMarkdown.content;
      title = matchingMarkdown.data.title || title;
      date = matchingMarkdown.data.date || date;
    }

    if (options.bestOf && !matchingMarkdown?.data.keywords?.includes('prio2')) {
      // If bestOf is requested, and this item doesn't have 'prio2' keyword, skip it
      continue;
    }

    items.push({
      ...imageEntry,
      id: baseSlug,
      slug: baseSlug,
      isIntro: false,
      content,
      title,
      date,
    });
  }

  // Sort by date, then by slug
  items.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return a.slug.localeCompare(b.slug);
  });

  if (!options.bestOf) {
    contentCache = items;
  }

  return items;
}