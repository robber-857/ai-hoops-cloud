import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTemplateById } from "@/config/templates";
import { calculateTrainingTemplateContentHash } from "@/lib/trainingTemplateCatalog";
import type { CompletedUploadSession } from "@/services/uploads";
import type { ReportRead, SaveReportPayload } from "@/services/reports";
import { pushupFrames } from "./trainingFixtures";

const runtime = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as Array<{ value?: unknown; dependencies?: readonly unknown[]; cleanup?: (() => void) | void }>,
  pending: [] as Array<() => void>,
  save: vi.fn(), push: vi.fn(), setResult: vi.fn(),
}));

// Drive the actual component callbacks with controlled hook state; browser DOM
// events and HTTP persistence are covered separately by the report-age E2E.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const overrides = {
    useState: (initial: unknown) => {
      const index = runtime.cursor++;
      runtime.slots[index] ??= { value: initial };
      return [runtime.slots[index].value, (next: unknown) => {
        runtime.slots[index].value = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(runtime.slots[index].value) : next;
      }];
    },
    useRef: (current: unknown) => {
      const index = runtime.cursor++;
      runtime.slots[index] ??= { value: { current } };
      return runtime.slots[index].value;
    },
    useMemo: (calculate: () => unknown) => calculate(),
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => (() => void) | void, dependencies: readonly unknown[]) => {
      const index = runtime.cursor++;
      const previous = runtime.slots[index];
      if (!previous || dependencies.some((dependency, position) => !Object.is(dependency, previous.dependencies?.[position]))) {
        runtime.slots[index] = { dependencies, cleanup: previous?.cleanup };
        runtime.pending.push(() => {
          previous?.cleanup?.();
          runtime.slots[index].cleanup = effect();
        });
      }
    },
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: runtime.push }) }));
vi.mock("@/store/analysisStore", () => ({ useAnalysisStore: () => runtime.setResult }));
vi.mock("@/services/reports", () => ({ reportService: { saveReport: runtime.save } }));
vi.mock("@/components/Pose2D/PoseAutoAnalyzer", () => ({ default: "test-auto" }));
vi.mock("@/components/Pose2D/Pose2DCanvas", () => ({ default: "test-canvas" }));
vi.mock("@/components/Pose2D/Scrubber", () => ({ default: "test-scrubber" }));
vi.mock("@/components/Pose2D/Controls", () => ({ default: "test-controls" }));
vi.mock("@/components/ui/button", () => ({ Button: "test-button" }));
import PoseAnalysisView from "@/components/Pose2D/PoseAnalysisView";
import type { AutoAnalysisProgress, AutoAnalysisResult } from "@/components/Pose2D/PoseAutoAnalyzer";

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function element(tree: ReactNode, predicate: (value: Element) => boolean): Element {
  const match = elements(tree).find(predicate);
  if (!match) throw new Error("Expected component element was not rendered.");
  return match;
}
function button(tree: ReactNode, label: string) {
  return element(tree, (value) => value.type as unknown === "test-button" &&
    (Array.isArray(value.props.children) ? value.props.children : [value.props.children]).includes(label));
}
function render(session: CompletedUploadSession) {
  runtime.cursor = 0;
  return PoseAnalysisView({ videoUrl: session.videoUrl, uploadSession: session,
    analysisType: "training", onClear: vi.fn() });
}
function capture(tree: ReactNode, halfAction = false) {
  const analyzer = element(tree, (value) => value.type as unknown === "test-auto");
  const drillFrames = pushupFrames(1, { finishRest: !halfAction });
  const frames = drillFrames.map((frame) => ({ time: frame.t, angles: [{ name: "testPose", value: 90 }] }));
  (analyzer.props.onProgress as (value: AutoAnalysisProgress) => void)({
    status: "ready", processedFrames: frames.length, totalFrames: frames.length,
    coveragePercent: 100, currentTime: drillFrames.at(-1)!.t, duration: drillFrames.at(-1)!.t,
  });
  (analyzer.props.onComplete as (value: AutoAnalysisResult) => void)({
    frames, drillFrames, duration: drillFrames.at(-1)!.t,
  });
}
async function session(): Promise<CompletedUploadSession> {
  const template = getTemplateById("pushup_reps_side")!;
  return { sessionPublicId: "session-1", uploadTaskPublicId: "upload-1", bucketName: "test",
    objectKey: "video.mp4", videoUrl: "https://example.com/video.mp4", videoPublicId: "video-1",
    templateCode: template.templateId, templateVersion: template.version,
    templatePublicId: "template-1", templateVersionPublicId: "version-1",
    templateContentHash: await calculateTrainingTemplateContentHash(template) };
}
async function flush() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function click(value: Element) { return (value.props.onClick as () => Promise<void>)(); }

beforeEach(() => {
  runtime.cursor = 0;
  runtime.slots = [];
  runtime.pending = [];
  runtime.save.mockReset(); runtime.push.mockReset(); runtime.setResult.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => { runtime.slots.forEach((slot) => slot.cleanup?.()); vi.restoreAllMocks(); });

describe("initial training report save", () => {
  it("locks concurrent submissions, preserves analysis after failure and stays locked after success", async () => {
    const uploaded = await session();
    let tree = render(uploaded);
    runtime.pending.splice(0).forEach((effect) => effect());
    tree = render(uploaded);
    capture(tree);
    tree = render(uploaded);
    const ageSelect = element(tree, (value) => value.props["aria-label"] === "Report age group");
    (ageSelect.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "4-7" } });
    tree = render(uploaded);
    const submit = button(tree, "View Analysis Report");
    let rejectSave!: (error: Error) => void;
    runtime.save.mockReturnValueOnce(new Promise((_, reject) => { rejectSave = reject; }));
    const firstAttempt = click(submit);
    await click(submit);
    await vi.waitFor(() => expect(runtime.save).toHaveBeenCalledOnce());
    const firstPayload = runtime.save.mock.calls[0][0] as SaveReportPayload;
    expect(firstPayload.score_data.score_context).toMatchObject({ age_group: "4-7" });
    tree = render(uploaded);
    expect(button(tree, "Saving...").props.disabled).toBe(true);
    expect(element(tree, (value) => value.type as unknown === "test-controls").props).toMatchObject({ clearDisabled: true, playDisabled: true });
    expect(element(tree, (value) => value.props["aria-label"] === "Report age group").props.disabled).toBe(true);
    rejectSave(new Error("temporary save failure"));
    await firstAttempt;
    tree = render(uploaded);
    const retry = button(tree, "Retry saving report");
    expect(retry.props.disabled).toBe(false);
    expect(element(tree, (value) => value.props.role === "alert").props.children).toContain("captured analysis is still available");
    runtime.save.mockResolvedValueOnce({ public_id: "report-1", video_url: uploaded.videoUrl } as ReportRead);
    await click(retry);
    const retryPayload = runtime.save.mock.calls[1][0] as SaveReportPayload;
    expect(retryPayload).toEqual(firstPayload);
    expect(runtime.setResult).toHaveBeenCalledOnce();
    expect(runtime.push).toHaveBeenCalledWith("/pose-2d/report?id=report-1");
    tree = render(uploaded);
    expect(button(tree, "Saving...").props.disabled).toBe(true);
    await click(button(tree, "Saving..."));
    expect(runtime.save).toHaveBeenCalledTimes(2);
  });

  it("keeps a full clip with an unfinished action blocked despite full frame coverage", async () => {
    const uploaded = await session();
    let tree = render(uploaded);
    runtime.pending.splice(0).forEach((effect) => effect());
    tree = render(uploaded);
    capture(tree, true);
    tree = render(uploaded);
    const submit = button(tree, "More analysis data needed");
    expect(submit.props.disabled).toBe(true);
    await click(submit);
    expect(runtime.save).not.toHaveBeenCalled();
    await flush();
  });

  it("rejects stale upload rules before requesting persistence and retains retryable data", async () => {
    const uploaded = { ...await session(), templateContentHash: "changed-rules" };
    let tree = render(uploaded);
    runtime.pending.splice(0).forEach((effect) => effect());
    tree = render(uploaded);
    capture(tree);
    tree = render(uploaded);
    await click(button(tree, "View Analysis Report"));
    expect(runtime.save).not.toHaveBeenCalled();
    tree = render(uploaded);
    expect(element(tree, (value) => value.props.role === "alert").props.children).toContain("locked rules");
    expect(button(tree, "Retry saving report").props.disabled).toBe(false);
  });

  it("ignores a save response after leaving the analysis workspace", async () => {
    const uploaded = await session();
    let tree = render(uploaded);
    runtime.pending.splice(0).forEach((effect) => effect());
    tree = render(uploaded);
    capture(tree);
    tree = render(uploaded);
    let resolveSave!: (report: ReportRead) => void;
    runtime.save.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const attempt = click(button(tree, "View Analysis Report"));
    await vi.waitFor(() => expect(runtime.save).toHaveBeenCalledOnce());
    runtime.slots.forEach((slot) => slot.cleanup?.());
    resolveSave({ public_id: "late-report", video_url: uploaded.videoUrl } as ReportRead);
    await attempt;
    expect(runtime.push).not.toHaveBeenCalled();
    expect(runtime.setResult).not.toHaveBeenCalled();
  });
});
