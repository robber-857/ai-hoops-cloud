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
import styles from "./PlayerProfile.module.css";

type Form = Omit<PlayerMeasurementInput, "request_id" | "sex"> & {
  sex: "" | "female" | "male";
};

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
    <section id="player-measurements" className={styles.section} aria-labelledby="measurements-heading">
      <h2 id="measurements-heading" className="text-xl font-semibold">{t("Player measurements")}</h2>
      <p className={styles.description}>
        {t("For players of all ages. A parent can enter these details on the player’s behalf. Each save adds a dated record; previous measurements and analysis reports stay unchanged.")}
      </p>
      {loadError && (
        <div role="alert" className={`mt-4 text-sm ${styles.error}`}>
          {t(loadError)}
          <button
            type="button"
            className={`ml-3 min-h-11 ${styles.link}`}
            onClick={() => setVersion((value) => value + 1)}
          >
            {t("Reload measurements")}
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className={`mt-4 ${styles.muted}`}>
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
              className={styles.field}
              value={form.date_of_birth}
              onChange={(value) => update("date_of_birth", value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Measurement date")}
            <ProfileDateInput
              required
              maxDate={sydneyDateKey()}
              className={styles.field}
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
              className={styles.field}
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
              className={styles.field}
              value={form.weight_kg}
              onChange={(e) => update("weight_kg", e.target.value)}
            />
          </label>
          <label className="min-w-0 text-sm">
            {t("Sex (optional)")}
            <select
              className={styles.field}
              value={form.sex}
              onChange={(e) => update("sex", e.target.value)}
            >
              <option value="">{t("Not specified")}</option>
              <option value="female">{t("Female")}</option>
              <option value="male">{t("Male")}</option>
            </select>
          </label>
          <div className="grid gap-3 text-sm sm:col-span-2 sm:grid-cols-3">
            <div className={styles.readout}>
              <p className={styles.muted}>{t("Current age · Australia/Sydney")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {currentAge === null ? t("Enter date of birth") : `${currentAge} ${isChinese ? "岁" : "years"}`}
              </output>
            </div>
            <div className={styles.readout}>
              <p className={styles.muted}>{t("Age on measurement date")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {age === null ? t("Enter birth and measurement dates") : `${age} ${isChinese ? "岁" : "years"}`}
              </output>
            </div>
            <div className={styles.readout}>
              <p className={styles.muted}>{t("BMI · calculated")}</p>
              <output className="mt-2 block text-lg font-semibold" aria-live="polite">
                {bmi === null ? t("Enter height and weight") : `${bmi} kg/m²`}
              </output>
            </div>
            <p className={`leading-6 sm:col-span-3 ${styles.muted}`}>
              {t("BMI is a calculated number, without an adult weight category for children. It is not used to calculate video analysis scores.")}
            </p>
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`${styles.primary} ${styles.saveRow}`}
          >
            {saving ? t("Saving…") : t("Save new measurement")}
          </button>
        </fieldset>
      </form>
      {saveError && (
        <p role="alert" className={`mt-4 text-sm ${styles.error}`}>
          {t(saveError)}
        </p>
      )}
      {saved && (
        <p role="status" className={`mt-4 text-sm ${styles.success}`}>
          {t("Measurement saved. Previous records are unchanged.")}
        </p>
      )}
      <h3 className={`text-lg font-semibold ${styles.history}`}>{t("Measurement history")}</h3>
      <p className={`mt-2 text-sm ${styles.muted}`}>
        {t("Newest measurement date first. Correct a record by saving a new version with the same date.")}
      </p>
      <Link href={`${routes.user.trends}#measurement-trends`} className={`inline-flex min-h-11 items-center text-sm font-semibold ${styles.link}`}>
        {t("View measurement trends")}
      </Link>
      {!loading && !loadError && !items.length && (
        <p className={`mt-4 ${styles.muted}`}>{t("No measurements saved yet.")}</p>
      )}
      <ol className={styles.historyList}>
        {items.map((item) => (
          <li key={item.public_id} className="py-4 text-sm">
            <p className="font-semibold">
              {formatDateInput(item.measured_on)} · {item.height_cm} {t("cm ·")} {item.weight_kg} kg
            </p>
            <p className={`mt-2 ${styles.muted}`}>
              {t("Born")} {formatDateInput(item.date_of_birth)} · {item.sex ? t(item.sex) : t("Sex not specified")}
              {ageYears(item.date_of_birth, item.measured_on) !== null &&
                (isChinese ? ` · 测量时 ${ageYears(item.date_of_birth, item.measured_on)} 岁` : ` · Age ${ageYears(item.date_of_birth, item.measured_on)} at measurement`)}
            </p>
            <p className={`mt-2 ${styles.muted}`}>
              {t("BMI")} {measurementBmi(item) ?? t("not available")}
            </p>
            <p className={`mt-1 text-xs ${styles.muted}`}>
              {t("Saved")} {formatProfileDateTime(item.created_at)}
            </p>
          </li>
        ))}
      </ol>
      {more && (
        <button
          type="button"
          disabled={loading}
          className={`mt-4 ${styles.secondary}`}
          onClick={() => void loadMore()}
        >
          {t("Load older measurements")}
        </button>
      )}
    </section>
  );
}
