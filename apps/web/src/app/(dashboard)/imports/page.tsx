"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

interface Business {
  id: string;
  name: string;
}

interface ParsedRow {
  name: string;
  mobile?: string;
  notes?: string;
  rowIndex: number;
}

interface DuplicateMatch {
  rowIndex: number;
  existingId: string;
  existingName: string;
  reason: "name" | "mobile" | "both";
}

function ImportsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"paste" | "review" | "done">("paste");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);

  const loadBusinesses = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ businesses: Business[] }>("/businesses", { token });
    setBusinesses(res.businesses);
    if (res.businesses.length) setSelectedBiz(res.businesses[0].id);
  };

  useEffect(() => {
    if (syncData) loadBusinesses();
  }, [syncData]);

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
      alert(err instanceof Error ? err.message : "Parse failed");
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

  const handleCommit = async () => {
    if (!selectedBiz || !parsedRows.length) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ imported: number }>("/imports/commit", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          rows: parsedRows,
          skipRows: Array.from(skipRows),
        }),
      });
      setImported(res.imported);
      setStep("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCsvText("");
    setParsedRows([]);
    setParseErrors([]);
    setDuplicates([]);
    setSkipRows(new Set());
    setStep("paste");
  };

  if (!syncData) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length) {
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
        <h1 className="text-2xl font-semibold text-foreground">Import customers</h1>
        <p className="mt-2 text-muted-foreground">Successfully imported {imported} customers.</p>
        <Button className="mt-4" onClick={reset}>
          Import more
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Import customers</h1>
        <select
          value={selectedBiz}
          onChange={(e) => setSelectedBiz(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Paste CSV with columns: name, mobile (optional), notes (optional). First row = headers.
      </p>

      {step === "paste" && (
        <div className="mt-4">
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="name,mobile,notes&#10;Alice,555-1234,VIP&#10;Bob,555-5678,"
            rows={10}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <Button className="mt-2" onClick={handleParse} disabled={loading}>
            {loading ? "Parsing..." : "Parse & detect duplicates"}
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Import</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Mobile</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r) => {
                  const dup = duplicates.find((d) => d.rowIndex === r.rowIndex);
                  const isSkipped = skipRows.has(r.rowIndex);
                  return (
                    <tr key={r.rowIndex} className="border-t border-border">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!isSkipped}
                          onChange={() => toggleSkip(r.rowIndex)}
                        />
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.mobile ?? "—"}</td>
                      <td className="px-3 py-2">{r.notes ?? "—"}</td>
                      <td className="px-3 py-2">
                        {dup ? (
                          <span className="text-amber-600">
                            {dup.reason}: {dup.existingName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCommit} disabled={loading}>
              {loading ? "Importing..." : "Import unchecked rows"}
            </Button>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
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
