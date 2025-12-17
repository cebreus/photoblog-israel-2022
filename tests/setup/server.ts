import { vi } from "vitest";

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
    euclideanDistance: (a: any, b: any) => 0,
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
