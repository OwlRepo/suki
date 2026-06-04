export function buildManualFollowUpDigestEmail(input: {
  count: number;
  frontendUrl: string;
}): { subject: string; body: string } {
  const count = Math.max(0, Math.floor(input.count));
  const base = input.frontendUrl.replace(/\/+$/, "");
  const url = `${base}/needs-attention`;
  return {
    subject:
      count === 1
        ? "1 reminder needs attention"
        : `${count} reminders need attention`,
    body: [
      "Some automated SMS reminders could not be confirmed as sent.",
      "",
      `${count} reminder${count === 1 ? "" : "s"} need attention.`,
      "",
      `Review them securely in Tyvera: ${url}`,
    ].join("\n"),
  };
}
