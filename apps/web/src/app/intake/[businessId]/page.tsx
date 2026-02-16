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
        <h1 className="text-2xl font-semibold text-foreground">
          Thank you
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Your information has been recorded. We will be in touch.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-semibold text-foreground">
        Customer intake
      </h1>
      <p className="mt-2 text-center text-base text-muted-foreground">
        Enter your details to join our list.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="intake-name"
            className="mb-1 block text-base font-medium text-foreground"
          >
            Your name
          </label>
          <Input
            id="intake-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maria Santos"
            required
            className="min-h-[44px] w-full text-base"
          />
        </div>
        <div>
          <label
            htmlFor="intake-mobile"
            className="mb-1 block text-base font-medium text-foreground"
          >
            Mobile number (optional)
          </label>
          <Input
            id="intake-mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="min-h-[44px] w-full text-base"
          />
        </div>
        {error && (
          <p className="text-base text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="min-h-[44px] w-full text-base"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  );
}
