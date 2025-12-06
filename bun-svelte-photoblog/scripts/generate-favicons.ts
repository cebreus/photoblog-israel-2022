import { promises as fs } from "fs";
import path from "path";
import { favicons, type FaviconOptions } from "favicons";
import matter from "gray-matter";

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
      `[favicon-gen] Failed to read site config at ${siteConfigPath}. Please ensure the file exists.`,
    );
  }

  const { data } = matter(siteConfigFile);

  if (!data.favicon) {
    throw new Error(
      `[favicon-gen] Config error: 'favicon' key is missing in ${siteConfigPath}.`,
    );
  }
  if (!data.manifest) {
    throw new Error(
      `[favicon-gen] Config error: 'manifest' key is missing in ${siteConfigPath}.`,
    );
  }
  if (!data.meta?.lang) {
    throw new Error(
      `[favicon-gen] Config error: 'meta.lang' key is missing in ${siteConfigPath}.`,
    );
  }

  const sourceFile = path.join(sourceDirPath, data.favicon);
  try {
    await fs.access(sourceFile);
  } catch (error) {
    throw new Error(
      `[favicon-gen] Source file not found at path: ${sourceFile}. Please check the 'favicon' path in ${siteConfigPath}.`,
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
  console.log("[favicon-gen] Starting favicon generation...");

  const contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    throw new Error(
      "[favicon-gen] 'CONTENT_DIR' environment variable is not set. Please specify which content to process.",
    );
  }
  console.log(`[favicon-gen] Using content directory: ${contentDir}`);

  const config = await loadSiteConfig(contentDir);
  console.log(`[favicon-gen] Using source file: ${config.sourceFile}`);

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
    logging: false, // Force logging off as we do our own.
  };

  try {
    const response = await favicons(config.sourceFile, configuration);

    // Handle favicon.ico separately
    const faviconIco = response.images.find(
      (image) => image.name === "favicon.ico",
    );
    if (faviconIco) {
      const faviconIcoPath = path.resolve(staticDir, "favicon.ico");
      await fs.writeFile(faviconIcoPath, faviconIco.contents);
      console.log(`[favicon-gen] Wrote ${faviconIcoPath}`);

      // Remove the favicon.ico from the images array so it's not written twice
      response.images = response.images.filter(
        (image) => image.name !== "favicon.ico",
      );
    }

    await Promise.all(
      response.images.map((image) =>
        fs.writeFile(path.join(assetsOutDir, image.name), image.contents),
      ),
    );
    console.log(`[favicon-gen] Wrote images to ${assetsOutDir}`);

    await Promise.all(
      response.files.map((file) =>
        fs.writeFile(path.join(assetsOutDir, file.name), file.contents),
      ),
    );
    console.log(`[favicon-gen] Wrote manifest files to ${assetsOutDir}`);

    const tempFaviconHtmlPath = path.join(tempDir, "favicons.html");
    const finalHtml = response.html
      .filter((htmlLine) => !htmlLine.includes('favicon.ico"'))
      .join("\n");
    await fs.writeFile(tempFaviconHtmlPath, finalHtml);
    console.log(
      `[favicon-gen] Wrote temporary favicons.html to ${tempFaviconHtmlPath}`,
    );

    console.log("[favicon-gen] Favicons generated successfully.");
  } catch (error) {
    console.error("[favicon-gen] Error during favicon generation:", error);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
