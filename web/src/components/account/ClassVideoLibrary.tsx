"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Film, Play, Upload } from "lucide-react";

import { classCollaboration, type ClassVideo } from "@/services/classCollaboration";

const surface = "rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 text-[var(--ui-text)] sm:p-5";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-subtle)] disabled:opacity-55";
const dates = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Australia/Sydney" });

function VideoPlayer({ videoId }: { videoId: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function play() {
    setBusy(true);
    setError("");
    try {
      setUrl((await classCollaboration.playback(videoId)).url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this video.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {url ? (
        <video className="block max-h-72 w-full rounded-lg bg-black" controls playsInline autoPlay preload="metadata"
          aria-label="Class video" src={url} onError={() => {
            setUrl("");
            setError("Playback was interrupted. Open the video again to retry.");
          }} />
      ) : (
        <button type="button" onClick={() => void play()} disabled={busy} className={button}>
          <Play className="size-4" /> {busy ? "Opening…" : error ? "Retry playback" : "Play video"}
        </button>
      )}
      {error && <p role="alert" className="text-sm text-[var(--ui-danger)]">{error}</p>}
    </div>
  );
}

export function ClassVideoLibrary({ classId, canUpload = false }: { classId?: string; canUpload?: boolean }) {
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void classCollaboration.listVideos(0, classId)
      .then((page) => {
        if (!active) return;
        setVideos(page.items);
        setHasMore(page.has_more);
        setOffset(page.items.length);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load class videos.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, reload]);

  async function loadMore() {
    setBusy("more");
    setError("");
    try {
      const page = await classCollaboration.listVideos(offset, classId);
      setVideos((current) => [...current, ...page.items.filter((item) => !current.some((other) => other.public_id === item.public_id))]);
      setHasMore(page.has_more);
      setOffset((current) => current + page.items.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load more videos.");
    } finally {
      setBusy("");
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("video");
    const title = String(data.get("title") ?? "").trim();
    if (!title || !(file instanceof File) || !file.size) {
      setError("Enter a title and select a video.");
      return;
    }
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      const video = await classCollaboration.uploadVideo(classId, title, file);
      setVideos((current) => [video, ...current]);
      setOffset((current) => current + 1);
      setNotice(`${video.title} is now available to the class.`);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the video.");
    } finally {
      setBusy("");
    }
  }

  async function archive(video: ClassVideo) {
    if (!classId || !window.confirm(`Remove “${video.title}” from the class video library?`)) return;
    setBusy(video.public_id);
    setError("");
    setNotice("");
    try {
      await classCollaboration.archive(classId, video.public_id);
      setVideos((current) => current.filter((item) => item.public_id !== video.public_id));
      setOffset((current) => Math.max(0, current - 1));
      setNotice("Video removed from the class library.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the video.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-5 text-[var(--ui-text)]" aria-label="Class video library">
      {classId && canUpload && (
        <form onSubmit={(event) => void upload(event)} className={`space-y-4 ${surface}`}>
          <div>
            <h3 className="font-semibold">Share a video with the class</h3>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">Current class members can watch it. MP4 or WebM, up to 50 MB.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="min-w-0 space-y-1 text-sm font-medium">
              <span>Video title</span>
              <input name="title" required maxLength={140} className="block min-h-10 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3" disabled={!!busy || loading} />
            </label>
            <label className="min-w-0 space-y-1 text-sm font-medium">
              <span>Video file</span>
              <input type="file" name="video" required accept="video/mp4,video/webm,.mp4,.webm"
                className="block min-h-10 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2 text-sm" disabled={!!busy || loading} />
            </label>
          </div>
          <button type="submit" className={button} disabled={!!busy || loading}><Upload className="size-4" /> {busy === "upload" ? "Uploading…" : "Upload video"}</button>
        </form>
      )}

      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-[var(--ui-danger)]">
          <p>{error}</p>
          {!videos.length && <button type="button" className={button} disabled={loading || !!busy} onClick={() => {
            setError("");
            setLoading(true);
            setReload((current) => current + 1);
          }}>Retry</button>}
        </div>
      )}
      {loading && <p role="status" className="text-sm text-[var(--ui-muted)]">Loading videos…</p>}
      {!loading && !error && videos.length === 0 &&
        <div className={`flex items-center gap-3 ${surface}`}><Film className="size-5 shrink-0" /> <p className="text-sm text-[var(--ui-muted)]">No class videos have been shared yet.</p></div>}

      {videos.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {videos.map((video) => (
            <li key={video.public_id} className={`min-w-0 space-y-3 ${surface}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{video.title}</h3>
                  <p className="mt-1 break-words text-sm text-[var(--ui-muted)]">{video.class_name} · {video.uploader_name} · {dates.format(new Date(video.created_at))}</p>
                </div>
                {classId && (
                  <button type="button" disabled={!!busy} className="min-h-10 text-sm text-[var(--ui-muted)] hover:underline disabled:opacity-55"
                    onClick={() => void archive(video)}>Remove</button>
                )}
              </div>
              <VideoPlayer videoId={video.public_id} />
            </li>
          ))}
        </ul>
      )}
      {hasMore && <button type="button" disabled={!!busy} className={button} onClick={() => void loadMore()}>{busy === "more" ? "Loading…" : "Load more videos"}</button>}
    </section>
  );
}
