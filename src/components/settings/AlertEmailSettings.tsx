"use client";

import { useEffect, useState } from "react";
import {
  useNotificationAlertsSettings,
  useUpdateNotificationAlertsSettings,
} from "@/hooks/useNotificationAlerts";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const kinds = [
  { label: "Payments", detail: "Package and trial checkout: started, paid, or failed." },
  { label: "Bookings", detail: "When a member books a class." },
  { label: "Trials", detail: "When a guest pays for a trial class." },
];

function initial(email: string) {
  const letter = email.trim().charAt(0).toUpperCase();
  return letter || "?";
}

function limeMark(email: string) {
  let total = 0;
  for (const char of email.toLowerCase()) total += char.charCodeAt(0);
  return total % 2 === 0;
}

export function AlertEmailSettings() {
  const { data, isLoading, error } = useNotificationAlertsSettings();
  const updateSettings = useUpdateNotificationAlertsSettings();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (data) setEmails(data.emails);
  }, [data]);

  const savedKey = (data?.emails || []).map((email) => email.trim().toLowerCase()).join("|");
  const currentKey = emails.map((email) => email.trim().toLowerCase()).filter(Boolean).join("|");
  const dirty = savedKey !== currentKey;
  const invalid = emails.filter((email) => email.trim() && !emailPattern.test(email.trim()));

  const addDraft = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!emailPattern.test(value)) {
      setDraftError("Enter a full email, like name@onestepfitness.sg.");
      return;
    }
    if (emails.some((email) => email.trim().toLowerCase() === value)) {
      setDraftError("That address is already on the list.");
      return;
    }
    setEmails((current) => [...current, value]);
    setDraft("");
    setDraftError("");
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    const cleaned = emails.map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (cleaned.some((email) => !emailPattern.test(email))) return;

    try {
      await updateSettings.mutateAsync({ emails: cleaned });
      setEmails(cleaned);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      console.error("Failed to save alert emails:", saveError);
    }
  };

  if (isLoading) {
    return <div className={`${card} h-72 animate-pulse`} />;
  }

  if (error) {
    return (
      <div className={`${card} px-6 py-8 text-sm text-red-600`}>
        Could not load recipients. {error instanceof Error ? error.message : "Please try again."}
      </div>
    );
  }

  const updated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-SG", {
        timeZone: "Asia/Singapore",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Studio inbox</h2>
          <p className="mt-1 max-w-lg text-sm text-neutral-500">
            Only these addresses get the studio copies. A tutor’s own class alerts stay on Your alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateSettings.isPending || !dirty || invalid.length > 0}
          className="rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-40"
        >
          {updateSettings.isPending ? "Saving…" : saveSuccess && !dirty ? "Saved" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[22px] bg-neutral-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#E4F56C]">Receives</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight">{emails.filter((email) => email.trim()).length}</p>
          <p className="mt-1 text-sm text-white/60">{emails.filter((email) => email.trim()).length === 1 ? "inbox" : "inboxes"}</p>
          <ul className="mt-5 space-y-3">
            {kinds.map((kind) => (
              <li key={kind.label}>
                <p className="text-sm font-semibold">{kind.label}</p>
                <p className="text-xs leading-5 text-white/60">{kind.detail}</p>
              </li>
            ))}
          </ul>
          {updated ? <p className="mt-5 text-[11px] text-white/40">Last saved {updated} SGT</p> : null}
        </aside>

        <div className="min-w-0">
          {emails.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-neutral-300 px-4 py-8 text-sm text-neutral-500 dark:border-white/15">
              No one receives these alerts until you add an email.
            </div>
          ) : (
            <ul className="space-y-2">
              {emails.map((email, index) => {
                const bad = Boolean(email.trim()) && !emailPattern.test(email.trim());
                const mark = limeMark(email || String(index));
                return (
                  <li
                    key={index}
                    className={`flex items-center gap-3 rounded-[20px] border px-3 py-2 ${
                      bad ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        mark ? "bg-[#E4F56C] text-neutral-950" : "bg-neutral-950 text-[#E4F56C]"
                      }`}
                    >
                      {initial(email)}
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEmails((current) => current.map((item, i) => (i === index ? value : item)));
                        setSaveSuccess(false);
                      }}
                      aria-label={`Recipient ${index + 1}`}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-950 outline-none dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmails((current) => current.filter((_, i) => i !== index));
                        setSaveSuccess(false);
                      }}
                      aria-label={`Remove ${email || "email"}`}
                      className="rounded-full px-2 py-1 text-xs font-semibold text-red-600"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              addDraft();
            }}
          >
            <input
              type="email"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (draftError) setDraftError("");
              }}
              placeholder="name@onestepfitness.sg"
              className="h-11 min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white"
            />
            <button type="submit" className="rounded-full bg-neutral-950 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950">
              Add email
            </button>
          </form>
          {draftError ? <p className="mt-2 text-sm text-red-600">{draftError}</p> : null}
          {invalid.length > 0 ? <p className="mt-2 text-sm text-red-600">Fix the highlighted address before saving.</p> : null}
          {updateSettings.isError ? (
            <p className="mt-2 text-sm text-red-600">{updateSettings.error?.message || "Could not save recipients."}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
