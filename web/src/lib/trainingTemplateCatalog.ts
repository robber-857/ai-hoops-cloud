import type { ActionTemplate } from "@/config/templates";
import type {
  TrainingTemplateRead,
  TrainingTemplateVersionRead,
} from "@/services/templates";

export type TrainingTemplateAvailability =
  | "ready"
  | "missing_database"
  | "version_mismatch"
  | "content_mismatch";

export type TrainingTemplateCatalogItem = {
  template: ActionTemplate;
  remoteTemplate: TrainingTemplateRead | null;
  remoteVersion: TrainingTemplateVersionRead | null;
  availability: TrainingTemplateAvailability;
  availabilityMessage: string;
  contentHash: string;
};

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Template JSON cannot contain non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new Error("Template JSON contains an unsupported value.");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function calculateTrainingTemplateContentHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

function readDeclaredHash(version: TrainingTemplateVersionRead): string | null {
  const summaryHash = version.summary_template?.content_hash;
  if (typeof summaryHash === "string") return summaryHash;
  const scoringHash = version.scoring_rules?.content_hash;
  return typeof scoringHash === "string" ? scoringHash : null;
}

function readRemoteRawTemplate(
  version: TrainingTemplateVersionRead,
): Record<string, unknown> | null {
  const rawTemplate = version.scoring_rules?.template;
  return rawTemplate && typeof rawTemplate === "object" && !Array.isArray(rawTemplate)
    ? (rawTemplate as Record<string, unknown>)
    : null;
}

export async function buildTrainingTemplateCatalog(
  localTemplates: ActionTemplate[],
  remoteTemplates: TrainingTemplateRead[],
): Promise<TrainingTemplateCatalogItem[]> {
  return Promise.all(
    localTemplates.map(async (template) => {
      const contentHash = await calculateTrainingTemplateContentHash(template);
      const remoteTemplate =
        remoteTemplates.find((item) => item.template_code === template.templateId) ?? null;

      if (!remoteTemplate) {
        return {
          template,
          remoteTemplate,
          remoteVersion: null,
          availability: "missing_database" as const,
          availabilityMessage: "This template has not been synced to the training catalog.",
          contentHash,
        };
      }

      const remoteVersion =
        remoteTemplate.versions.find((version) => version.version === template.version) ?? null;
      if (
        !remoteVersion
        || remoteVersion.status !== "active"
        || remoteTemplate.current_version !== template.version
      ) {
        return {
          template,
          remoteTemplate,
          remoteVersion,
          availability: "version_mismatch" as const,
          availabilityMessage: "The active database version does not match this app build.",
          contentHash,
        };
      }

      const rawRemoteTemplate = readRemoteRawTemplate(remoteVersion);
      const declaredHash = readDeclaredHash(remoteVersion);
      const remoteContentHash = rawRemoteTemplate
        ? await calculateTrainingTemplateContentHash(rawRemoteTemplate)
        : null;
      if (
        !declaredHash
        || declaredHash !== contentHash
        || remoteContentHash !== contentHash
      ) {
        return {
          template,
          remoteTemplate,
          remoteVersion,
          availability: "content_mismatch" as const,
          availabilityMessage: "The database rules differ from this app build. Sync the template again.",
          contentHash,
        };
      }

      return {
        template,
        remoteTemplate,
        remoteVersion,
        availability: "ready" as const,
        availabilityMessage: "Ready to analyze.",
        contentHash,
      };
    }),
  );
}
