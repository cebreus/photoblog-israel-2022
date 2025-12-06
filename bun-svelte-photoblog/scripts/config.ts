// bun-svelte-photoblog/scripts/config.ts

/**
 * Centrální konfigurační soubor pro skript na generování obrázků.
 * Definuje cesty, varianty obrázků, kvalitu a další parametry.
 */

// Read content directory from environment variable, with a default
const contentDir = process.env.CONTENT_DIR || "israel-2022";
console.log(`Using content directory: ${contentDir}`);

export const config = {
  // --- Cesty ---
  paths: {
    source: `content/${contentDir}`,
    output: `static/${contentDir}/images`, // Generated images go into a subfolder of 'static'
    urlPrefix: `/${contentDir}`, // The URL prefix will be the content directory name
    manifest: "src/lib/images.manifest.json",
    cache: `.temp/images-${contentDir}.cache.json`,
    tmp: ".temp",
  },

  // --- Konfigurace variant pro <picture> element ---
  // Klíče odpovídají logickým breakpointům.
  variants: {
    default: {
      media: "(max-width: 575px), (min-width: 1400px)",
      resize: { width: 370, height: 208, crop: true },
      folderName: "previews", // Adresář pro JPEG variantu
    },
    xl: {
      media: "(min-width: 576px) and (max-width: 1399px)",
      resize: { width: 534, height: 300, crop: true },
      folderName: "previews-xl", // Adresář pro JPEG variantu
    },
  },

  // --- Ostatní generované soubory, které nejsou součástí <picture> ---
  otherOutputs: {
    detail: {
      resize: { width: 1280 },
      format: "jpeg", // Pouze JPEG pro detailní zobrazení
      folderName: "details",
    },
    fallback: {
      resize: { width: 190, height: 107, crop: true },
      folderName: "previews-xxs",
    },
    placeholder: {
      resize: { width: 24 },
      blur: true, // Aplikovat rozmazání
      format: "png", // Cílový formát pro placeholder
      folderName: "blurs",
    },
  },

  // --- Parametry kvality a enkódování ---
  encoding: {
    formats: ["webp", "jpeg", "avif"], // Formáty pro <picture>
    quality: {
      jpeg: 80,
      webp: 65,
      avif: 50, // Moderní formát s nejlepší kompresí
    },
    // Optimalizační parametry pro Sharp.js
    sharp: {
      jpeg: {
        progressive: true,
        mozjpeg: false,
        chromaSubsampling: "4:2:0",
      },
      webp: {
        effort: 4,
      },
      avif: {
        effort: 5,
        chromaSubsampling: "4:2:0",
      },
      // Parametry pro placeholder (blur)
      blur: {
        png: {
          palette: true,
          colors: 32,
          quality: 50,
          compressionLevel: 9,
        },
      },
    },
  },

  // --- Parametry chování skriptu ---
  script: {
    concurrency: "auto" as "auto" | number, // 'auto' nebo pevný počet (např. 4)
    limit: 0, // Limit pro počet zpracovaných souborů (0 = bez limitu,
    // užitečné pro testování)
  },
};
