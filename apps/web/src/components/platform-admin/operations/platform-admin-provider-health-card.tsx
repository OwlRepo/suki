import { Badge } from "@/components/ui/badge";
import type { PlatformAdminProviderHealthSnapshot } from "./platform-admin-operations.types";

export function PlatformAdminProviderHealthCard({
  snapshot,
}: {
  snapshot: PlatformAdminProviderHealthSnapshot;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-600">
            {formatProvider(snapshot.provider)} provider health
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatStatus(snapshot.status)}
          </p>
        </div>
        <Badge variant={snapshot.status === "healthy" ? "secondary" : "outline"}>
          {snapshot.status}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {snapshot.creditBalance === null
          ? "No credit balance reported."
          : `Credits: ${new Intl.NumberFormat("en-PH").format(snapshot.creditBalance)}`}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Observed {formatDateTime(snapshot.observedAt)}
      </p>
    </section>
  );
}

function formatProvider(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  if (!value) return "not yet";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
