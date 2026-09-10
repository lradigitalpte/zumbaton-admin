"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-3xl w-full">
      <div className="flex max-h-[85vh] flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Invoice {invoice.invoiceNumber}
            </h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {invoice.description || "—"}
              {invoice.billToName ? ` · ${invoice.billToName}` : ""}
              {invoice.billToEmail ? ` (${invoice.billToEmail})` : ""}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Amount
            </span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {invoice.currency} {(invoice.totalCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          {invoice.pdfUrl ? (
            <iframe src={invoice.pdfUrl} title={`Invoice ${invoice.invoiceNumber}`} className="h-[55vh] w-full" />
          ) : (
            <div className="flex h-[55vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={handleClose}>
              Close
            </Button>
            {sent ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Sent
              </span>
            ) : (
              <Button
                size="sm"
                startIcon={<Send className="h-4 w-4" />}
                onClick={handleSend}
                disabled={sending || !invoice.pdfUrl}
              >
                {sending ? "Sending..." : "Send to Customer"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
