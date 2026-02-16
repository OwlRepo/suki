"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

interface IntakeQRBlockProps {
  businessId: string;
  businessName: string;
  className?: string;
}

export function IntakeQRBlock({
  businessId,
  businessName,
  className = "",
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
        Customer intake link
      </h2>
      <p className="mt-1 text-base text-muted-foreground">
        Share this link or QR code so customers can add themselves to your list.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        {qrDataUrl && (
          <div className="rounded border border-border bg-white p-2">
            <img
              src={qrDataUrl}
              alt="QR code for customer intake form"
              width={200}
              height={200}
              className="block"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded border border-input bg-muted/30 px-3 py-2 font-mono text-sm text-foreground break-all">
            {intakeUrl || "Loading…"}
          </div>
          <Button
            size="lg"
            variant="outline"
            onClick={handleCopy}
            className="min-h-[44px] text-base"
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
