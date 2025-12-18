import { intro, select } from "@clack/prompts";
import { type FaviconOptions, favicons } from "favicons";
import { promises as fs } from "fs";
import matter from "gray-matter";
import path from "path";
import { createLogger } from "./lib/logger";

const logger = createLogger("favicons");

type SiteConfig = {
  sourceFile: string;
  lang: string;
  manifestConfig: Partial<FaviconOptions>;
};
/**
 * Loads the site configuration from site.md, including favicon source and manifest settings.
 */
async function loadSiteConfig(contentDir: string): Promise<SiteConfig> {
  const sourceDirPath = path.resolve("content", contentDir);
  const siteConfigPath = path.join(sourceDirPath, "site.md");

  let siteConfigFile: string;
  try {
    siteConfigFile = await fs.readFile(siteConfigPath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read site config at ${siteConfigPath}. Please ensure the file exists.`,
    );
  }

  const { data } = matter(siteConfigFile);

  if (!data.favicon) {
    throw new Error(`Config error: 'favicon' key is missing in ${siteConfigPath}.`);
  }
  if (!data.manifest) {
    throw new Error(`Config error: 'manifest' key is missing in ${siteConfigPath}.`);
  }
  if (!data.meta?.lang) {
    throw new Error(`Config error: 'meta.lang' key is missing in ${siteConfigPath}.`);
  }

  const sourceFile = path.join(sourceDirPath, data.favicon);
  try {
    await fs.access(sourceFile);
  } catch (error) {
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
/**
 * Generates favicons and associated manifest files based on site configuration.
 */
async function run() {
  intro("✨ Favicon Generator");

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

  logger.info(`Using content directory: ${contentDir}`);

  const config = await loadSiteConfig(contentDir);
  logger.info(`Using source file: ${path.relative(process.cwd(), config.sourceFile)}`);

  const staticDir = `static/${contentDir}`;
  const assetsOutDir = path.resolve(staticDir, "assets", "favicons");
  const tempDir = ".temp";

  await fs.mkdir(assetsOutDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });

  // The only values the script now defines are the dynamic path and ensuring logging is off.
  // All other settings MUST come from the site.md manifest config.
  const configuration: Partial<FaviconOptions> = {
    ...config.manifestConfig,
    path: `/${contentDir}/assets/favicons/`,
    lang: config.lang,
  };

  const response = await favicons(config.sourceFile, configuration);

  // Handle favicon.ico separately
  function isFaviconIco(image: { name: string }) {
    return image.name === "favicon.ico";
  }

  const faviconIco = response.images.find(isFaviconIco);
  let imagesToWrite = response.images;
  if (faviconIco) {
    const faviconIcoPath = path.resolve(staticDir, "favicon.ico");
    await fs.writeFile(faviconIcoPath, faviconIco.contents);
    logger.info(`Wrote ${path.relative(process.cwd(), faviconIcoPath)}`);

    // Remove the favicon.ico from the images array so it's not written twice
    function isNotFavicon(image: { name: string }) {
      return image.name !== "favicon.ico";
    }
    imagesToWrite = response.images.filter(isNotFavicon);
  }

  function writeImage(image: { name: string; contents: any }) {
    return fs.writeFile(path.join(assetsOutDir, image.name), image.contents);
  }
  await Promise.all(imagesToWrite.map(writeImage));
  logger.info(`Wrote images to ${path.relative(process.cwd(), assetsOutDir)}`);

  function writeFile(file: { name: string; contents: any }) {
    return fs.writeFile(path.join(assetsOutDir, file.name), file.contents);
  }

  await Promise.all(response.files.map(writeFile));
  logger.info(`Wrote manifest files to ${path.relative(process.cwd(), assetsOutDir)}`);

  const tempFaviconHtmlPath = path.join(tempDir, "favicons.html");
  function filterOutIco(htmlLine: string) {
    return !htmlLine.includes('favicon.ico"');
  }

  const finalHtml = response.html.filter(filterOutIco).join("\n");
  await fs.writeFile(tempFaviconHtmlPath, finalHtml);
  logger.info(`Wrote temporary favicons.html to ${tempFaviconHtmlPath}`);

  logger.info("Favicons generated successfully.");
}
/**
 * Executes the favicon generation process and handles any errors.
 */
async function executeRun(): Promise<void> {
  try {
    await run();
  } catch (e: any) {
    logger.error(`An error occurred during favicon generation: ${e?.message ?? e}`);
    if (e?.stack) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

executeRun();
