process.env.GLIB_LOG_LEVEL = "critical";

import { select } from "@clack/prompts";
import { type FaviconOptions, favicons } from "favicons";
import matter from "gray-matter";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "./lib/core/cli-logger";
import { parseCliArguments } from "./lib/core/cli-parser";
import { formatDuration } from "./lib/utils/time";

const logger = createLogger("favicons");

const options = parseCliArguments(process.argv.slice(2));
const values = options;

if (values.verbose) {
  logger.level = "verbose";
}

type SiteConfig = {
  sourceFile: string;
  lang: string;
  manifestConfig: Partial<FaviconOptions>;
};

async function loadSiteConfig(contentDir: string): Promise<SiteConfig> {
  const sourceDirPath = path.resolve("content", contentDir);
  const siteConfigPath = path.join(sourceDirPath, "site.md");

  let siteConfigFile: string;
  try {
    siteConfigFile = await fs.readFile(siteConfigPath, "utf8");
  } catch (_error) {
    throw new Error(
      `Failed to read site config at ${siteConfigPath}. Please ensure the file exists.`,
    );
  }

  const { data } = matter(siteConfigFile);

  if (!data.favicon) {
    throw new Error(`Config error: 'favicon' key is missing in ${siteConfigPath}.`);
  }
  if (typeof data.favicon !== "string") {
    throw new Error(`Config error: 'favicon' key is not a string in ${siteConfigPath}.`);
  }
  const safeFavicon = path.basename(data.favicon);

  if (!data.manifest) {
    throw new Error(`Config error: 'manifest' key is missing in ${siteConfigPath}.`);
  }
  // Although manifest itself is an object, if any of its internal paths were strings, they should be sanitized too.
  // For now, assuming manifest is an object that favicons library handles.

  if (!data.meta?.lang) {
    throw new Error(`Config error: 'meta.lang' key is missing in ${siteConfigPath}.`);
  }

  const sourceFile = path.join(sourceDirPath, safeFavicon);
  try {
    await fs.access(sourceFile);
  } catch (_error) {
    throw new Error(
      `Source file not found at path: ${sourceFile}. Please check the 'favicon' path in ${siteConfigPath}.`,
    );
  }

  return {
    sourceFile,
    lang: data.meta.lang,
    manifestConfig: data.manifest,
  };
}

async function run() {
  if (values.manifestOnly) {
    logger.info({ manifestOnly: true }, "Manifest-only mode: Skipping favicon generation.");
    return;
  }

  let contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    const contentDirRoot = path.resolve("content");
    const entries = await fs.readdir(contentDirRoot, { withFileTypes: true });
    const galleries = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    if (galleries.length === 0) {
      throw new Error("No galleries found");
    }

    if (galleries.length === 1) {
      contentDir = galleries[0];
    } else {
      const galleryId = await select({
        message: "Select a gallery to generate favicons for:",
        options: galleries.map((g) => ({ value: g, label: g })),
      });
      if (typeof galleryId !== "string") process.exit(0);
      contentDir = galleryId;
    }
  }

  logger.debug({ contentDir }, "Using content directory");

  const config = await loadSiteConfig(contentDir);
  logger.debug(
    { sourceFile: path.relative(process.cwd(), config.sourceFile) },
    "Using source file",
  );

  const staticDir = `static-${contentDir}`;
  const assetsOutDir = path.resolve(staticDir, "assets", "favicons");
  const tempDir = ".temp";

  if (values.clean) {
    if (values.verbose) logger.info({ assetsOutDir }, "Cleaning output directory");
    await fs.rm(assetsOutDir, { recursive: true, force: true });
  }

  await fs.mkdir(assetsOutDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });

  const configuration: Partial<FaviconOptions> = {
    ...config.manifestConfig,
    path: `/assets/favicons/`, // Absolute path for the website
    lang: config.lang,
  };

  logResourceUsage("favicons-before");
  const response = await favicons(config.sourceFile, configuration);
  logResourceUsage("favicons-after");

  function isFaviconIco(image: { name: string }) {
    return image.name === "favicon.ico";
  }

  const faviconIco = response.images.find(isFaviconIco);
  let imagesToWrite = response.images;
  if (faviconIco) {
    const faviconIcoPath = path.resolve(staticDir, "favicon.ico");
    await fs.writeFile(faviconIcoPath, faviconIco.contents);
    logger.debug({ path: path.relative(process.cwd(), faviconIcoPath) }, "Wrote favicon.ico");

    function isNotFavicon(image: { name: string }) {
      return image.name !== "favicon.ico";
    }
    imagesToWrite = response.images.filter(isNotFavicon);
  }

  function writeImage(image: { name: string; contents: any }) {
    return fs.writeFile(path.join(assetsOutDir, image.name), image.contents);
  }
  await Promise.all(imagesToWrite.map(writeImage));
  logger.debug({ path: path.relative(process.cwd(), assetsOutDir) }, "Wrote images");

  function writeFile(file: { name: string; contents: any }) {
    return fs.writeFile(path.join(assetsOutDir, file.name), file.contents);
  }

  await Promise.all(response.files.map(writeFile));
  logger.debug({ path: path.relative(process.cwd(), assetsOutDir) }, "Wrote manifest files");

  const tempFaviconHtmlPath = path.join(tempDir, "favicons.html");
  function filterOutIco(htmlLine: string) {
    return !htmlLine.includes('favicon.ico"');
  }

  const finalHtml = response.html
    .filter(filterOutIco)
    .map((line) => {
      if (line.includes("apple-mobile-web-app-capable")) {
        return `${line}\n${line.replace("apple-mobile-web-app-capable", "mobile-web-app-capable")}`;
      }
      return line;
    })
    .join("\n");
  await fs.writeFile(tempFaviconHtmlPath, finalHtml);
  logger.debug({ path: tempFaviconHtmlPath }, "Wrote temporary favicons.html");

  logger.info({ success: true }, "Favicons generated successfully.");
}

async function executeRun(): Promise<void> {
  const startTime = performance.now();
  try {
    await run();
    const duration = formatDuration(performance.now() - startTime);
    logger.info({ duration }, `Total time: ${duration}`);
  } catch (e: any) {
    logger.error({ err: e }, "An error occurred during favicon generation");
    if (e?.stack) {
      logger.error({ stack: e.stack }, "Stack trace");
    }
    process.exit(1);
  }
}

executeRun();
