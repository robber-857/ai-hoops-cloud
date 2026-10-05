import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  stateSetters: [] as Array<ReturnType<typeof vi.fn>>,
}));

// Exercise hook initialization and cleanup without downloading CDN assets in Node.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const setter = vi.fn();
    hooks.stateSetters.push(setter);
    return [initial, setter];
  },
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => (() => void) | void) => { hooks.effects.push(effect); },
}));

type Script = {
  src: string;
  crossOrigin: string;
  onload: (() => void) | null;
  onerror: ((error: Error) => void) | null;
  remove: () => void;
};

let scripts: Script[];
let mountedScripts: Script[];
let instances: Array<{ setOptions: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>;
let browser: Record<string, unknown>;

async function flushInitialization() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

function load(script: Script) {
  if (script.src.includes("drawing_utils")) {
    browser.drawConnectors = vi.fn();
    browser.drawLandmarks = vi.fn();
  } else {
    browser.Pose = class {
      setOptions = vi.fn();
      close = vi.fn();
      constructor() { instances.push(this); }
    };
    browser.POSE_CONNECTIONS = [[0, 1]];
  }
  script.onload?.();
}

beforeEach(() => {
  vi.resetModules();
  scripts = [];
  mountedScripts = [];
  instances = [];
  browser = {};
  hooks.effects = [];
  hooks.stateSetters = [];
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    querySelector: (selector: string) => mountedScripts.find((script) => selector.includes(script.src)),
    createElement: () => {
      const script: Script = { src: "", crossOrigin: "", onload: null, onerror: null,
        remove: () => { mountedScripts = mountedScripts.filter((item) => item !== script); } };
      scripts.push(script);
      return script;
    },
    body: { appendChild: (script: Script) => { mountedScripts.push(script); } },
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared MediaPipe script loading", () => {
  it("waits for both scripts once when canvas and analyzer initialize concurrently", async () => {
    const { useMediaPipePose } = await import("@/hooks/useMediaPipePose");
    useMediaPipePose();
    const cleanupCanvas = hooks.effects.pop()!();
    useMediaPipePose();
    const cleanupAnalyzer = hooks.effects.pop()!();
    expect(scripts).toHaveLength(2);
    expect(instances).toHaveLength(0);
    load(scripts[0]);
    await flushInitialization();
    expect(instances).toHaveLength(0);
    load(scripts[1]);
    await flushInitialization();
    expect(instances).toHaveLength(2);
    expect(hooks.stateSetters[0]).toHaveBeenCalledWith(true);
    expect(hooks.stateSetters[2]).toHaveBeenCalledWith(true);
    cleanupCanvas?.();
    expect(instances[0].close).toHaveBeenCalledOnce();
    expect(instances[1].close).not.toHaveBeenCalled();
    cleanupAnalyzer?.();
    expect(instances[1].close).toHaveBeenCalledOnce();
  });

  it("removes a failed script and retries it on the next analysis mount", async () => {
    const { useMediaPipePose } = await import("@/hooks/useMediaPipePose");
    useMediaPipePose();
    const cleanup = hooks.effects.pop()!();
    load(scripts[0]);
    scripts[1].onerror?.(new Error("temporary CDN failure"));
    await flushInitialization();
    expect(hooks.stateSetters[1]).toHaveBeenCalledWith(expect.stringContaining("temporary CDN failure"));
    expect(mountedScripts).toHaveLength(1);
    cleanup?.();
    useMediaPipePose();
    const cleanupRetry = hooks.effects.pop()!();
    expect(scripts).toHaveLength(3);
    load(scripts[2]);
    await flushInitialization();
    expect(instances).toHaveLength(1);
    expect(hooks.stateSetters[2]).toHaveBeenCalledWith(true);
    cleanupRetry?.();
  });

  it("does not create or update an unmounted consumer when shared scripts finish", async () => {
    const { useMediaPipePose } = await import("@/hooks/useMediaPipePose");
    useMediaPipePose();
    const cleanupCancelled = hooks.effects.pop()!();
    cleanupCancelled?.();
    useMediaPipePose();
    const cleanupActive = hooks.effects.pop()!();
    scripts.forEach(load);
    await flushInitialization();
    expect(instances).toHaveLength(1);
    expect(hooks.stateSetters[0]).not.toHaveBeenCalled();
    expect(hooks.stateSetters[1]).not.toHaveBeenCalled();
    expect(hooks.stateSetters[2]).toHaveBeenCalledWith(true);
    cleanupActive?.();
  });
});
