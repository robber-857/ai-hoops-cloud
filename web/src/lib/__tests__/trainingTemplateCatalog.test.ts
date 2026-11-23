import { describe, expect, it } from "vitest";

import { getTemplateById } from "@/config/templates";
import type { TrainingTemplateRead } from "@/services/templates";

import {
  buildTrainingTemplateCatalog,
  calculateTrainingTemplateContentHash,
  getLocalTemplateVersion,
} from "../trainingTemplateCatalog";

async function remoteTemplate(
  templateCode: string,
  overrides: Partial<TrainingTemplateRead> = {},
): Promise<TrainingTemplateRead> {
  const template = getTemplateById(templateCode);
  if (!template) throw new Error(`Missing test template ${templateCode}`);
  const hash = await calculateTrainingTemplateContentHash(template);
  return {
    public_id: "template-public-id",
    template_code: template.templateId,
    name: template.displayName,
    analysis_type: template.mode,
    description: null,
    difficulty_level: null,
    status: "active",
    current_version: getLocalTemplateVersion(template),
    published_at: null,
    versions: [
      {
        public_id: "version-public-id",
        version: getLocalTemplateVersion(template),
        scoring_rules: {
          content_hash: hash,
          template,
        },
        metric_definitions: null,
        mediapipe_config: null,
        summary_template: { content_hash: hash },
        status: "active",
        is_default: true,
        published_at: null,
      },
    ],
    example_videos: [],
    ...overrides,
  };
}

describe("training template catalog contract", () => {
  it("marks matching code, version, and content as ready", async () => {
    const local = getTemplateById("jumping_jack_reps_front");
    expect(local).toBeDefined();
    if (!local) return;

    const catalog = await buildTrainingTemplateCatalog(
      [local],
      [await remoteTemplate(local.templateId)],
    );

    expect(catalog[0].availability).toBe("ready");
  });

  it("blocks upload when database rules differ from local calculation rules", async () => {
    const local = getTemplateById("jumping_jack_reps_front");
    expect(local).toBeDefined();
    if (!local) return;
    const remote = await remoteTemplate(local.templateId);
    remote.versions[0].scoring_rules = {
      ...remote.versions[0].scoring_rules,
      template: {
        ...local,
        camera: "side",
      },
    };

    const catalog = await buildTrainingTemplateCatalog([local], [remote]);

    expect(catalog[0].availability).toBe("content_mismatch");
  });

  it("blocks a template that has not been synced to the database", async () => {
    const local = getTemplateById("single_leg_stand_front");
    expect(local).toBeDefined();
    if (!local) return;

    const catalog = await buildTrainingTemplateCatalog([local], []);

    expect(catalog[0].availability).toBe("missing_database");
  });

  it.each(["shoot_side_form_close", "dribble_side_onehand_oneside"])(
    "accepts %s at local-v1 only when its actual legacy rules match",
    async (templateCode) => {
      const template = getTemplateById(templateCode)!;
      const remote = await remoteTemplate(templateCode);
      remote.versions[0].summary_template = { content_hash: "old-numeric-json-encoding" };
      expect(remote.current_version).toBe("local-v1");
      expect((await buildTrainingTemplateCatalog([template], [remote]))[0].availability).toBe("ready");

      remote.versions[0].scoring_rules = { template: { ...template, camera: "front" } };
      expect((await buildTrainingTemplateCatalog([template], [remote]))[0].availability).toBe("content_mismatch");
    },
  );

  it("requires publication of the explicit crossover version without a legacy fallback", async () => {
    const template = getTemplateById("dribble_front_narrow_crossover")!;
    const remote = await remoteTemplate(template.templateId, { current_version: "local-v1" });
    expect(getLocalTemplateVersion(template)).toBe("v2");
    expect((await buildTrainingTemplateCatalog([template], [remote]))[0].availability).toBe("version_mismatch");
  });
});
