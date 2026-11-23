"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccountCenter } from "./AccountDataProvider";
import {
  playerProfileService,
  type PlayerMeasurement,
  type PlayerMeasurementInput,
} from "@/services/playerProfile";
import { routes } from "@/lib/routes";
import { ageYears, deriveBmi, measurementBmi, sydneyDateKey } from "@/lib/profile";
import { formatDateInput, formatProfileDateTime, parseDateInput, validateDateInput } from "@/lib/dateInput";
import { ProfileDateInput } from "./ProfileDateInput";

type Form = Omit<PlayerMeasurementInput, "request_id" | "sex"> & {
  sex: "" | "female" | "male";
};
const fieldClass =
  "mt-2 block min-h-11 w-full rounded-lg border border-white/25 bg-[#10141b] px-3 text-base text-white focus-visible:outline-2 focus-visible:outline-[#d8ff5d]";

export function PlayerMeasurementsSection() {
  const { t, isChinese, language } = usePlayerCopy();
  const { measurementDraft, setMeasurementDraft } = useAccountCenter();
  const initialDraft = useRef(measurementDraft);
  const [form, setForm] = useState<Form>(
    initialDraft.current?.values ?? {
      date_of_birth: "",
      measured_on: sydneyDateKey(),
      height_cm: "",
      weight_kg: "",
      sex: "",
    },
  );
  const [items, setItems] = useState<PlayerMeasurement[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(Boolean(initialDraft.current));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0);
  const requestId = useRef<string | null>(
    initialDraft.current?.requestId ?? null,
  );
  const saveInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    playerProfileService
      .history()
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setMore(response.has_more);
        const latest = response.items[0];
        if (latest && version === 0 && !initialDraft.current)
          setForm((current) => ({
            ...current,
            date_of_birth: latest.date_of_birth,
            height_cm: latest.height_cm,
            weight_kg: latest.weight_kg,
            sex: latest.sex ?? "",
          }));
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load measurements.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        (event.target as Element).closest?.("a[href]") &&
        !window.confirm(
          t("Your measurements have not been saved. Leave this page?"),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, t]);

  const update = (field: keyof Form, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    setMeasurementDraft({ values: next, requestId: null });
    setDirty(true);
    setSaved(false);
    setSaveError(null);
    requestId.current = null;
  };
  const save = async () => {
    if (saveInFlight.current) return;
    const measurementDate = validateDateInput(form.measured_on, {
      required: true,
      maxDate: sydneyDateKey(),
      language,
    });
    const birthDate = validateDateInput(form.date_of_birth, {
      required: true,
      maxDate: measurementDate.iso,
      language,
    });
    if (measurementDate.error || birthDate.error || !measurementDate.iso || !birthDate.iso) {
      setSaveError(measurementDate.error || birthDate.error || t("Enter valid birth and measurement dates."));
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    requestId.current ??= crypto.randomUUID();
    const submittedId = requestId.current;
    setMeasurementDraft({ values: form, requestId: submittedId });
    try {
      await playerProfileService.save({
        ...form,
        date_of_birth: birthDate.iso,
        measured_on: measurementDate.iso,
        sex: form.sex || null,
        request_id: requestId.current,
      });
      setDirty(false);
      setMeasurementDraft((current) =>
        current?.requestId === submittedId ? null : current,
      );
      setSaved(true);
      requestId.current = null;
      setVersion((value) => value + 1);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("Could not save. Please retry."),
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const loadMore = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await playerProfileService.history(items.length);
      setItems((current) => [...current, ...response.items]);
      setMore(response.has_more);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("Could not load more measurements."),
      );
    } finally {
      setLoading(false);
    }
  };

  const age = ageYears(parseDateInput(form.date_of_birth), parseDateInput(form.measured_on) ?? "");
  const currentAge = ageYears(parseDateInput(form.date_of_birth));
  const bmi = deriveBmi(form.height_cm, form.weight_kg);

  return (
    <section id="player-measurements" className="min-w-0 scroll-mt-20 border-t border-white/15 pt-6">
      <h2 className="text-xl font-semibold">{t("Player measurements")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
        {t("For players of all ages. A parent can enter these details on the player’s behalf. Each save adds a dated record; previous measurements and analysis reports stay unchanged.")}
      </p>
      {loadError && (
        <div role="alert" className="mt-4 text-sm text-red-200">
          {t(loadError)}
          <button
            type="button"
            className="ml-3 min-h-11 underline"
            onClick={() => setVersion((value) => value + 1)}
          >
            {t("Reload measurements")}
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="mt-4 text-white/70">
          {t("Loading measurements…")}
        </p>
      )}
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={saving || loading || Boolean(loadError)}
          className="grid min-w-0 gap-5 sm:grid-cols-2"
        >
          <label className="min-w-0 text-sm">
            {t("Date of birth")}
            <ProfileDateInput
              required
              maxDate={parseDateInput(form.measured_on) ?? sydneyDateKey()}
              className={fieldClass}
              value={form.date_of_birth}
              onChange={(value) => update("date_of_birth", value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Measurement date")}
            <ProfileDateInput
              required
              maxDate={sydneyDateKey()}
              className={fieldClass}
              value={form.measured_on}
              onChange={(value) => update("measured_on", value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Height (cm)")}
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="300"
              step="0.01"
              required
              className={fieldClass}
              value={form.height_cm}
              onChange={(e) => update("height_cm", e.target.value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Weight (kg)")}
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="500"
              step="0.01"
              required
              className={fieldClass}
              value={form.weight_kg}
              onChange={(e) => update("weight_kg", e.target.value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Sex (optional)")}
            <select
              className={fieldClass}
              value={form.sex}
              onChange={(e) => update("sex", e.target.value)}
            >
              <option value="">{t("Not specified")}</option>
              <option value="female">{t("Female")}</option>
              <option value="male">{t("Male")}</option>
            </select>
          </label>
          <div className="grid gap-3 text-sm sm:col-span-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/15 p-4 sm:col-span-2">
              <p className="text-white/65">{t("Current age · Australia/Sydney")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {currentAge === null ? t("Enter date of birth") : `${currentAge} ${isChinese ? "岁" : "years"}`}
              </output>
            </div>
            <div className="rounded-lg border border-white/15 p-4">
              <p className="text-white/65">{t("Age on measurement date")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {age === null ? t("Enter birth and measurement dates") : `${age} ${isChinese ? "岁" : "years"}`}
              </output>
            </div>
            <div className="rounded-lg border border-white/15 p-4">
              <p className="text-white/65">{t("BMI · calculated")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {bmi === null ? t("Enter height and weight") : `${bmi} kg/m²`}
              </output>
            </div>
            <p className="leading-6 text-white/65 sm:col-span-2">
              {t("BMI is a calculated number, without an adult weight category for children. It is not used to calculate video analysis scores.")}
            </p>
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-[#10140a] disabled:opacity-50 sm:col-span-2"
          >
            {saving ? t("Saving…") : t("Save new measurement")}
          </button>
        </fieldset>
      </form>
      {saveError && (
        <p role="alert" className="mt-4 text-sm text-red-200">
          {t(saveError)}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-[#d8ff5d]">
          {t("Measurement saved. Previous records are unchanged.")}
        </p>
      )}
      <h3 className="mt-8 text-lg font-semibold">{t("Measurement history")}</h3>
      <p className="mt-2 text-sm text-white/65">
        {t("Newest measurement date first. Correct a record by saving a new version with the same date.")}
      </p>
      <Link href={`${routes.user.trends}#measurement-trends`} className="ui-link">
        {t("View measurement trends")}
      </Link>
      {!loading && !loadError && !items.length && (
        <p className="mt-4 text-white/70">{t("No measurements saved yet.")}</p>
      )}
      <ol className="mt-4 divide-y divide-white/10">
        {items.map((item) => (
          <li key={item.public_id} className="py-4 text-sm">
            <p className="font-semibold">
              {formatDateInput(item.measured_on)} · {item.height_cm} {t("cm ·")} {item.weight_kg} kg
            </p>
            <p className="mt-2 text-white/65">
              {t("Born")} {formatDateInput(item.date_of_birth)} · {item.sex ? t(item.sex) : t("Sex not specified")}
              {ageYears(item.date_of_birth, item.measured_on) !== null &&
                (isChinese ? ` · 测量时 ${ageYears(item.date_of_birth, item.measured_on)} 岁` : ` · Age ${ageYears(item.date_of_birth, item.measured_on)} at measurement`)}
            </p>
            <p className="mt-2 text-white/65">
              {t("BMI")} {measurementBmi(item) ?? t("not available")}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {t("Saved")} {formatProfileDateTime(item.created_at)}
            </p>
          </li>
        ))}
      </ol>
      {more && (
        <button
          type="button"
          disabled={loading}
          className="mt-4 min-h-11 rounded-lg border border-white/25 px-4"
          onClick={() => void loadMore()}
        >
          {t("Load older measurements")}
        </button>
      )}
    </section>
  );
}
