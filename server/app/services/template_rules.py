import hashlib
import json

from app.models.training_template_version import TrainingTemplateVersion


def _normalize_json_numbers(value):
    if isinstance(value, dict):
        return {key: _normalize_json_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize_json_numbers(item) for item in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def template_content_hash(raw_template: dict) -> str:
    canonical = json.dumps(
        _normalize_json_numbers(raw_template), ensure_ascii=False,
        sort_keys=True, separators=(",", ":"), allow_nan=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def version_rules_hash(version: TrainingTemplateVersion) -> str | None:
    rules = version.scoring_rules
    raw = rules.get("template") if isinstance(rules, dict) else None
    if not isinstance(raw, dict):
        return None
    return template_content_hash(raw)
