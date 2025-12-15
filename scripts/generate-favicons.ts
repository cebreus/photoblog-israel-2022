import { promises as fs } from "fs";
import path from "path";
import { favicons, type FaviconOptions } from "favicons";
import matter from "gray-matter";
import { createLogger } from "./lib/logger";

const logger = createLogger("favicons");

type SiteConfig = {
  sourceFile: string;
  lang: string;
  manifestConfig: Partial<FaviconOptions>;
};

/**
 * Loads and validates the site-specific configuration from the corresponding site.md file.
 * @param contentDir The directory of the content to be processed.
 * @returns A validated configuration object.
 * @throws An error if the config file or any required keys are missing.
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
    throw new Error(
      `Config error: 'favicon' key is missing in ${siteConfigPath}.`,
    );
  }
  if (!data.manifest) {
    throw new Error(
      `Config error: 'manifest' key is missing in ${siteConfigPath}.`,
    );
  }
  if (!data.meta?.lang) {
    throw new Error(
      `Config error: 'meta.lang' key is missing in ${siteConfigPath}.`,
    );
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
 * Main function to generate favicons based on explicit configuration.
 */
async function run() {
  logger.info("Starting favicon generation...");

  const contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    throw new Error(
      "'CONTENT_DIR' environment variable is not set. Please specify which content to process.",
    );
  }
  logger.info(`Using content directory: ${contentDir}`);

  const config = await loadSiteConfig(contentDir);
  logger.info(
    `Using source file: ${path.relative(process.cwd(), config.sourceFile)}`,
  );

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
    // @ts-ignore
    appleMobileWebAppCapable: false, // Disable deprecated tag
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
  logger.info(
    `Wrote manifest files to ${path.relative(process.cwd(), assetsOutDir)}`,
  );

  const tempFaviconHtmlPath = path.join(tempDir, "favicons.html");
  function filterOutIco(htmlLine: string) {
    return !htmlLine.includes('favicon.ico"');
  }

  const finalHtml = response.html.filter(filterOutIco).join("\n");
  await fs.writeFile(tempFaviconHtmlPath, finalHtml);
  logger.info(`Wrote temporary favicons.html to ${tempFaviconHtmlPath}`);

  logger.info("Favicons generated successfully.");
}

async function executeRun(): Promise<void> {
  try {
    await run();
  } catch (e: any) {
    logger.error("An error occurred during favicon generation.", {
      error: e?.message ?? e,
    });
    process.exit(1);
  }
}

executeRun();
