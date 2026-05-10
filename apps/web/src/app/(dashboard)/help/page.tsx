"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  HELP_CONTENT,
  type HelpLocale,
  searchHelpContent,
  getGuidedOnboardingModules,
} from "@/lib/help-content";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<HelpLocale>("en");
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});

  const results = useMemo(() => {
    const searched = query.trim() ? searchHelpContent(query, locale) : HELP_CONTENT.filter((item) => item.locale === locale).map((item) => ({ ...item, score: 0 }));
    return searched;
  }, [query, locale]);

  const onboardingModules = useMemo(() => getGuidedOnboardingModules(locale), [locale]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help Center"
        plainLanguageDescription="Find answers quickly with guided steps and plain language."
        whatThisPageIsFor="Search onboarding guides, feature how-tos, and usage answers."
        whatToDoNext="Type your question below or replay guided onboarding."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Help</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={locale === "en" ? "default" : "outline"} onClick={() => setLocale("en")} className="min-h-[44px]">English</Button>
            <Button variant={locale === "tl" ? "default" : "outline"} onClick={() => setLocale("tl")} className="min-h-[44px]">Tagalog</Button>
          </div>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "tl" ? "Hal: paano mag add ng customer" : "Example: how do I add a customer"}
            className="min-h-[48px] text-base"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guided Onboarding Replay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {onboardingModules.map((module) => (
            <div key={module.id} className="rounded-lg border p-4">
              <p className="text-base font-semibold">Step {module.sourceStepId}: {module.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p>
            </div>
          ))}
          <Link href="/onboarding-demo" className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-primary-foreground">
            Open Guided Demo
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.quickAnswer}</p>
              <div className="flex flex-wrap gap-2">
                {item.relatedRoutes.map((route) => (
                  <Link key={route} href={route} className="text-sm text-primary underline underline-offset-4">
                    {route}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant={feedback[item.id] === "up" ? "default" : "outline"}
                  onClick={() => setFeedback((prev) => ({ ...prev, [item.id]: "up" }))}
                >
                  Helpful
                </Button>
                <Button
                  size="sm"
                  variant={feedback[item.id] === "down" ? "default" : "outline"}
                  onClick={() => setFeedback((prev) => ({ ...prev, [item.id]: "down" }))}
                >
                  Not helpful
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-base">No source data available for that question yet.</p>
            <p className="text-sm text-muted-foreground">Try a different keyword or open guided onboarding replay.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/onboarding" className="text-sm text-primary underline underline-offset-4">Go to onboarding</Link>
              <Link href="/settings" className="text-sm text-primary underline underline-offset-4">Open settings</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
