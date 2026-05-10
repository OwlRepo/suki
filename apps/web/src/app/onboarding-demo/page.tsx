"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuidedOnboardingModules } from "@/lib/help-content";

export default function OnboardingDemoPage() {
  const modules = useMemo(() => getGuidedOnboardingModules("en"), []);
  const [index, setIndex] = useState(0);
  const active = modules[index] ?? modules[0];

  if (!active) {
    return <p className="p-6">No onboarding demo content available.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Guided Onboarding Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Step {active.sourceStepId} of {modules.length}</p>
          <p className="text-lg font-semibold">{active.title}</p>
          <p className="text-base text-muted-foreground">{active.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>Previous</Button>
            <Button onClick={() => setIndex((i) => Math.min(modules.length - 1, i + 1))} disabled={index === modules.length - 1}>Next</Button>
            <Button variant="ghost" onClick={() => setIndex(0)}>Restart demo</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
