import fg from "fast-glob";
import { spawn, spawnSync } from "node:child_process";
import { vi } from "vitest";

// Polyfill Bun global for Node.js test environment
// Polyfill Bun global for Node.js test environment
if (typeof globalThis.Bun === "undefined") {
  (globalThis as any).Bun = {
    file: function filePolyfill(path: string) {
      return {
        exists: async function exists() {
          const fs = await import("node:fs");
          return fs.default.existsSync(path);
        },
        text: async function text() {
          const fs = await import("node:fs/promises");
          return fs.default.readFile(path, "utf-8");
        },
        json: async function json() {
          const fs = await import("node:fs/promises");
          const content = await fs.default.readFile(path, "utf-8");
          return JSON.parse(content);
        },
        arrayBuffer: async function arrayBuffer() {
          const fs = await import("node:fs/promises");
          const buffer = await fs.default.readFile(path);
          return buffer.buffer;
        },
        stream: function stream() {
          const { Readable } = require("node:stream");
          const fs = require("node:fs");
          return Readable.toWeb(fs.createReadStream(path));
        },
      };
    },
    write: async function write(path: string, data: any) {
      const fs = await import("node:fs/promises");
      const pathMod = require("node:path");
      await fs.default.mkdir(pathMod.dirname(path), {
        recursive: true,
      });
      return fs.default.writeFile(path, data);
    },
    spawn: function spawnPolyfill(args: string[], opts: any) {
      const proc = spawn(args[0], args.slice(1), opts);
      return {
        exited: new Promise(function wait(resolve) {
          proc.on("exit", resolve);
        }),
        stdout: proc.stdout,
        stderr: proc.stderr,
      };
    },
    spawnSync: function spawnSyncPolyfill(args: string[], opts: any) {
      return spawnSync(args[0], args.slice(1), opts);
    },
    Glob: (function createGlobClass() {
      function Glob(this: any, pattern: string) {
        this.pattern = pattern;
      }
      Glob.prototype.scan = async function* scan(opts: any) {
        const files = await fg(this.pattern, { ...opts, onlyFiles: true });
        for (const f of files) {
          yield f;
        }
      };
      return Glob;
    })(),
    env: process.env,
  };
}

// Mock SvelteKit environment
vi.mock("$app/environment", function mockEnv() {
  return {
    dev: true,
    browser: false,
    building: false,
  };
});

// Mock SvelteKit navigation
vi.mock("$app/navigation", function mockNav() {
  return {
    goto: vi.fn(),
    invalidate: vi.fn(),
    prefetch: vi.fn(),
    prefetchRoutes: vi.fn(),
  };
});

// Mock tfjs-node to avoid requiring native addon in test env
vi.mock("@tensorflow/tfjs-node", function mockTfjs() {
  function tidy(fn: any) {
    return fn();
  }
  function tensor() {
    return {
      dispose: function dispose() {},
    };
  }
  return {
    backend: {
      set: function setBackend() {},
    },
    tensor: tensor,
    tidy: tidy,
    setBackend: vi.fn(),
    getBackend: function getBackend() {
      return "cpu";
    },
    ready: async function ready() {},
  };
});

// Minimal stub of face-api to prevent native model loads in unit tests
vi.mock("@vladmandic/face-api", function mockFaceApi() {
  const fakeNet = {
    loadFromDisk: async function load() {},
    isLoaded: true,
  };

  return {
    env: {
      monkeyPatch: function monkey() {},
    },
    nets: {
      ssdMobilenetv1: fakeNet,
      faceLandmark68Net: fakeNet,
      faceRecognitionNet: fakeNet,
    },
    SsdMobilenetv1Options: function SsdOptions() {},
    detectAllFaces: async function detect() {
      return [];
    },
    euclideanDistance: function distance(_a: any, _b: any) {
      return 0;
    },
    resizeResults: function resize(res: any) {
      return res;
    },
    default: {},
  };
});

// Mock node-canvas to avoid native bindings in test env
vi.mock("canvas", function mockCanvas() {
  function Canvas(this: any) {
    this.width = 0;
    this.height = 0;
    this.getContext = function getContext() {
      return {
        drawImage: function draw() {},
        getImageData: function data() {
          return { data: [] };
        },
      };
    };
  }

  function ImageData(this: any, data: any, width: number, height: number) {
    this.data = new Uint8ClampedArray(data);
    this.width = width;
    this.height = height;
  }

  function Image() {}

  return {
    Canvas,
    createCanvas: function create() {
      return new (Canvas as any)();
    },
    loadImage: async function load(_: any) {
      return { width: 0, height: 0 };
    },
    Image: Image,
    ImageData,
  };
});

const mockLogger = function createMockLogger(label: string) {
  const level = process.env.LOG_LEVEL || "error";
  const pino = require("pino");
  const logger = pino({
    level: level,
    enabled: level !== "error",
    base: { label },
    customLevels: { verbose: 25 },
  });

  return {
    info: vi.fn(function info(...args) {
      return logger.info(...args);
    }),
    error: vi.fn(function error(...args) {
      return logger.error(...args);
    }),
    warn: vi.fn(function warn(...args) {
      return logger.warn(...args);
    }),
    debug: vi.fn(function debug(...args) {
      return logger.debug(...args);
    }),
    verbose: vi.fn(function verbose(...args) {
      return logger.verbose(...args);
    }),
    fatal: vi.fn(function fatal(...args) {
      return logger.fatal(...args);
    }),
    trace: vi.fn(function trace(...args) {
      return logger.trace(...args);
    }),
    silent: false,
    level: level,
  };
};

vi.mock("../../scripts/lib/logger", function mockLoggerLib() {
  return {
    createLogger: function create(label: string) {
      return mockLogger(label);
    },
  };
});

vi.mock("$lib/logger", function mockLibLogger() {
  return {
    createLogger: function create(label: string) {
      return mockLogger(label);
    },
    log: mockLogger("app"),
  };
});
