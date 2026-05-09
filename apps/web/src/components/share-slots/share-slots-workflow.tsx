"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiRequest } from "@/lib/api";
import { fromError } from "@/lib/ui-feedback";
import { SHARE_SLOTS_PAGE_COPY } from "@/lib/share-slots-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBanner } from "@/components/ui/status-banner";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";

type ShareBackgroundTemplate = "classic" | "sunrise" | "mint" | "photo";

interface ShareTemplate {
  id: string;
  businessId: string;
  name: string;
  slots: string[];
  updatedAt: string;
}

export function ShareSlotsWorkflow() {
  const { getToken } = useAuth();
  useAuthSync();
  const workspace = useWorkspace();
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [shareSlots, setShareSlots] = useState<string[]>([]);
  const [shareTimeInput, setShareTimeInput] = useState("");
  const [shareCaption, setShareCaption] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareImageFeedUrl, setShareImageFeedUrl] = useState<string | null>(null);
  const [shareImageStoryUrl, setShareImageStoryUrl] = useState<string | null>(null);
  const [shareBackground, setShareBackground] = useState<ShareBackgroundTemplate>("classic");
  const [shareBackgroundPhoto, setShareBackgroundPhoto] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareTemplates, setShareTemplates] = useState<ShareTemplate[]>([]);
  const [shareTemplatesLoading, setShareTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateActionBusy, setTemplateActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadShareTemplates = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    setShareTemplatesLoading(true);
    try {
      const res = await apiRequest<{ templates: ShareTemplate[] }>(
        `/appointments/share-templates?businessId=${encodeURIComponent(selectedBiz)}`,
        { token },
      );
      setShareTemplates(res.templates ?? []);
      setSelectedTemplateId((prev) => (prev && (res.templates ?? []).some((t) => t.id === prev) ? prev : ""));
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to load slot templates.") });
    } finally {
      setShareTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBiz) return;
    loadShareTemplates();
  }, [selectedBiz]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedBiz) return;
    const base = `${window.location.origin}/intake/${selectedBiz}`;
    const url = new URL(base);
    url.searchParams.set("utm_source", "sharing");
    url.searchParams.set("utm_medium", "organic");
    url.searchParams.set("utm_campaign", "daily_slots");
    setShareLink(url.toString());
  }, [selectedBiz]);

  const parseSlots = () => shareSlots.map((slot) => slot.trim()).filter(Boolean);

  const normalizeTimeLabel = (time24: string) => {
    const [hourRaw, minuteRaw] = time24.split(":");
    const h = Number(hourRaw);
    const m = Number(minuteRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const addSlotFromPicker = () => {
    const label = normalizeTimeLabel(shareTimeInput);
    if (!label) return;
    setShareSlots((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setShareTimeInput("");
  };

  const removeSlot = (slot: string) => {
    setShareSlots((prev) => prev.filter((item) => item !== slot));
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load image"));
      image.src = src;
    });

  const createShareCard = async (
    slots: string[],
    width: number,
    height: number,
    title: string,
    background: ShareBackgroundTemplate,
    backgroundPhoto: string | null,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to render image");

    if (background === "photo" && backgroundPhoto) {
      const photo = await loadImage(backgroundPhoto);
      const scale = Math.max(width / photo.width, height / photo.height);
      const drawW = photo.width * scale;
      const drawH = photo.height * scale;
      const x = (width - drawW) / 2;
      const y = (height - drawH) / 2;
      ctx.drawImage(photo, x, y, drawW, drawH);
      const overlay = ctx.createLinearGradient(0, 0, 0, height);
      overlay.addColorStop(0, "rgba(15, 23, 42, 0.30)");
      overlay.addColorStop(1, "rgba(15, 23, 42, 0.70)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      if (background === "sunrise") {
        gradient.addColorStop(0, "#7c2d12");
        gradient.addColorStop(1, "#f97316");
      } else if (background === "mint") {
        gradient.addColorStop(0, "#064e3b");
        gradient.addColorStop(1, "#10b981");
      } else {
        gradient.addColorStop(0, "#0f172a");
        gradient.addColorStop(1, "#1e293b");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px system-ui";
    ctx.fillText(title, 48, 92);
    ctx.font = "500 28px system-ui";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(new Date().toLocaleDateString(), 48, 132);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 34px system-ui";
    slots.slice(0, 10).forEach((slot, index) => {
      ctx.fillText(`• ${slot}`, 58, 210 + index * 54);
    });

    ctx.fillStyle = "#93c5fd";
    ctx.font = "500 24px system-ui";
    ctx.fillText("Tap our booking link in caption to reserve.", 48, height - 72);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Failed to render image"))), "image/png");
    });
    return URL.createObjectURL(blob);
  };

  const generateShareAssets = async () => {
    const slots = parseSlots();
    if (!slots.length) {
      setShareError("Add at least one time slot.");
      return;
    }
    setShareBusy(true);
    setShareError(null);
    try {
      if (shareImageFeedUrl) URL.revokeObjectURL(shareImageFeedUrl);
      if (shareImageStoryUrl) URL.revokeObjectURL(shareImageStoryUrl);
      const feed = await createShareCard(slots, 1080, 1080, "Today's Available Slots", shareBackground, shareBackgroundPhoto);
      const story = await createShareCard(slots, 1080, 1920, "Book Today", shareBackground, shareBackgroundPhoto);
      setShareImageFeedUrl(feed);
      setShareImageStoryUrl(story);
      setShareCaption(["Today's available slots:", ...slots.map((slot) => `• ${slot}`), "", "Reserve now:", shareLink].join("\n"));
    } catch (err) {
      setShareError(fromError(err, "Failed to generate share assets."));
    } finally {
      setShareBusy(false);
    }
  };

  const copyText = async (value: string, successMessage: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ type: "success", message: successMessage });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Unable to copy to clipboard on this device." });
    }
  };

  const handleBackgroundUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setShareBackgroundPhoto(reader.result);
        setShareBackground("photo");
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedTemplate = shareTemplates.find((t) => t.id === selectedTemplateId) ?? null;

  const saveNewTemplate = async () => {
    if (!selectedBiz) return;
    if (shareTemplates.length >= 3) return setShareError("You can save up to 3 templates. Delete one to save a new one.");
    const name = templateNameInput.trim();
    if (!name) return setShareError("Please enter a template name.");
    const slots = parseSlots();
    if (!slots.length) return setShareError("Add at least one time slot.");
    const token = await getToken();
    if (!token) return;
    setTemplateActionBusy(true);
    setShareError(null);
    try {
      const res = await apiRequest<{ template: ShareTemplate }>("/appointments/share-templates", {
        method: "POST",
        token,
        body: JSON.stringify({ businessId: selectedBiz, name, slots }),
      });
      setShareTemplates((prev) => [res.template, ...prev]);
      setSelectedTemplateId(res.template.id);
      setTemplateNameInput("");
      setFeedback({ type: "success", message: "Template saved." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setShareError(fromError(err, "Failed to save template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const renameSelectedTemplate = async () => {
    if (!selectedTemplate || !selectedBiz) return;
    const name = templateNameInput.trim();
    if (!name) return setShareError("Please enter a template name.");
    const token = await getToken();
    if (!token) return;
    setTemplateActionBusy(true);
    setShareError(null);
    try {
      const res = await apiRequest<{ template: ShareTemplate }>(`/appointments/share-templates/${selectedTemplate.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ businessId: selectedBiz, name }),
      });
      setShareTemplates((prev) => prev.map((t) => (t.id === res.template.id ? res.template : t)));
      setTemplateNameInput("");
      setFeedback({ type: "success", message: "Template renamed." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setShareError(fromError(err, "Failed to rename template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const updateSelectedTemplateSlots = async () => {
    if (!selectedTemplate || !selectedBiz) return;
    const slots = parseSlots();
    if (!slots.length) return setShareError("Add at least one time slot.");
    const token = await getToken();
    if (!token) return;
    setTemplateActionBusy(true);
    setShareError(null);
    try {
      const res = await apiRequest<{ template: ShareTemplate }>(`/appointments/share-templates/${selectedTemplate.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ businessId: selectedBiz, slots }),
      });
      setShareTemplates((prev) => prev.map((t) => (t.id === res.template.id ? res.template : t)));
      setFeedback({ type: "success", message: "Template updated from current slots." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setShareError(fromError(err, "Failed to update template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const deleteSelectedTemplate = async () => {
    if (!selectedTemplate || !selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    setTemplateActionBusy(true);
    setShareError(null);
    try {
      await apiRequest(`/appointments/share-templates/${selectedTemplate.id}?businessId=${encodeURIComponent(selectedBiz)}`, {
        method: "DELETE",
        token,
      });
      setShareTemplates((prev) => prev.filter((t) => t.id !== selectedTemplate.id));
      setSelectedTemplateId("");
      setFeedback({ type: "success", message: "Template deleted." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setShareError(fromError(err, "Failed to delete template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const forceDownload = async (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    await new Promise((resolve) => setTimeout(resolve, 120));
  };

  if (!workspace?.loading && !businesses.length) {
    return (
      <PageHeader
        title={SHARE_SLOTS_PAGE_COPY.title}
        plainLanguageDescription={SHARE_SLOTS_PAGE_COPY.description}
        whatThisPageIsFor="Create quick slot graphics and captions customers can use to book."
        whatToDoNext="Create a business in Setup first, then come back to share today's slots."
      />
    );
  }

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        title={SHARE_SLOTS_PAGE_COPY.title}
        plainLanguageDescription={SHARE_SLOTS_PAGE_COPY.description}
        whatThisPageIsFor="Build reusable daily slot posts with templates, visuals, and quick copy actions."
        whatToDoNext="Add today’s available times, generate assets, and copy your booking link."
      />
      <PageSection>
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 1: Add available times</Label>
            <p className="text-xs text-muted-foreground">Reuse a saved template or add times one by one. You can save up to 3 templates.</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Select value={selectedTemplateId || "__none__"} onValueChange={(v) => setSelectedTemplateId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full min-h-[44px]">
                  <SelectValue placeholder={shareTemplatesLoading ? "Loading templates..." : "Choose a saved template"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template selected</SelectItem>
                  {shareTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => selectedTemplate && setShareSlots(selectedTemplate.slots)} disabled={!selectedTemplate}>Use template</Button>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <Input value={templateNameInput} onChange={(e) => setTemplateNameInput(e.target.value)} placeholder="Template name (e.g. Weekday Slots)" />
              <Button type="button" variant="outline" onClick={saveNewTemplate} disabled={templateActionBusy || shareTemplates.length >= 3 || parseSlots().length === 0}>Save template</Button>
              <Button type="button" variant="outline" onClick={renameSelectedTemplate} disabled={templateActionBusy || !selectedTemplate}>Rename</Button>
              <Button type="button" variant="outline" onClick={updateSelectedTemplateSlots} disabled={templateActionBusy || !selectedTemplate}>Update slots</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={deleteSelectedTemplate} disabled={templateActionBusy || !selectedTemplate}>Delete selected template</Button>
              <p className="text-xs text-muted-foreground self-center">Saved templates: {shareTemplates.length}/3</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input type="time" value={shareTimeInput} onChange={(e) => setShareTimeInput(e.target.value)} className="w-44" aria-label="Select slot time" />
              <Button type="button" variant="outline" onClick={addSlotFromPicker} disabled={!shareTimeInput}>Add time</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shareSlots.map((slot) => (
                <Button key={slot} type="button" variant="secondary" size="sm" onClick={() => removeSlot(slot)}>{slot} ×</Button>
              ))}
              {shareSlots.length === 0 && <p className="text-sm text-muted-foreground">No slots yet. Add at least one time.</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 2: Choose background</Label>
            <Select value={shareBackground} onValueChange={(v) => setShareBackground(v as ShareBackgroundTemplate)}>
              <SelectTrigger className="w-full min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic navy gradient</SelectItem>
                <SelectItem value="sunrise">Warm sunrise gradient</SelectItem>
                <SelectItem value="mint">Fresh mint gradient</SelectItem>
                <SelectItem value="photo">Use uploaded photo</SelectItem>
              </SelectContent>
            </Select>
            <Input type="file" accept="image/*" onChange={(e) => handleBackgroundUpload(e.target.files?.[0])} />
            <p className="text-xs text-muted-foreground">Tip: upload a shop photo for a familiar look customers already recognize.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 3: Generate and post</Label>
            <Label htmlFor="share-link">Booking link</Label>
            <Input id="share-link" value={shareLink} readOnly />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={generateShareAssets} disabled={shareBusy || parseSlots().length === 0}>{shareBusy ? "Generating..." : "Generate post assets"}</Button>
            <Button type="button" variant="outline" onClick={() => copyText(shareLink, "Booking link copied.")}>Copy booking link</Button>
            <Button type="button" variant="outline" onClick={() => copyText(shareCaption, "Caption copied.")} disabled={!shareCaption}>Copy caption</Button>
          </div>
          {shareError && <p className="text-sm text-destructive">{shareError}</p>}
          {(shareImageFeedUrl || shareImageStoryUrl) && (
            <div className="grid gap-4 md:grid-cols-2">
              {shareImageFeedUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Feed image</p>
                  <Image src={shareImageFeedUrl} alt="Feed slot card" width={1080} height={1080} unoptimized className="h-auto w-full rounded-md border border-border" />
                </div>
              )}
              {shareImageStoryUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Story image</p>
                  <Image src={shareImageStoryUrl} alt="Story slot card" width={1080} height={1920} unoptimized className="h-auto w-full rounded-md border border-border" />
                </div>
              )}
            </div>
          )}
          {!!(shareImageFeedUrl && shareImageStoryUrl) && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">Final step: Save and post</p>
              <Button type="button" size="lg" className="w-full min-h-[52px] text-base" onClick={async () => {
                if (!shareImageFeedUrl || !shareImageStoryUrl) return;
                await forceDownload(shareImageFeedUrl, "slots-feed.png");
                await forceDownload(shareImageStoryUrl, "slots-story.png");
                setFeedback({ type: "success", message: "Saved 2 images: Feed and Story." });
                setTimeout(() => setFeedback(null), 3000);
              }}>
                Save Both Images
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => shareImageFeedUrl && forceDownload(shareImageFeedUrl, "slots-feed.png")}>Save Feed Only</Button>
                <Button type="button" variant="outline" onClick={() => shareImageStoryUrl && forceDownload(shareImageStoryUrl, "slots-story.png")}>Save Story Only</Button>
              </div>
            </div>
          )}
        </div>
      </PageSection>
      {feedback && <StatusBanner variant={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />}
    </div>
  );
}
