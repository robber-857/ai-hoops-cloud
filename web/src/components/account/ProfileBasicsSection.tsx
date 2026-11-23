"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useRef, useState } from "react";
import { meService, type MeProfileRead } from "@/services/me";
import { useLanguagePreference } from "./LanguagePreferenceProvider";
import { ProfileDateInput } from "./ProfileDateInput";
import styles from "./PlayerProfile.module.css";
import { parseDateInput } from "@/lib/dateInput";
import {
  isValidPastDate,
  sydneyDateKey,
  trainingDurationLabel,
} from "@/lib/profile";


export function ProfileBasicsSection({
  onSaved,
}: {
  onSaved?: (profile: MeProfileRead) => void;
}) {
  const { t, language } = usePlayerCopy();
  const preference = useLanguagePreference();
  const [profile, setProfile] = useState<MeProfileRead | null>(null);
  const [nickname, setNickname] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [today, setToday] = useState("");
  const loading = preference.loading;
  const [saving, setSaving] = useState(false);
  const loadError = preference.error;
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const savedVersion = useRef<string | null>(null);
  const dirty =
    profile !== null &&
    (nickname !== (profile.nickname ?? "") ||
      startedOn !== (profile.training_started_on ?? ""));

  useEffect(() => {
    setToday(sydneyDateKey());
    const value = preference.profile;
    if (value) {
      if (savedVersion.current === value.updated_at) {
        savedVersion.current = null;
        return;
      }
      setProfile(value);
      setNickname(value.nickname ?? "");
      setStartedOn(value.training_started_on ?? "");
      setSaveError("");
      setSaved(false);
    }
  }, [preference.profile]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        (event.target as Element).closest?.("a[href]") &&
        !window.confirm(t("Your profile has not been saved. Leave this page?"))
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

  async function save() {
    if (!profile || inFlight.current) return;
    const currentToday = sydneyDateKey();
    setToday(currentToday);
    const trainingDate = startedOn ? parseDateInput(startedOn) : null;
    if (startedOn && (!trainingDate || !isValidPastDate(trainingDate, currentToday))) {
      setSaveError("Enter a valid training start date in yyyy/mm/dd format on or before today.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const value = await meService.updateProfile({
        nickname: nickname.trim() || null,
        training_started_on: trainingDate,
        expected_updated_at: profile.updated_at,
      });
      setProfile(value);
      setNickname(value.nickname ?? "");
      setStartedOn(value.training_started_on ?? "");
      savedVersion.current = value.updated_at;
      preference.refresh(value);
      setSaved(true);
      onSaved?.(value);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("Could not save. Your changes are still here."),
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function reload() {
    if (dirty && !window.confirm(t("Reload saved profile and replace your unsaved changes?"))) {
      return;
    }
    preference.reload();
  }

  return (
    <section className={styles.section} aria-labelledby="profile-basics-heading">
      <h2 id="profile-basics-heading" className="text-xl font-semibold">{t("Player profile")}</h2>
      <p className={styles.description}>
        {t("A parent can update these details on the player’s behalf. Training experience is calculated from the start date; class minutes are recorded separately by your coach.")}
      </p>
      {loading && <p role="status" className="mt-4">{t("Loading profile…")}</p>}
      {loadError && (
        <div role="alert" className={`mt-4 text-sm ${styles.error}`}>
          <p>{loadError}</p>
          <button type="button" className={`min-h-11 ${styles.link}`} onClick={reload}>
            {t("Reload profile")}
          </button>
        </div>
      )}
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={loading || saving || Boolean(loadError) || !profile}
          className="grid min-w-0 gap-5 sm:grid-cols-2"
        >
          <label className="min-w-0 text-sm">
            {t("Player name / nickname")}
            <input
              className={styles.field}
              maxLength={100}
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setSaved(false);
                setSaveError("");
              }}
            />
            <span className={styles.hint}>
              {t("Optional. Your username is shown when this is empty.")}
            </span>
          </label>
          <label className="min-w-0 text-sm">
            {t("Started training on")}
            <ProfileDateInput
              className={styles.field}
              maxDate={today || undefined}
              value={startedOn}
              onChange={(value) => {
                setStartedOn(value);
                setSaved(false);
                setSaveError("");
              }}
            />
          </label>
          <div className={`text-sm sm:col-span-2 ${styles.readout}`}>
            <p className={styles.muted}>{t("Training experience")}</p>
            <output className="mt-2 block text-lg font-semibold" aria-live="polite">
              {today ? trainingDurationLabel(parseDateInput(startedOn), today, language) : t("Not recorded")}
            </output>
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`${styles.primary} ${styles.saveRow}`}
          >
            {saving ? t("Saving…") : t("Save profile")}
          </button>
        </fieldset>
      </form>
      {saveError && (
        <div role="alert" className={`mt-4 text-sm ${styles.error}`}>
          <p>{t(saveError)}</p>
          <button type="button" className={`min-h-11 ${styles.link}`} disabled={saving} onClick={reload}>
            {t("Reload saved profile")}
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className={`mt-4 text-sm ${styles.success}`}>
          {t("Profile saved. Measurement history is unchanged.")}
        </p>
      )}
    </section>
  );
}
