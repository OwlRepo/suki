"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function IntakePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          mobile: mobile.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || "Failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Thank you</h1>
        <p className="mt-2 text-muted-foreground">
          Your information has been recorded. We will be in touch.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground text-center">
        Customer intake
      </h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Mobile (optional)
          </label>
          <Input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="w-full"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  );
}
