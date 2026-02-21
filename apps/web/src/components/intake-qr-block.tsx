"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

interface IntakeQRBlockProps {
  businessId: string;
  businessName: string;
  className?: string;
  /** Override heading (default: "Customer intake link") */
  heading?: string;
  /** Override helper text (default: "Share this link or QR code so customers can add themselves to your list.") */
  helperText?: string;
  /** Override copy button label (default: "Copy link") */
  copyLabel?: string;
  /** Show Print QR code button */
  showPrintButton?: boolean;
}

export function IntakeQRBlock({
  businessId,
  businessName,
  className = "",
  heading = "Customer intake link",
  helperText = "Share this link or QR code so customers can add themselves to your list.",
  copyLabel = "Copy link",
  showPrintButton = false,
}: IntakeQRBlockProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const intakeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/intake/${businessId}`
      : "";

  useEffect(() => {
    if (!intakeUrl) return;
    QRCode.toDataURL(intakeUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [intakeUrl]);

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR Code</title></head>
      <body style="margin:1rem;text-align:center;font-family:sans-serif;">
        <h2 style="margin-bottom:0.5rem;">Customer intake</h2>
        <p style="color:#666;margin-bottom:1rem;">Share or print this QR code for customers to register.</p>
        <img src="${qrDataUrl}" alt="QR code" width="200" height="200" />
        <p style="margin-top:1rem;font-size:12px;color:#888;">${intakeUrl}</p>
        <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>
    `);
    w.document.close();
  };

  const handleCopy = async () => {
    if (!intakeUrl) return;
    try {
      await navigator.clipboard.writeText(intakeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy
      const input = document.createElement("input");
      input.value = intakeUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 ${className}`}
      role="region"
      aria-labelledby="intake-qr-heading"
    >
      <h2
        id="intake-qr-heading"
        className="text-base font-medium text-foreground"
      >
        {heading}
      </h2>
      <p className="mt-1 text-base text-muted-foreground">
        {helperText}
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {qrDataUrl && (
          <div className="shrink-0">
            <div className="rounded border border-border bg-white p-2 shadow-sm">
              <img
                src={qrDataUrl}
                alt="QR code for customer intake form"
                width={200}
                height={200}
                className="block"
              />
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="rounded border border-input bg-muted/30 px-3 py-2 font-mono text-sm text-foreground break-all">
            {intakeUrl || "Loading…"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={handleCopy}
              className="min-h-[44px] text-base"
            >
              {copied ? "Copied" : copyLabel}
            </Button>
            {showPrintButton && (
              <Button
                size="lg"
                variant="outline"
                onClick={handlePrint}
                className="min-h-[44px] text-base"
              >
                Print QR code
              </Button>
            )}
          </div>
          <div className="flex-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs font-medium text-foreground">How to use</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Print the QR and place at your counter, or copy the link and share via SMS, WhatsApp, or email. Customers tap or scan to register—no paperwork.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
