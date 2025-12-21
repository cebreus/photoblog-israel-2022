import { spawn, spawnSync } from "node:child_process";
import fg from "fast-glob";
import { vi } from "vitest";
import winston from "winston";

// Polyfill Bun global for Node.js test environment
if (typeof globalThis.Bun === "undefined") {
  (globalThis as any).Bun = {
    file: (path: string) => ({
      exists: async () => (await import("node:fs")).default.existsSync(path),
      text: async () => (await import("node:fs/promises")).default.readFile(path, "utf-8"),
      json: async () =>
        JSON.parse(await (await import("node:fs/promises")).default.readFile(path, "utf-8")),
      arrayBuffer: async () =>
        (await (await import("node:fs/promises")).default.readFile(path)).buffer,
      stream: () => {
        const { Readable } = require("node:stream");
        return Readable.toWeb(require("node:fs").createReadStream(path));
      },
    }),
    write: async (path: string, data: any) => {
      await (await import("node:fs/promises")).default.mkdir(require("node:path").dirname(path), {
        recursive: true,
      });
      return (await import("node:fs/promises")).default.writeFile(path, data);
    },
    spawn: (args: string[], opts: any) => {
      const proc = spawn(args[0], args.slice(1), opts);
      return {
        exited: new Promise((resolve) => proc.on("exit", resolve)),
        stdout: proc.stdout,
        stderr: proc.stderr,
      };
    },
    spawnSync: (args: string[], opts: any) => {
      return spawnSync(args[0], args.slice(1), opts);
    },
    Glob: class {
      pattern: string;
      constructor(pattern: string) {
        this.pattern = pattern;
      }
      async *scan(opts: any) {
        const files = await fg(this.pattern, { ...opts, onlyFiles: true });
        for (const f of files) {
          yield f;
        }
      }
    },
    env: process.env,
  };
}

// Mock SvelteKit environment
vi.mock("$app/environment", () => ({
  dev: true,
  browser: false,
}));

// Mock SvelteKit navigation
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  prefetch: vi.fn(),
  prefetchRoutes: vi.fn(),
}));

// Mock tfjs-node to avoid requiring native addon in test env
vi.mock("@tensorflow/tfjs-node", () => {
  // Provide a minimal interface used by face-api; tests that need tf functionality should mock more precisely
  return {
    // Common functions used by @vladmandic/face-api initialization
    backend: {
      set: () => {},
    },
    // Minimal tensor and tidy placeholders
    tensor: () => ({ dispose: () => {} }),
    tidy: (fn: any) => fn(),
    // stub other frequently accessed members
    setBackend: vi.fn(),
    getBackend: () => "cpu",
    ready: async () => {},
  };
});

// Minimal stub of face-api to prevent native model loads in unit tests
vi.mock("@vladmandic/face-api", () => {
  const fakeNet = {
    loadFromDisk: async () => {},
    isLoaded: true,
  };

  return {
    env: {
      monkeyPatch: () => {},
    },
    nets: {
      ssdMobilenetv1: fakeNet,
      faceLandmark68Net: fakeNet,
      faceRecognitionNet: fakeNet,
    },
    SsdMobilenetv1Options: class {},
    detectAllFaces: async () => [],
    euclideanDistance: (_a: any, _b: any) => 0,
    resizeResults: (res: any) => res,
    // Ensure CommonJS/ESM compatibility
    default: {},
  };
});

// Mock node-canvas to avoid native bindings in test env
vi.mock("canvas", () => {
  const Canvas = class {
    width = 0;
    height = 0;
    getContext() {
      return {
        drawImage: () => {},
        getImageData: () => ({ data: [] }),
      } as any;
    }
  };

  class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: any, width: number, height: number) {
      this.data = new Uint8ClampedArray(data);
      this.width = width;
      this.height = height;
    }
  }

  return {
    Canvas,
    createCanvas: () => new Canvas(),
    loadImage: async (_: any) => ({ width: 0, height: 0 }),
    Image: class {},
    ImageData,
  };
});

vi.mock("../../scripts/lib/logger", () => {
  const level = process.env.LOG_LEVEL || "error";
  return {
    createLogger: (_label: string) => {
      return winston.createLogger({
        level: level,
        transports: [
          new winston.transports.Console({
            silent: level === "error",
          }),
        ],
      });
    },
  };
});
