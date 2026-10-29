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
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-neutral-950 px-4 py-3 text-white shadow-[0_18px_50px_rgba(16,24,40,0.2)]">
      <div className="text-sm font-semibold">
        {loading ? (
          "Calculating eligibility…"
        ) : (
          <>
            {selectedCount} selected · {eligibleEmail} can email · {withPhone} with phone
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onClear} className="rounded-full border border-white/20 px-3 py-1.5 text-sm font-medium">
          Clear
        </button>
        {withPhone > 0 && (
          <button
            disabled={loading}
            onClick={onWhatsApp}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
          >
            WhatsApp ({withPhone})
          </button>
        )}
        <button
          disabled={loading || !eligibleEmail}
          onClick={onCompose}
          className="rounded-full bg-[#E4F56C] px-4 py-1.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
        >
          Compose email
        </button>
      </div>
    </div>
  );
}
