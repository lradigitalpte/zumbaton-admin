"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Download, Send, CheckCircle2 } from "lucide-react";

export interface PreviewInvoice {
  id: string;
  invoiceNumber: string;
  description: string | null;
  totalCents: number;
  currency: string;
  pdfUrl: string | null;
  billToName?: string | null;
  billToEmail?: string | null;
  originalAmountCents?: number | null;
  discountPercent?: number | null;
  discountAmountCents?: number | null;
}

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: PreviewInvoice | null;
}

/**
 * Shows the invoice PDF for review before it's actually emailed. Nothing
 * gets sent to the customer until "Send to Customer" is clicked here.
 */
export function InvoicePreviewModal({ isOpen, onClose, invoice }: InvoicePreviewModalProps) {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSending(true);
    try {
      const response = await api.post<{ success?: boolean; error?: { message: string } }>(
        `/api/invoices/${invoice.id}/resend`,
        {}
      );
      if (response.error) {
        showToast(response.error.message || "Failed to send invoice", "error");
        return;
      }
      setSent(true);
      showToast("Invoice sent to customer", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to send invoice", "error");
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  const hasDiscount = !!(
    invoice.originalAmountCents &&
    invoice.originalAmountCents > invoice.totalCents
  );
  const discountAmountCents =
    invoice.discountAmountCents && invoice.discountAmountCents > 0
      ? invoice.discountAmountCents
      : hasDiscount
        ? (invoice.originalAmountCents as number) - invoice.totalCents
        : 0;
  const discountPercent =
    invoice.discountPercent && invoice.discountPercent > 0
      ? invoice.discountPercent
      : hasDiscount && invoice.originalAmountCents
        ? Math.round((discountAmountCents / invoice.originalAmountCents) * 100)
        : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton={false}
      className="max-w-3xl w-full !rounded-[28px] !border-neutral-200/80 !shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
    >
      <div className="flex max-h-[85vh] flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Invoice {invoice.invoiceNumber}
            </h4>
            <p className="mt-1 text-sm text-neutral-500 dark:text-white/60">
              {invoice.description || "—"}
              {invoice.billToName ? ` · ${invoice.billToName}` : ""}
              {invoice.billToEmail ? ` (${invoice.billToEmail})` : ""}
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="shrink-0 text-right">
              <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                {hasDiscount ? "Total Paid" : "Amount"}
              </span>
              {hasDiscount && (
                <span className="block text-sm text-neutral-400 line-through">
                  {invoice.currency} {((invoice.originalAmountCents as number) / 100).toFixed(2)}
                </span>
              )}
              <span className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {invoice.currency} {(invoice.totalCents / 100).toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="mt-1 block rounded-full bg-[#E4F56C] px-2.5 py-0.5 text-xs font-semibold text-neutral-950">
                  {discountPercent}% off (−{invoice.currency} {(discountAmountCents / 100).toFixed(2)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-neutral-950">
          {invoice.pdfUrl ? (
            <iframe src={invoice.pdfUrl} title={`Invoice ${invoice.invoiceNumber}`} className="h-[55vh] w-full" />
          ) : (
            <div className="flex h-[55vh] items-center justify-center text-sm text-neutral-500">
              No PDF available for this invoice.
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {invoice.pdfUrl ? (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50"
            >
              Close
            </button>
            {sent ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F56C] px-4 py-2.5 text-sm font-semibold text-neutral-950">
                <CheckCircle2 className="h-4 w-4" /> Sent
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !invoice.pdfUrl}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send to Customer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
