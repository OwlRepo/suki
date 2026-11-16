"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { HELP_CONTENT, type HelpLocale, searchHelpContent } from "@/lib/help-content";

const ROUTE_LABELS: Record<string, string> = {
  "/setup": "Business setup", "/onboarding": "Getting started", "/appointments": "Appointments",
  "/appointments?new=1": "New appointment", "/settings": "Settings", "/settings/billing": "Plan & usage",
  "/analytics": "Usage analytics", "/share-slots": "Share slots", "/needs-attention": "Needs attention",
};

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<HelpLocale>("en");
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const results = useMemo(() => query.trim()
    ? searchHelpContent(query, locale)
    : HELP_CONTENT.filter((item) => item.locale === locale).map((item) => ({ ...item, score: 0 })), [query, locale]);

  return (
    <div className="space-y-6" lang={locale}>
      <PageHeader title="Help" plainLanguageDescription={locale === "tl" ? "Maiikling sagot at direktang link para sa iyong gawain." : "Short answers and direct links to your next task."} />
      <div className="flex flex-wrap gap-2">
        <Button variant={locale === "en" ? "default" : "outline"} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</Button>
        <Button variant={locale === "tl" ? "default" : "outline"} aria-pressed={locale === "tl"} onClick={() => setLocale("tl")}>Tagalog</Button>
      </div>
      <nav aria-label="Common help tasks" className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/appointments?new=1", title: locale === "tl" ? "Mag-book ng appointment" : "Book an appointment", detail: locale === "tl" ? "Idagdag ang customer habang nagbu-book." : "Add the customer while booking." },
          { href: "/needs-attention", title: locale === "tl" ? "Suriin ang reminder" : "Review a reminder", detail: locale === "tl" ? "Suriin muna bago makipag-ugnayan." : "Check delivery before contacting anyone." },
          { href: "/settings/billing", title: locale === "tl" ? "Plan at natitirang credits" : "Check plan and credits", detail: locale === "tl" ? "Tingnan ang natitirang allowance." : "See allowances and billing requests." },
        ].map((task) => <Link key={task.href} href={task.href} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><span className="font-medium">{task.title}</span><p className="mt-1 text-sm text-muted-foreground">{task.detail}</p></Link>)}
      </nav>
      <label className="block space-y-2"><span className="text-sm font-medium">{locale === "tl" ? "Maghanap ng sagot" : "Find an answer"}</span><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "tl" ? "Hal: paano mag-book" : "Example: book an appointment"} /></label>
      <div className="grid gap-4 lg:grid-cols-2">
        {results.map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-base">{item.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.quickAnswer}</p>
              <div className="flex flex-wrap gap-3">{item.relatedRoutes.map((route) => <Link key={route} href={route} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">{ROUTE_LABELS[route] ?? "Open page"}</Link>)}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={feedback[item.id] === "up" ? "default" : "outline"} aria-pressed={feedback[item.id] === "up"} onClick={() => setFeedback((previous) => ({ ...previous, [item.id]: "up" }))}>{locale === "tl" ? "Nakatulong" : "Helpful"}</Button>
                <Button size="sm" variant={feedback[item.id] === "down" ? "default" : "outline"} aria-pressed={feedback[item.id] === "down"} onClick={() => setFeedback((previous) => ({ ...previous, [item.id]: "down" }))}>{locale === "tl" ? "Hindi nakatulong" : "Not helpful"}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {results.length === 0 ? <Card><CardContent className="space-y-3 p-5"><p>{locale === "tl" ? "Walang sagot para sa paghahanap na ito." : "No answers match that search yet."}</p><p className="text-sm text-muted-foreground">{locale === "tl" ? "Subukan ang ibang salita o buksan ang Help sa iyong gawain." : "Try another keyword or use the task links above."}</p></CardContent></Card> : null}
      <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer font-medium">{locale === "tl" ? "Opsyonal na gabay" : "Optional guided help"}</summary><div className="mt-3 space-y-3"><p className="text-sm text-muted-foreground">{locale === "tl" ? "Pangalan at uri lang ng negosyo ang kailangan para makapagsimula. Opsyonal ang unang booking at pagbabahagi." : "Only business name and type are required to start. First booking and sharing are optional."}</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/onboarding">{locale === "tl" ? "Getting started" : "Getting started"}</Link></Button><Button asChild variant="ghost"><Link href="/onboarding-demo">{locale === "tl" ? "Buksan ang guided demo" : "Open guided demo"}</Link></Button></div></div></details>
    </div>
  );
}
