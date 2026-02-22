"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { PageHeader } from "@/components/ui/page-header";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { ListSkeleton } from "@/components/ui/skeleton";
import { fromError } from "@/lib/ui-feedback";
import { AiQuotaBanner } from "@/components/ai-quota-banner";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Business {
  id: string;
  name: string;
}

interface ParsedRow {
  name: string;
  mobile?: string;
  email?: string;
  notes?: string;
  rowIndex: number;
}

interface DuplicateMatch {
  rowIndex: number;
  existingId: string;
  existingName: string;
  reason: "name" | "mobile" | "both";
}

interface ReconciliationReport {
  batchId: string;
  imported: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
  createdAt: string;
}

interface DryRunResult {
  mode: string;
  wouldImport: number;
  wouldSkip: number;
  duplicateCount: number;
  validationReport: { totalRows: number; validRows: number; errorCount: number };
}

function ImportsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"source" | "upload" | "paste" | "review" | "dryrun" | "done">("source");
  const [source, setSource] = useState<"csv" | "hubspot" | "pipedrive">("csv");
  const [hubspotToken, setHubspotToken] = useState("");
  const [pipedriveToken, setPipedriveToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [batches, setBatches] = useState<Array<{
    id: string;
    businessId: string;
    source: string;
    entityType: string;
    status: string;
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    createdAt: string;
  }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [batchDetail, setBatchDetail] = useState<{
    id: string;
    errorDetails: Array<{ rowIndex: number; message: string }>;
    customerIds: string[];
  } | null>(null);
  const [confirmImportCount, setConfirmImportCount] = useState<number | null>(null);
  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false);


  const handleFetchProvider = async () => {
    if (source === "hubspot" && !hubspotToken.trim()) return;
    if (source === "pipedrive" && !pipedriveToken.trim()) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ rows: ParsedRow[]; source: string }>("/imports/fetch-provider", {
        method: "POST",
        token,
        body: JSON.stringify({
          provider: source,
          credentials:
            source === "hubspot"
              ? { accessToken: hubspotToken.trim() }
              : { apiToken: pipedriveToken.trim() },
        }),
      });
      setParsedRows(res.rows);
      setParseErrors([]);
      if (res.rows.length) {
        const dupRes = await apiRequest<{ duplicates: DuplicateMatch[] }>("/imports/duplicates", {
          method: "POST",
          token,
          body: JSON.stringify({ businessId: selectedBiz, rows: res.rows }),
        });
        setDuplicates(dupRes.duplicates);
        setSkipRows(new Set());
      }
      setStep("review");
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Fetch failed. Please check your token and try again.") });
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ rows: ParsedRow[]; errors: string[] }>("/imports/parse", {
        method: "POST",
        token,
        body: JSON.stringify({ csv: csvText }),
      });
      setParsedRows(res.rows);
      setParseErrors(res.errors);
      if (res.rows.length) {
        const dupRes = await apiRequest<{ duplicates: DuplicateMatch[] }>("/imports/duplicates", {
          method: "POST",
          token,
          body: JSON.stringify({ businessId: selectedBiz, rows: res.rows }),
        });
        setDuplicates(dupRes.duplicates);
        setSkipRows(new Set());
      }
      setStep("review");
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Parse failed. Please check your file format and try again.") });
    } finally {
      setLoading(false);
    }
  };

  const toggleSkip = (rowIndex: number) => {
    setSkipRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const handleDryRun = async () => {
    if (!selectedBiz || !parsedRows.length) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<DryRunResult>("/imports/dry-run", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          rows: parsedRows,
          skipRows: Array.from(skipRows),
        }),
      });
      setDryRunResult(res);
      setStep("dryrun");
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Dry run failed. Please try again.") });
    } finally {
      setLoading(false);
    }
  };

  const doCommit = async () => {
    if (!selectedBiz || !parsedRows.length) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ imported: number; report: ReconciliationReport }>("/imports/commit", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          rows: parsedRows,
          skipRows: Array.from(skipRows),
          source: source === "csv" ? "csv" : source,
        }),
      });
      setImported(res.imported);
      setReport(res.report ?? null);
      recordOnboardingEvent("import_completed", syncData?.organization?.id ?? null);
      setStep("done");
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Import failed. Please try again.") });
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = () => {
    if (!selectedBiz || !parsedRows.length) return;
    const toImport = parsedRows.filter((r) => !skipRows.has(r.rowIndex)).length;
    if (toImport > 0) {
      setConfirmImportCount(toImport);
    } else {
      doCommit();
    }
  };

  const handleRollback = () => {
    if (report?.batchId) setConfirmRollbackOpen(true);
  };

  const doRollback = async () => {
    if (!report?.batchId) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/imports/batches/${report.batchId}/rollback`, {
        method: "POST",
        token,
      });
      setReport(null);
      reset();
      setConfirmRollbackOpen(false);
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Rollback failed. Please try again.") });
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<Array<{
        id: string;
        businessId: string;
        source: string;
        entityType: string;
        status: string;
        importedCount: number;
        skippedCount: number;
        errorCount: number;
        createdAt: string;
      }>>(`/imports/batches${selectedBiz ? `?businessId=${selectedBiz}` : ""}`, {
        token,
      });
      setBatches(res ?? []);
    } catch {
      setBatches([]);
    }
  }, [getToken, selectedBiz]);

  const fetchBatchDetail = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{
        id: string;
        errorDetails: Array<{ rowIndex: number; message: string }>;
        customerIds: string[];
      }>(`/imports/batches/${id}`, {
        method: "GET",
        token,
      });
      setBatchDetail(res ?? null);
    } catch {
      setBatchDetail(null);
    }
  };

  useEffect(() => {
    if (syncData) fetchBatches();
  }, [syncData, fetchBatches]);

  useEffect(() => {
    if (selectedBatchId) fetchBatchDetail(selectedBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  const reset = () => {
    setCsvText("");
    setParsedRows([]);
    setParseErrors([]);
    setDuplicates([]);
    setSkipRows(new Set());
    setReport(null);
    setDryRunResult(null);
    setStatus(null);
    setStep("source");
    fetchBatches();
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64 ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      if (isXlsx) {
        const base64 = await fileToBase64(file);
        const res = await apiRequest<{ rows: ParsedRow[]; errors: string[] }>("/imports/parse", {
          method: "POST",
          token,
          body: JSON.stringify({ xlsxBase64: base64 }),
        });
        setParsedRows(res.rows);
        setParseErrors(res.errors);
        if (res.rows.length) {
          const dupRes = await apiRequest<{ duplicates: DuplicateMatch[] }>("/imports/duplicates", {
            method: "POST",
            token,
            body: JSON.stringify({ businessId: selectedBiz, rows: res.rows }),
          });
          setDuplicates(dupRes.duplicates);
          setSkipRows(new Set());
        }
        setStep("review");
      } else {
        const text = await file.text();
        setCsvText(text);
        setStep("paste");
      }
    } catch (err) {
      setStatus({ type: "error", message: fromError(err, "Failed to read file. Please try a different file.") });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  if (!syncData) {
    return (
      <div className="space-y-8">
        <div>
          <AiQuotaBanner />
          <PageHeader
            title="Import customers"
            plainLanguageDescription="Add customers from a file or another CRM. Your existing data stays safe."
            whatThisPageIsFor="Bring in customer names and numbers from spreadsheets or HubSpot, Pipedrive."
            whatToDoNext="Upload a file or paste CSV, then review and confirm. Download a sample file first if needed."
          />
          <ListSkeleton rowCount={4} className="mt-6" />
        </div>
      </div>
    );
  }

  if (!workspace?.loading && !businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Import customers</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div>
        <PageHeader
          title="Import customers"
          plainLanguageDescription="Import complete. Your new customers are ready."
        />
        <StatusBanner
          variant="success"
          message={`Successfully imported ${imported} customer${imported !== 1 ? "s" : ""}. They are now in your customer list.`}
          className="mt-4"
        />
        {report && (
          <Card className="mt-6 rounded-lg p-4">
            <CardContent className="p-0">
            <h3 className="font-medium text-foreground">Reconciliation report</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Batch ID: {report.batchId.slice(0, 8)}… • Imported: {report.imported} • Skipped: {report.skipped}
              {report.errors.length > 0 && ` • Errors: ${report.errors.length}`}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => handleRollback()} disabled={loading}>
              {loading ? "Rolling back…" : "Rollback this import"}
            </Button>
            </CardContent>
          </Card>
        )}
        <PrimaryPageAction
          primaryAction={
            <Button size="lg" className="mt-6 min-h-[44px] text-base" onClick={reset}>
              Import more
            </Button>
          }
          hintText="Add another batch anytime. Your existing customers stay safe."
        />
      </div>
    );
  }

  if (step === "dryrun") {
    return (
      <div>
        <PageHeader
          title="Import customers"
          plainLanguageDescription="Step 3: Confirm"
          whatThisPageIsFor="Preview what will be added before going live."
          whatToDoNext="Review the preview below, then click Go live when ready."
        />
        <StatusBanner
          variant="info"
          message="Your existing customers are safe. This will only add new customers to your list."
          className="mt-4"
        />
        <h3 className="mt-6 font-medium text-foreground">Dry-run preview</h3>
        {dryRunResult && (
          <Card className="mt-2 rounded-lg p-4">
            <CardContent className="p-0">
            <p className="text-sm text-muted-foreground">
              Would import: {dryRunResult.wouldImport} • Would skip: {dryRunResult.wouldSkip} •
              Duplicates: {dryRunResult.duplicateCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Validation: {dryRunResult.validationReport.validRows}/{dryRunResult.validationReport.totalRows} valid
              {dryRunResult.validationReport.errorCount > 0 &&
                ` • ${dryRunResult.validationReport.errorCount} errors`}
            </p>
            </CardContent>
          </Card>
        )}
        <div className="mt-6 flex gap-2">
          <Button onClick={handleCommit} disabled={loading}>
            {loading ? "Importing…" : "Go live"}
          </Button>
          <Button variant="outline" onClick={() => setStep("review")}>
            Back to review
          </Button>
        </div>
      </div>
    );
  }

  const stepOrder = [
    { key: "upload", label: "Step 1: Upload" },
    { key: "review", label: "Step 2: Review" },
    { key: "confirm", label: "Step 3: Confirm" },
  ];
  const stepToIndex: Record<string, number> = {
    source: 0,
    upload: 0,
    paste: 0,
    review: 1,
    dryrun: 2,
  };
  const currentStepIndex = stepToIndex[step] ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <AiQuotaBanner />
        <PageHeader
          title="Import customers"
          plainLanguageDescription="Add customers from a file or another CRM. Your existing data stays safe."
          whatThisPageIsFor="Bring in customer names and numbers from spreadsheets or HubSpot, Pipedrive."
          whatToDoNext="Upload a file or paste CSV, then review and confirm. Download a sample file first if needed."
        />

        <p className="mt-4 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 text-base text-foreground">
          <strong>Your existing customers are safe.</strong> Nothing will be deleted. We add new customers and check for duplicates before importing.
        </p>

        {status && (
          <StatusBanner
            variant={status.type}
            message={status.message}
            onDismiss={() => setStatus(null)}
            className="mt-4"
          />
        )}

        <ConfirmDialog
          open={confirmImportCount != null && confirmImportCount > 0}
          onOpenChange={(o) => !o && setConfirmImportCount(null)}
          title="Import customers"
          description={`Import ${confirmImportCount ?? 0} customer(s)? This will add them to your list. Your existing customers stay safe.`}
          confirmLabel="Yes, import"
          cancelLabel="Cancel"
          onConfirm={doCommit}
          loading={loading}
        />

        <ConfirmDialog
          open={confirmRollbackOpen}
          onOpenChange={(o) => !o && setConfirmRollbackOpen(false)}
          title="Rollback this import"
          description="Rollback will delete all customers from this import. This cannot be undone. Continue?"
          confirmLabel="Yes, rollback"
          cancelLabel="No, keep them"
          destructive
          onConfirm={doRollback}
          loading={loading}
        />

        <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="navigation" aria-label="Import steps">
          {stepOrder.map((s, i) => (
            <span key={s.key} className="flex items-center gap-2">
              <span className={i <= currentStepIndex ? "font-medium text-foreground" : "text-muted-foreground"}>
                {s.label}
              </span>
              {i < stepOrder.length - 1 && <span className="text-muted-foreground">→</span>}
            </span>
          ))}
        </div>

        <PrimaryPageAction
          primaryAction={
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                const a = document.createElement("a");
                a.href = "/sample-customers.csv";
                a.download = "sample-customers.csv";
                a.click();
              }}
            >
              Download sample file
            </Button>
          }
          hintText="Use this to see the correct format before uploading your own."
        />

      {batches.length > 0 && (
        <Card className="mt-6 rounded-lg p-4">
          <CardContent className="p-0">
          <h3 className="font-medium text-foreground">Reconciliation history</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Past imports for this workspace
          </p>
          <ul className="mt-3 space-y-2">
            {batches.slice(0, 10).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setSelectedBatchId(selectedBatchId === b.id ? null : b.id)}
                  className="text-left font-medium text-primary hover:underline"
                >
                  {b.id.slice(0, 8)}… • {b.importedCount} imported • {b.source}
                  {b.status === "rolled_back" && " (rolled back)"}
                </button>
                <span className="text-muted-foreground">
                  {new Date(b.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          {selectedBatchId && batchDetail && batchDetail.id === selectedBatchId && (
            <div className="mt-4 rounded border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">Batch details</p>
              <p className="mt-1 text-muted-foreground">
                {batchDetail.customerIds.length} customers in batch
                {batchDetail.errorDetails.length > 0 &&
                  ` • ${batchDetail.errorDetails.length} errors`}
              </p>
              {batchDetail.errorDetails.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                  {batchDetail.errorDetails.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      Row {e.rowIndex}: {e.message}
                    </li>
                  ))}
                  {batchDetail.errorDetails.length > 5 && (
                    <li>…and {batchDetail.errorDetails.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {step === "source" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm font-medium text-foreground">Import from</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={source === "csv" ? "default" : "outline"}
              onClick={() => setSource("csv")}
            >
              CSV / Excel
            </Button>
            <Button
              variant={source === "hubspot" ? "default" : "outline"}
              onClick={() => setSource("hubspot")}
            >
              HubSpot
            </Button>
            <Button
              variant={source === "pipedrive" ? "default" : "outline"}
              onClick={() => setSource("pipedrive")}
            >
              Pipedrive
            </Button>
          </div>
          {source === "hubspot" && (
            <Card className="rounded-lg p-4">
              <CardContent className="space-y-3 p-0">
              <Label className="block">HubSpot Private App token</Label>
              <p className="text-sm text-muted-foreground">
                How to get your token: In HubSpot, go to{" "}
                <strong>Settings → Integrations → Private Apps</strong> (or{" "}
                <strong>Development → Legacy Apps</strong> in older accounts). Create a private app,
                add scopes for contacts (e.g. <code className="rounded bg-muted px-1">crm.objects.contacts.read</code>),
                then copy the access token. You must be a super admin.
              </p>
              <a
                href="https://developers.hubspot.com/docs/guides/crm/private-apps/creating-private-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                HubSpot Private Apps docs →
              </a>
              <Input
                type="password"
                placeholder="pat-na1-xxxx"
                value={hubspotToken}
                onChange={(e) => setHubspotToken(e.target.value)}
                className="w-full"
              />
              <Button onClick={handleFetchProvider} disabled={loading || !hubspotToken.trim()}>
                {loading ? "Fetching…" : "Fetch contacts from HubSpot"}
              </Button>
              <p className="text-xs text-muted-foreground">
                HubSpot screens may have changed. Search &quot;HubSpot private app&quot; or refer to official docs if steps differ.
              </p>
              </CardContent>
            </Card>
          )}
          {source === "pipedrive" && (
            <Card className="rounded-lg p-4">
              <CardContent className="space-y-3 p-0">
              <Label className="block">Pipedrive API token</Label>
              <p className="text-sm text-muted-foreground">
                How to get your token: Click your account name (top right) →{" "}
                <strong>Company settings</strong> →{" "}
                <strong>Personal preferences</strong> → <strong>API</strong>. Copy your API token.
              </p>
              <a
                href="https://app.pipedrive.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open Pipedrive API settings →
              </a>
              <Input
                type="password"
                placeholder="API token from Settings → Personal preferences → API"
                value={pipedriveToken}
                onChange={(e) => setPipedriveToken(e.target.value)}
                className="w-full"
              />
              <Button onClick={handleFetchProvider} disabled={loading || !pipedriveToken.trim()}>
                {loading ? "Fetching…" : "Fetch contacts from Pipedrive"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Pipedrive screens may have changed. Search &quot;Pipedrive API token&quot; or refer to{" "}
                <a href="https://pipedrive.readme.io/docs/how-to-find-the-api-token" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  official docs
                </a>{" "}
                if steps differ.
              </p>
              </CardContent>
            </Card>
          )}
          {source === "csv" && (
            <Button onClick={() => setStep("upload")} size="lg" className="min-h-[44px] text-base">
              Continue to CSV / Excel
            </Button>
          )}
        </div>
      )}

      {step === "upload" && (
        <div className="mt-8 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("source")}
            className="mb-2 text-sm text-muted-foreground"
          >
            ← Change source
          </Button>
          <Card className="rounded-lg p-4">
            <CardContent className="p-0">
            <label
              htmlFor="file-upload"
              className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-input p-4 text-center transition-colors hover:bg-muted/50"
            >
              <span className="text-base font-medium text-foreground">
                {loading ? "Processing…" : "Choose CSV or Excel file"}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                .csv, .xlsx supported
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={loading}
                className="sr-only"
              />
            </label>
            </CardContent>
          </Card>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">or</span>
          </div>
          <Button
            variant="outline"
            onClick={() => setStep("paste")}
            className="min-h-[44px] text-base"
          >
            Paste CSV instead
          </Button>
        </div>
      )}

      {step === "paste" && (
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("upload")}
            className="mb-2 text-sm text-muted-foreground"
          >
            Back to file upload
          </Button>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="name,mobile,email,notes&#10;Alice,555-1234,alice@example.com,VIP&#10;Bob,555-5678,,Regular"
            rows={10}
            className="min-h-[120px] w-full font-mono"
          />
          <Button
            className="mt-2 min-h-[44px] text-base"
            onClick={handleParse}
            disabled={loading || !csvText.trim()}
          >
            {loading ? "Checking for duplicates…" : "Parse and check duplicates"}
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="mt-6 space-y-4">
          {parseErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Parse warnings:</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                {parseErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {parsedRows.length} rows to import. Uncheck rows that are duplicates.
          </p>
          <div className="max-h-80 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-muted hover:bg-muted">
                  <TableHead className="px-3 py-2">Import</TableHead>
                  <TableHead className="px-3 py-2">Name</TableHead>
                  <TableHead className="px-3 py-2">Mobile</TableHead>
                  <TableHead className="px-3 py-2">Email</TableHead>
                  <TableHead className="px-3 py-2">Notes</TableHead>
                  <TableHead className="px-3 py-2">Duplicate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((r) => {
                  const dup = duplicates.find((d) => d.rowIndex === r.rowIndex);
                  const isSkipped = skipRows.has(r.rowIndex);
                  return (
                    <TableRow key={r.rowIndex}>
                      <TableCell className="px-3 py-2">
                        <Checkbox
                          checked={!isSkipped}
                          onCheckedChange={() => toggleSkip(r.rowIndex)}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">{r.name}</TableCell>
                      <TableCell className="px-3 py-2">{r.mobile ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2">{r.email ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2">{r.notes ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2">
                        {dup ? (
                          <span className="text-amber-600">
                            {dup.reason}: {dup.existingName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDryRun} disabled={loading}>
              {loading ? "Running dry-run…" : "Dry-run preview"}
            </Button>
            <Button onClick={handleCommit} disabled={loading}>
              {loading ? "Importing…" : "Go live"}
            </Button>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function ImportsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Import customers</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to import customers.
        </p>
      </div>
    );
  }
  return <ImportsPageContent />;
}
