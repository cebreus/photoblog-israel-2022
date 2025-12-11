import { json, type RequestHandler } from "@sveltejs/kit";
import fs from "node:fs/promises";
import path from "node:path";

// Normally we would import from a server logic file, but for now we inline.
// We need to resolve the source path.
// The main "content" directory is typically `content/` relative to project root.
// ImageEntry src is usually `/images/israel-2022/filename.jpg`.
// We need to map that back to the content directory.

export const DELETE: RequestHandler = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { ids } = await request.json();

  if (!ids || !Array.isArray(ids)) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  // Load manifest to find file paths
  // In a real app we might want to query a database or service.
  // Here we can read the manifest locally or cleaner: just trust the ID if it contains enough info,
  // currently ID is hash. We need the original path.
  // The 'src' property in ImageEntry often looks like /images/israel-2022/DSCF1234.jpg
  // The original file is at content/israel-2022/DSCF1234.jpg (or .HEIC etc)

  // We need to find the manifest to map IDs to filenames if possible,
  // OR the client sends the data we need.
  // The client `EditOffcanvas` has `selectedImages` which are `ImageEntry` objects.
  // Let's expect the client to send the `src` or `originalPath` if available.
  // `ImageEntry` has `src` (output path).
  // The original path isn't explicitly in `ImageEntry` sent to client in all cases,
  // but we can infer it or the client can send the filename.

  // Let's look at `scripts/generate-images.ts`. It reads from `content/israel-2022`.
  // The client sees `src` like `/images/israel-2022/img.jpg`.
  // We can try to map `/images/israel-2022/` -> `content/israel-2022/`.

  // However, the extension might differ (source .HEIC -> output .jpg).
  // This is tricky.
  // Ideally we should look up the ID in the full manifest?
  // Or just try to find the file with common extensions.

  // Let's ask the user to confirm deletion of specific filenames if possible.
  // But wait, the client knows the `id` and `src`.
  // Let's try to pass `src` from client.

  const contentRoot = path.resolve(process.cwd(), "content");
  const deleted = [];
  const errors = [];

  for (const item of ids) {
    // We expect item to be { id: string, src: string } or just the mapped path?
    // Let's assume the client sends the relative path in the content dir or we handle the mapping here.
    // Simpler: Client sends the `src` url path, e.g. `/images/israel-2022/FOO.jpg`
    // We strip `/images/` => `israel-2022/FOO.jpg`.
    // Then we look for that file in `content/`.
    // We might need to check multiple extensions if the source was HEIC.

    const srcPath = item.src; // e.g. /images/israel-2022/img.jpg
    if (!srcPath) continue;

    const relativePath = srcPath.replace(/^\/images\//, ""); // israel-2022/img.jpg
    const nameWithoutExt = path.parse(relativePath).name;
    const dir = path.dirname(relativePath); // israel-2022

    const fullDir = path.join(contentRoot, dir);

    // Find files with this name in the dir
    try {
      const files = await fs.readdir(fullDir);
      const candidates = files.filter(
        (f) => path.parse(f).name === nameWithoutExt,
      );

      if (candidates.length === 0) {
        errors.push(`File not found for ${relativePath}`);
        continue;
      }

      // Delete all candidates? (e.g. if we have RAW + JPG?)
      // Usually we only have one source.
      // Let's delete them all to be safe/thorough or just the one that matches logic?
      // Let's delete all matching the basename, as that's "the photo".

      for (const candidate of candidates) {
        await fs.unlink(path.join(fullDir, candidate));
        deleted.push(candidate);
      }
    } catch (e: any) {
      errors.push(`Error deleting ${relativePath}: ${e.message}`);
    }
  }

  if (deleted.length === 0 && errors.length > 0) {
    return json({ message: "Failed to delete files", errors }, { status: 500 });
  }

  return json({ success: true, deleted, errors });
};
