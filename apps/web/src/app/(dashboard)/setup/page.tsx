"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

const BUSINESS_TYPES = [
  "salon",
  "clinic",
  "restaurant",
  "retail",
  "spa",
  "gym",
  "other",
];

function SetupPageContent() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data: syncData, loading: syncLoading } = useAuthSync();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessType) {
      setError("Please enter business name and select type");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await apiRequest("/businesses", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim(), businessType }),
      });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create business");
    } finally {
      setSubmitting(false);
    }
  };

  if (syncLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!syncData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">
          Sign in with Clerk to set up your business.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-foreground">Business setup</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set up your business profile to get started.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Business name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Business"
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Business type
          </label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select type</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create business"}
        </Button>
      </form>
    </div>
  );
}

export default function SetupPage() {
  if (!hasClerk) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to set up your business.
        </p>
      </div>
    );
  }
  return <SetupPageContent />;
}
