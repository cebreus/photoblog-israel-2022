import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Connect, ResolvedConfig, ViteDevServer } from "vite";

/**
 * Vite plugin to serve gallery-specific assets at root paths.
 * 
 * During development, this plugin intercepts requests for assets like
 * /favicon.ico and /assets/share/open-graph.png and serves them from
 * the gallery-specific static folder (static-<gallery>/).
 * 
 * This allows each gallery to have its own favicons and share assets
 * without needing to copy them to static root.
 */
export function galleryAssetsPlugin(): any {
    let contentDir: string;

    return {
        name: "gallery-assets",

        configResolved(config: ResolvedConfig) {
            contentDir = process.env.CONTENT_DIR || "egypt-2025";
        },

        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
                const url = req.url;
                if (!url) return next();

                // Paths to redirect to gallery-specific folder
                const redirectPaths = [
                    "/favicon.ico",
                    "/assets/favicons/",
                    "/assets/share/",
                    "/assets/avatars/",
                    "/faces/",
                ];

                const isApiFace = url.startsWith("/api/people/faces/");
                const isApiAvatar = url.startsWith("/api/people/assets/avatars/");
                const isDirectRedirect = redirectPaths.some((prefix) => url.startsWith(prefix));

                if (isApiFace || isApiAvatar || isDirectRedirect) {
                    try {
                        let relativePath = url.split("?")[0];

                        // Map API paths to gallery static folder paths
                        if (isApiFace) {
                            relativePath = relativePath.replace("/api/people/faces/", "faces/");
                        } else if (isApiAvatar) {
                            relativePath = relativePath.replace("/api/people/assets/avatars/", "assets/avatars/");
                        }

                        const galleryPath = path.join(
                            process.cwd(),
                            `static-${contentDir}`,
                            relativePath
                        );

                        const file = await readFile(galleryPath);

                        // Set appropriate content type
                        const ext = path.extname(relativePath).toLowerCase();
                        if (ext === ".png") {
                            res.setHeader("Content-Type", "image/png");
                        } else if (ext === ".ico") {
                            res.setHeader("Content-Type", "image/x-icon");
                        } else if (ext === ".svg") {
                            res.setHeader("Content-Type", "image/svg+xml");
                        } else if (ext === ".webp") {
                            res.setHeader("Content-Type", "image/webp");
                        } else if (ext === ".jpg" || ext === ".jpeg") {
                            res.setHeader("Content-Type", "image/jpeg");
                        }

                        res.end(file);
                        return;
                    } catch (e) {
                        // File not found in gallery folder, continue to next middleware
                    }
                }

                next();
            });
        },
    };
}
