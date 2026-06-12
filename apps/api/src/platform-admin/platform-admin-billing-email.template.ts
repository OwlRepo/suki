import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EmailAttachment } from "../messaging/providers/email.provider";

export interface ManualBillingEmailItem {
  sku: string;
  purchaseKind: string;
  planType?: string | null;
  billingInterval?: string | null;
  coverageStartsAt?: Date | null;
  coverageEndsAt?: Date | null;
  quantity: number;
  units: number;
}

interface PaymentRequestEmailInput {
  organizationName: string;
  referenceNumber: string;
  totalAmountPhp: number;
  dueAt?: Date | null;
  paymentInstructions: string;
  items: ManualBillingEmailItem[];
}

interface PaymentAcknowledgmentEmailInput {
  organizationName: string;
  referenceNumber: string;
  verifiedAmountPhp: number;
  paymentMethod: string;
  items: ManualBillingEmailItem[];
}

export interface ManualBillingProFormaInvoiceContent {
  title: "PRO FORMA INVOICE";
  sellerName: "Tyvera";
  customerName: string;
  referenceNumber: string;
  issueDate: string;
  dueDate: string | null;
  lines: Array<{
    description: string;
    detail?: string | null;
    quantity: number;
    amountPhp: number;
  }>;
  totalAmountPhp: number;
  paymentInstructions: string;
  disclaimer: string;
}

export function buildManualBillingPaymentRequestEmail(
  input: PaymentRequestEmailInput,
): { subject: string; body: string } {
  const summary = buildItemSummary(input.items);
  const isSubscription = input.items.some(
    (item) => item.purchaseKind === "subscription",
  );
  const lines = [
    "Tyvera Payment Request",
    "",
    `Organization: ${input.organizationName}`,
    `Reference: ${input.referenceNumber}`,
    ...summary,
    `Amount due: ${formatPhp(input.totalAmountPhp)}`,
    input.dueAt ? `Due date: ${formatDate(input.dueAt)}` : null,
    "",
    "Payment instructions:",
    input.paymentInstructions,
    "",
    "After payment, reply with your transaction reference.",
    isSubscription
      ? "Your subscription will activate after verification."
      : "Credits will be applied after verification.",
    "",
    "A non-tax Pro Forma Invoice is attached for reference.",
  ].filter((line): line is string => line !== null);

  return {
    subject: `Tyvera Payment Request - ${input.referenceNumber}`,
    body: lines.join("\n"),
  };
}

export function buildManualBillingPaymentAcknowledgmentEmail(
  input: PaymentAcknowledgmentEmailInput,
): { subject: string; body: string } {
  const isSubscription = input.items.some(
    (item) => item.purchaseKind === "subscription",
  );
  return {
    subject: `Tyvera Payment Acknowledgment - ${input.referenceNumber}`,
    body: [
      "Tyvera Payment Acknowledgment",
      "",
      `Organization: ${input.organizationName}`,
      `Reference: ${input.referenceNumber}`,
      ...buildItemSummary(input.items),
      `Verified amount: ${formatPhp(input.verifiedAmountPhp)}`,
      `Payment method: ${formatLabel(input.paymentMethod)}`,
      "Status: Verified",
      isSubscription
        ? "Subscription status: Activated"
        : "Credit status: Applied",
    ].join("\n"),
  };
}

export function buildManualBillingProFormaInvoiceContent(
  input: PaymentRequestEmailInput & { issuedAt: Date },
): ManualBillingProFormaInvoiceContent {
  return {
    title: "PRO FORMA INVOICE",
    sellerName: "Tyvera",
    customerName: input.organizationName,
    referenceNumber: input.referenceNumber,
    issueDate: formatDate(input.issuedAt),
    dueDate: input.dueAt ? formatDate(input.dueAt) : null,
    lines: input.items.map((item) => ({
      description:
        item.purchaseKind === "subscription"
          ? `Tyvera ${formatLabel(item.planType ?? item.sku)} ${formatLabel(
              item.billingInterval ?? "",
            )} subscription`.replace(/\s+/g, " ").trim()
          : `Tyvera ${item.sku} add-on`,
      detail:
        item.purchaseKind === "subscription" &&
        item.coverageStartsAt &&
        item.coverageEndsAt
          ? `Coverage: ${formatDate(item.coverageStartsAt)} to ${formatDate(
              item.coverageEndsAt,
            )}`
          : null,
      quantity: item.quantity,
      amountPhp:
        input.items.length === 1
          ? input.totalAmountPhp
          : Math.round(input.totalAmountPhp / input.items.length),
    })),
    totalAmountPhp: input.totalAmountPhp,
    paymentInstructions: input.paymentInstructions,
    disclaimer:
      "This Pro Forma Invoice is a payment request only. It is not a tax invoice, official receipt, or proof of payment, and is not valid for input tax claims.",
  };
}

export async function buildManualBillingProFormaInvoiceAttachment(
  input: PaymentRequestEmailInput & { issuedAt: Date },
): Promise<EmailAttachment> {
  const content = buildManualBillingProFormaInvoiceContent(input);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.06, 0.16, 0.29);
  const blue = rgb(0.12, 0.42, 0.72);
  const slate = rgb(0.28, 0.33, 0.4);
  const light = rgb(0.95, 0.97, 0.99);
  const margin = 48;
  const width = page.getWidth() - margin * 2;

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 112,
    width: page.getWidth(),
    height: 112,
    color: navy,
  });
  page.drawText(content.sellerName, {
    x: margin,
    y: 778,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(content.title, {
    x: margin,
    y: 745,
    size: 16,
    font: bold,
    color: rgb(0.75, 0.87, 1),
  });

  drawLabelValue("Reference", content.referenceNumber, margin, 692);
  drawLabelValue("Issue date", content.issueDate, margin + 260, 692);
  drawLabelValue("Bill to", content.customerName, margin, 650);
  if (content.dueDate) {
    drawLabelValue("Due date", content.dueDate, margin + 260, 650);
  }

  page.drawRectangle({
    x: margin,
    y: 570,
    width,
    height: 34,
    color: light,
  });
  page.drawText("DESCRIPTION", {
    x: margin + 12,
    y: 582,
    size: 9,
    font: bold,
    color: slate,
  });
  page.drawText("QTY", {
    x: margin + 360,
    y: 582,
    size: 9,
    font: bold,
    color: slate,
  });
  page.drawText("AMOUNT", {
    x: margin + 420,
    y: 582,
    size: 9,
    font: bold,
    color: slate,
  });

  let y = 542;
  for (const line of content.lines) {
    page.drawText(line.description, {
      x: margin + 12,
      y,
      size: 10,
      font: regular,
      color: navy,
      maxWidth: 330,
    });
    if (line.detail) {
      page.drawText(line.detail, {
        x: margin + 12,
        y: y - 15,
        size: 8,
        font: regular,
        color: slate,
        maxWidth: 330,
      });
    }
    page.drawText(String(line.quantity), {
      x: margin + 368,
      y,
      size: 10,
      font: regular,
      color: navy,
    });
    page.drawText(formatPhpForPdf(line.amountPhp), {
      x: margin + 420,
      y,
      size: 10,
      font: regular,
      color: navy,
    });
    y -= line.detail ? 42 : 32;
  }

  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: margin + width, y: y + 10 },
    color: rgb(0.82, 0.85, 0.89),
  });
  page.drawText("TOTAL DUE", {
    x: margin + 310,
    y: y - 18,
    size: 11,
    font: bold,
    color: navy,
  });
  page.drawText(formatPhpForPdf(content.totalAmountPhp), {
    x: margin + 420,
    y: y - 18,
    size: 13,
    font: bold,
    color: blue,
  });

  page.drawText("PAYMENT INSTRUCTIONS", {
    x: margin,
    y: 392,
    size: 10,
    font: bold,
    color: navy,
  });
  drawWrappedText(content.paymentInstructions, margin, 370, width, 10, slate);

  page.drawRectangle({
    x: margin,
    y: 150,
    width,
    height: 78,
    color: rgb(1, 0.97, 0.9),
    borderColor: rgb(0.88, 0.67, 0.2),
    borderWidth: 1,
  });
  page.drawText("VALIDATION-STAGE DOCUMENT", {
    x: margin + 14,
    y: 204,
    size: 10,
    font: bold,
    color: rgb(0.55, 0.35, 0.02),
  });
  drawWrappedText(
    content.disclaimer,
    margin + 14,
    184,
    width - 28,
    9,
    rgb(0.45, 0.3, 0.05),
  );

  const bytes = await pdf.save();
  return {
    filename: `${input.referenceNumber}-pro-forma-invoice.pdf`,
    contentType: "application/pdf",
    content: bytes,
  };

  function drawLabelValue(
    label: string,
    value: string,
    x: number,
    labelY: number,
  ) {
    page.drawText(label.toUpperCase(), {
      x,
      y: labelY,
      size: 8,
      font: bold,
      color: slate,
    });
    page.drawText(value, {
      x,
      y: labelY - 17,
      size: 11,
      font: regular,
      color: navy,
    });
  }

  function drawWrappedText(
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    size: number,
    color: ReturnType<typeof rgb>,
  ) {
    let lineY = startY;
    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(/\s+/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (regular.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          page.drawText(line, { x, y: lineY, size, font: regular, color });
          lineY -= size + 4;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        page.drawText(line, { x, y: lineY, size, font: regular, color });
      }
      lineY -= size + 5;
    }
  }
}

function buildItemSummary(items: ManualBillingEmailItem[]) {
  return items.flatMap((item) => {
    if (item.purchaseKind === "subscription") {
      const lines = [
        `Plan: ${formatLabel(item.planType ?? item.sku)} ${formatLabel(
          item.billingInterval ?? "",
        )}`.trim(),
      ];
      if (item.coverageStartsAt && item.coverageEndsAt) {
        lines.push(
          `Coverage: ${formatDate(item.coverageStartsAt)} to ${formatDate(
            item.coverageEndsAt,
          )}`,
        );
      }
      return lines;
    }
    return [`Package: ${item.sku}`];
  });
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatPhp(amountPhp: number) {
  return `₱${new Intl.NumberFormat("en-PH").format(amountPhp)}`;
}

function formatPhpForPdf(amountPhp: number) {
  return `PHP ${new Intl.NumberFormat("en-PH").format(amountPhp)}`;
}
