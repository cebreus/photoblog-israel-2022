import { select } from "@clack/prompts";
import fsp from "node:fs/promises";
import path from "node:path";

const CONTENT_ROOT = path.resolve("content");
const DEFAULT_GALLERY = "egypt-2025";

// NEW: Function to validate gallery names
function isValidGalleryName(name: string): boolean {
	// Allow only alphanumeric, hyphens, and underscores. Prevents '..' and '/'.
	return /^[a-zA-Z0-9_-]+$/.test(name);
}

// NEW: Canonicalize and verify path stays within a safe root
function getSafeGalleryPath(galleryName: string): string {
	if (!isValidGalleryName(galleryName)) {
		throw new Error(
			`Invalid gallery name "${galleryName}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
		);
	}
	const fullPath = path.join(CONTENT_ROOT, galleryName);
	const resolvedPath = path.resolve(fullPath);

	// Ensure the resolved path is a child of the CONTENT_ROOT
	if (!resolvedPath.startsWith(CONTENT_ROOT + path.sep) && resolvedPath !== CONTENT_ROOT) {
		throw new Error(`Attempted path traversal with gallery name "${galleryName}".`);
	}

	return galleryName;
}

function isDirectory(entry: { isDirectory(): boolean }) {
	return entry.isDirectory();
}

function extractName(entry: { name: string }) {
	return entry.name;
}

function createSelectOption(galleryName: string) {
	return { value: galleryName, label: galleryName };
}

async function listAvailableGalleries(): Promise<string[]> {
	const entries = await fsp.readdir(CONTENT_ROOT, { withFileTypes: true });
	// Filter for valid directory names
	return entries.filter((e) => isDirectory(e) && isValidGalleryName(e.name)).map(extractName);
}

export async function resolveGalleryDirectory(): Promise<string> {
	const fromEnvironment = process.env.CONTENT_DIR;
	if (fromEnvironment) {
		// Validate from environment variable
		return getSafeGalleryPath(fromEnvironment);
	}

	const galleries = await listAvailableGalleries();

	if (galleries.length === 0) {
		throw new Error("No valid galleries found in content directory");
	}

	if (galleries.length === 1) {
		return getSafeGalleryPath(galleries[0]);
	}

	const selected = await select({
		message: "Select gallery:",
		options: galleries.map(createSelectOption),
		initialValue: DEFAULT_GALLERY,
	});

	if (typeof selected !== "string") {
		process.exit(0);
	}

	// Final validation on selected gallery
	return getSafeGalleryPath(selected);
}

export { listAvailableGalleries };
