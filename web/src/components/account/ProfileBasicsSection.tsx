"use client";

import { useEffect, useRef, useState } from "react";
import { meService, type MeProfileRead } from "@/services/me";
import {
  isValidPastDate,
  sydneyDateKey,
  trainingDurationLabel,
} from "@/lib/profile";

const fieldClass =
  "mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-white/25 bg-[#10141b] px-3 text-base text-white focus-visible:outline-2 focus-visible:outline-[#d8ff5d]";

export function ProfileBasicsSection({
  onSaved,
}: {
  onSaved?: (profile: MeProfileRead) => void;
}) {
  const [profile, setProfile] = useState<MeProfileRead | null>(null);
  const [nickname, setNickname] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const dirty =
    profile !== null &&
    (nickname !== (profile.nickname ?? "") ||
      startedOn !== (profile.training_started_on ?? ""));

  useEffect(() => {
    setToday(sydneyDateKey());
    let active = true;
    setLoading(true);
    setLoadError("");
    meService
      .getProfile()
      .then((value) => {
        if (!active) return;
        setProfile(value);
        setNickname(value.nickname ?? "");
        setStartedOn(value.training_started_on ?? "");
        setSaveError("");
        setSaved(false);
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load profile.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        (event.target as Element).closest?.("a[href]") &&
        !window.confirm("Your profile has not been saved. Leave this page?")
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
  }, [dirty]);

  async function save() {
    if (!profile || inFlight.current) return;
    const currentToday = sydneyDateKey();
    setToday(currentToday);
    if (startedOn && !isValidPastDate(startedOn, currentToday)) {
      setSaveError("Enter a valid training start date on or before today.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const value = await meService.updateProfile({
        nickname: nickname.trim() || null,
        training_started_on: startedOn || null,
        expected_updated_at: profile.updated_at,
      });
      setProfile(value);
      setNickname(value.nickname ?? "");
      setStartedOn(value.training_started_on ?? "");
      setSaved(true);
      onSaved?.(value);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function reload() {
    if (dirty && !window.confirm("Reload saved profile and replace your unsaved changes?")) {
      return;
    }
    setRetry((value) => value + 1);
  }

  return (
    <section className="min-w-0 border-t border-white/15 pt-6">
      <h2 className="text-xl font-semibold">Player profile</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
        A parent can update these details on the player’s behalf. Training
        experience is calculated from the start date; class minutes are recorded
        separately by your coach.
      </p>
      {loading && <p role="status" className="mt-4">Loading profile…</p>}
      {loadError && (
        <div role="alert" className="mt-4 text-sm text-red-200">
          <p>{loadError}</p>
          <button type="button" className="min-h-11 underline" onClick={reload}>
            Reload profile
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
            Player name / nickname
            <input
              className={fieldClass}
              maxLength={100}
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setSaved(false);
                setSaveError("");
              }}
            />
            <span className="mt-2 block text-xs text-white/65">
              Optional. Your username is shown when this is empty.
            </span>
          </label>
          <label className="min-w-0 text-sm">
            Started training on
            <input
              type="date"
              className={fieldClass}
              max={today || undefined}
              value={startedOn}
              onChange={(event) => {
                setStartedOn(event.target.value);
                setSaved(false);
                setSaveError("");
              }}
            />
          </label>
          <div className="rounded-lg border border-white/15 p-4 text-sm sm:col-span-2">
            <p className="text-white/65">Training experience</p>
            <output className="mt-2 block text-lg font-semibold" aria-live="polite">
              {today ? trainingDurationLabel(startedOn, today) : "Not recorded"}
            </output>
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-[#10140a] disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </fieldset>
      </form>
      {saveError && (
        <div role="alert" className="mt-4 text-sm text-red-200">
          <p>{saveError}</p>
          <button type="button" className="min-h-11 underline" disabled={saving} onClick={reload}>
            Reload saved profile
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-[#d8ff5d]">
          Profile saved. Measurement history is unchanged.
        </p>
      )}
    </section>
  );
}
