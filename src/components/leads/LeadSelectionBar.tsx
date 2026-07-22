"use client";

type Props = {
  selectedCount: number;
  eligibleEmail: number;
  withPhone: number;
  onCompose: () => void;
  onWhatsApp: () => void;
  onClear: () => void;
  loading?: boolean;
};

export default function LeadSelectionBar({
  selectedCount,
  eligibleEmail,
  withPhone,
  onCompose,
  onWhatsApp,
  onClear,
  loading = false,
}: Props) {
  if (!selectedCount) return null;

  return (
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-lg dark:border-indigo-800 dark:bg-indigo-950/80">
      <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
        {loading ? (
          "Calculating eligibility…"
        ) : (
          <>
            {selectedCount} selected · {eligibleEmail} can email · {withPhone} with phone
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onClear} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium dark:border-indigo-700">
          Clear
        </button>
        {withPhone > 0 && (
          <button
            disabled={loading}
            onClick={onWhatsApp}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            WhatsApp ({withPhone})
          </button>
        )}
        <button
          disabled={loading || !eligibleEmail}
          onClick={onCompose}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Compose email
        </button>
      </div>
    </div>
  );
}
