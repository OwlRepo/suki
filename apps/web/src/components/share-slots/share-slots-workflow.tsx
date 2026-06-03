"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  ImageIcon,
  Link2,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiRequest } from "@/lib/api";
import { fromError } from "@/lib/ui-feedback";
import { SHARE_SLOTS_PAGE_COPY } from "@/lib/share-slots-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBanner } from "@/components/ui/status-banner";
import { PageHeader } from "@/components/ui/page-header";

type ShareBackgroundTemplate = "classic" | "sunrise" | "mint" | "photo";

interface ShareTemplate {
  id: string;
  businessId: string;
  name: string;
  slots: string[];
  updatedAt: string;
}

type Feedback = {
  type: "success" | "error";
  message: string;
};

const BACKGROUND_OPTIONS: Array<{
  value: ShareBackgroundTemplate;
  title: string;
  subtitle: string;
  previewClassName: string;
}> = [
  {
    value: "classic",
    title: "Classic navy",
    subtitle: "gradient",
    previewClassName: "bg-gradient-to-br from-slate-950 to-slate-800",
  },
  {
    value: "sunrise",
    title: "Sunrise",
    subtitle: "gradient",
    previewClassName: "bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400",
  },
  {
    value: "mint",
    title: "Mint",
    subtitle: "gradient",
    previewClassName: "bg-gradient-to-br from-emerald-900 to-emerald-400",
  },
  {
    value: "photo",
    title: "Upload photo",
    subtitle: "custom background",
    previewClassName: "bg-slate-50",
  },
];

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
  const [shareBackground, setShareBackground] =
    useState<ShareBackgroundTemplate>("classic");
  const [shareBackgroundPhoto, setShareBackgroundPhoto] = useState<string | null>(
    null,
  );
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareTemplates, setShareTemplates] = useState<ShareTemplate[]>([]);
  const [shareTemplatesLoading, setShareTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateActionBusy, setTemplateActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedTemplate =
    shareTemplates.find((template) => template.id === selectedTemplateId) ?? null;

  const canSaveTemplate =
    !templateActionBusy &&
    shareTemplates.length < 3 &&
    templateNameInput.trim().length > 0 &&
    shareSlots.length > 0;

  const canRenameTemplate =
    !templateActionBusy &&
    Boolean(selectedTemplate) &&
    templateNameInput.trim().length > 0;

  const canUpdateTemplate =
    !templateActionBusy && Boolean(selectedTemplate) && shareSlots.length > 0;

  const selectedBackgroundOption = useMemo(
    () =>
      BACKGROUND_OPTIONS.find((option) => option.value === shareBackground) ??
      BACKGROUND_OPTIONS[0],
    [shareBackground],
  );

  const loadShareTemplates = async () => {
    if (!selectedBiz) return;

    const token = await getToken();
    if (!token) return;

    setShareTemplatesLoading(true);

    try {
      const res = await apiRequest<{ templates: ShareTemplate[] }>(
        `/appointments/share-templates?businessId=${encodeURIComponent(
          selectedBiz,
        )}`,
        { token },
      );

      const templates = res.templates ?? [];
      setShareTemplates(templates);
      setSelectedTemplateId((previous) =>
        previous && templates.some((template) => template.id === previous)
          ? previous
          : "",
      );
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(error, "Failed to load slot templates."),
      });
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

  const parseSlots = () =>
    shareSlots.map((slot) => slot.trim()).filter(Boolean);

  const normalizeTimeLabel = (time24: string) => {
    const [hourRaw, minuteRaw] = time24.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";

    const date = new Date();
    date.setHours(hour, minute, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const addSlotFromPicker = () => {
    const label = normalizeTimeLabel(shareTimeInput);
    if (!label) return;

    setShareSlots((previous) =>
      previous.includes(label) ? previous : [...previous, label],
    );
    setShareTimeInput("");
  };

  const removeSlot = (slot: string) => {
    setShareSlots((previous) => previous.filter((item) => item !== slot));
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

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to render image");

    if (background === "photo" && backgroundPhoto) {
      const photo = await loadImage(backgroundPhoto);
      const scale = Math.max(width / photo.width, height / photo.height);
      const drawWidth = photo.width * scale;
      const drawHeight = photo.height * scale;
      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;

      context.drawImage(photo, x, y, drawWidth, drawHeight);

      const overlay = context.createLinearGradient(0, 0, 0, height);
      overlay.addColorStop(0, "rgba(15, 23, 42, 0.30)");
      overlay.addColorStop(1, "rgba(15, 23, 42, 0.70)");
      context.fillStyle = overlay;
      context.fillRect(0, 0, width, height);
    } else {
      const gradient = context.createLinearGradient(0, 0, width, height);

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

      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }

    context.fillStyle = "#ffffff";
    context.font = "700 46px system-ui";
    context.fillText(title, 48, 92);

    context.font = "500 28px system-ui";
    context.fillStyle = "#cbd5e1";
    context.fillText(new Date().toLocaleDateString(), 48, 132);

    context.fillStyle = "#f8fafc";
    context.font = "600 34px system-ui";
    slots.slice(0, 10).forEach((slot, index) => {
      context.fillText(`• ${slot}`, 58, 210 + index * 54);
    });

    context.fillStyle = "#93c5fd";
    context.font = "500 24px system-ui";
    context.fillText(
      "Tap our booking link in caption to reserve.",
      48,
      height - 72,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Failed to render image")),
        "image/png",
      );
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

      const feed = await createShareCard(
        slots,
        1080,
        1080,
        "Today's Available Slots",
        shareBackground,
        shareBackgroundPhoto,
      );

      const story = await createShareCard(
        slots,
        1080,
        1920,
        "Book Today",
        shareBackground,
        shareBackgroundPhoto,
      );

      setShareImageFeedUrl(feed);
      setShareImageStoryUrl(story);
      setShareCaption(
        [
          "Today's available slots:",
          ...slots.map((slot) => `• ${slot}`),
          "",
          "Reserve now:",
          shareLink,
        ].join("\n"),
      );
    } catch (error) {
      setShareError(fromError(error, "Failed to generate share assets."));
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
      setFeedback({
        type: "error",
        message: "Unable to copy to clipboard on this device.",
      });
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

  const saveNewTemplate = async () => {
    if (!selectedBiz) return;

    if (shareTemplates.length >= 3) {
      setShareError("You can save up to 3 templates. Delete one to save a new one.");
      return;
    }

    const name = templateNameInput.trim();
    if (!name) {
      setShareError("Please enter a template name.");
      return;
    }

    const slots = parseSlots();
    if (!slots.length) {
      setShareError("Add at least one time slot.");
      return;
    }

    const token = await getToken();
    if (!token) return;

    setTemplateActionBusy(true);
    setShareError(null);

    try {
      const res = await apiRequest<{ template: ShareTemplate }>(
        "/appointments/share-templates",
        {
          method: "POST",
          token,
          body: JSON.stringify({ businessId: selectedBiz, name, slots }),
        },
      );

      setShareTemplates((previous) => [res.template, ...previous]);
      setSelectedTemplateId(res.template.id);
      setTemplateNameInput("");
      setFeedback({ type: "success", message: "Template saved." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (error) {
      setShareError(fromError(error, "Failed to save template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const renameSelectedTemplate = async () => {
    if (!selectedTemplate || !selectedBiz) return;

    const name = templateNameInput.trim();
    if (!name) {
      setShareError("Please enter a template name.");
      return;
    }

    const token = await getToken();
    if (!token) return;

    setTemplateActionBusy(true);
    setShareError(null);

    try {
      const res = await apiRequest<{ template: ShareTemplate }>(
        `/appointments/share-templates/${selectedTemplate.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ businessId: selectedBiz, name }),
        },
      );

      setShareTemplates((previous) =>
        previous.map((template) =>
          template.id === res.template.id ? res.template : template,
        ),
      );

      setTemplateNameInput("");
      setFeedback({ type: "success", message: "Template renamed." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (error) {
      setShareError(fromError(error, "Failed to rename template."));
    } finally {
      setTemplateActionBusy(false);
    }
  };

  const updateSelectedTemplateSlots = async () => {
    if (!selectedTemplate || !selectedBiz) return;

    const slots = parseSlots();
    if (!slots.length) {
      setShareError("Add at least one time slot.");
      return;
    }

    const token = await getToken();
    if (!token) return;

    setTemplateActionBusy(true);
    setShareError(null);

    try {
      const res = await apiRequest<{ template: ShareTemplate }>(
        `/appointments/share-templates/${selectedTemplate.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ businessId: selectedBiz, slots }),
        },
      );

      setShareTemplates((previous) =>
        previous.map((template) =>
          template.id === res.template.id ? res.template : template,
        ),
      );

      setFeedback({
        type: "success",
        message: "Template updated from current slots.",
      });
      setTimeout(() => setFeedback(null), 2500);
    } catch (error) {
      setShareError(fromError(error, "Failed to update template."));
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
      await apiRequest(
        `/appointments/share-templates/${
          selectedTemplate.id
        }?businessId=${encodeURIComponent(selectedBiz)}`,
        {
          method: "DELETE",
          token,
        },
      );

      setShareTemplates((previous) =>
        previous.filter((template) => template.id !== selectedTemplate.id),
      );

      setSelectedTemplateId("");
      setFeedback({ type: "success", message: "Template deleted." });
      setTimeout(() => setFeedback(null), 2500);
    } catch (error) {
      setShareError(fromError(error, "Failed to delete template."));
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
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title={SHARE_SLOTS_PAGE_COPY.title}
        plainLanguageDescription={SHARE_SLOTS_PAGE_COPY.description}
        whatThisPageIsFor="Build reusable daily slot posts with templates, visuals, and quick copy actions."
        whatToDoNext="Add today’s available times, generate assets, and copy your booking link."
      />

      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CalendarClock className="size-5" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                Step 1: Add available times
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Reuse a saved template or add times one by one. You can save up to
                3 templates.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                value={selectedTemplateId || "__none__"}
                onValueChange={(value) =>
                  setSelectedTemplateId(value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue
                    placeholder={
                      shareTemplatesLoading
                        ? "Loading templates..."
                        : "Choose a saved template"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__none__">No template selected</SelectItem>
                  {shareTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="w-full lg:w-auto"
                onClick={() =>
                  selectedTemplate && setShareSlots(selectedTemplate.slots)
                }
                disabled={!selectedTemplate}
              >
                Use template
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <Input
                value={templateNameInput}
                onChange={(event) => setTemplateNameInput(event.target.value)}
                placeholder="Template name (e.g. Weekday Slots)"
                className="md:col-span-2 xl:col-span-1"
              />

              <Button
                type="button"
                variant="outline"
                onClick={saveNewTemplate}
                disabled={!canSaveTemplate}
              >
                Save template
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={renameSelectedTemplate}
                disabled={!canRenameTemplate}
              >
                Rename
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={updateSelectedTemplateSlots}
                disabled={!canUpdateTemplate}
              >
                Update slots
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={deleteSelectedTemplate}
                disabled={templateActionBusy || !selectedTemplate}
              >
                <Trash2 className="size-4" />
                Delete selected template
              </Button>

              <p className="text-sm text-slate-500">
                Saved templates: {shareTemplates.length}/3
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="time"
                value={shareTimeInput}
                onChange={(event) => setShareTimeInput(event.target.value)}
                className="w-full sm:max-w-48"
                aria-label="Select slot time"
              />

              <Button
                type="button"
                variant="outline"
                onClick={addSlotFromPicker}
                disabled={!shareTimeInput}
              >
                <Clock3 className="size-4" />
                Add time
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {shareSlots.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1 rounded-full"
                  onClick={() => removeSlot(slot)}
                >
                  {slot}
                  <X className="size-3.5" />
                </Button>
              ))}

              {shareSlots.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No slots yet. Add at least one time.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ImageIcon className="size-5" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                Step 2: Choose background
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Pick a ready-made style or upload a shop photo customers already
                recognize.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BACKGROUND_OPTIONS.map((option) => {
              const isSelected = option.value === shareBackground;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-2xl border p-3 text-left transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:border-blue-200"
                  }`}
                  onClick={() => setShareBackground(option.value)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 size-4 shrink-0 rounded-full border ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 ring-2 ring-blue-100"
                          : "border-slate-300 bg-white"
                      }`}
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {option.title}
                      </p>
                      <p className="text-xs text-slate-500">{option.subtitle}</p>
                    </div>
                  </div>

                  <div
                    className={`mt-3 flex h-20 items-center justify-center rounded-xl border border-slate-200 ${option.previewClassName}`}
                  >
                    {option.value === "photo" ? (
                      <Upload className="size-6 text-slate-400" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleBackgroundUpload(event.target.files?.[0])
              }
            />

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Selected style: {selectedBackgroundOption.title}. Uploading a photo
              automatically switches to the custom photo background.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Link2 className="size-5" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                Step 3: Generate and post
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Generate the feed and story images, then copy the booking link or
                caption.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <Label htmlFor="share-link" className="text-sm font-semibold">
                Booking link
              </Label>

              <div className="mt-2 flex gap-2">
                <Input
                  id="share-link"
                  value={shareLink}
                  readOnly
                  className="min-w-0"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyText(shareLink, "Booking link copied.")}
                  aria-label="Copy booking link"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                type="button"
                onClick={generateShareAssets}
                disabled={shareBusy || parseSlots().length === 0}
              >
                {shareBusy ? "Generating..." : "Generate post assets"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(shareLink, "Booking link copied.")}
              >
                <Copy className="size-4" />
                Copy booking link
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(shareCaption, "Caption copied.")}
                disabled={!shareCaption}
              >
                <Copy className="size-4" />
                Copy caption
              </Button>
            </div>

            {shareError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {shareError}
              </p>
            ) : null}

            {shareImageFeedUrl || shareImageStoryUrl ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {shareImageFeedUrl ? (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Feed image <span className="text-slate-500">(Square)</span>
                    </p>

                    <Image
                      src={shareImageFeedUrl}
                      alt="Feed slot card"
                      width={1080}
                      height={1080}
                      unoptimized
                      className="mt-3 h-auto w-full rounded-xl border border-slate-200"
                    />
                  </article>
                ) : null}

                {shareImageStoryUrl ? (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Story image <span className="text-slate-500">(9:16)</span>
                    </p>

                    <div className="mt-3 flex justify-center">
                      <Image
                        src={shareImageStoryUrl}
                        alt="Story slot card"
                        width={1080}
                        height={1920}
                        unoptimized
                        className="h-auto max-h-[44rem] w-full rounded-xl border border-slate-200 object-contain lg:max-w-[24rem]"
                      />
                    </div>
                  </article>
                ) : null}
              </div>
            ) : null}

            {shareImageFeedUrl && shareImageStoryUrl ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-5" />
                  </span>

                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      Final step: Save and post
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Download both formats, then post wherever customers already
                      follow your business.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    size="lg"
                    className="sm:col-span-2"
                    onClick={async () => {
                      if (!shareImageFeedUrl || !shareImageStoryUrl) return;

                      await forceDownload(shareImageFeedUrl, "slots-feed.png");
                      await forceDownload(shareImageStoryUrl, "slots-story.png");

                      setFeedback({
                        type: "success",
                        message: "Saved 2 images: Feed and Story.",
                      });

                      setTimeout(() => setFeedback(null), 3000);
                    }}
                  >
                    <Save className="size-5" />
                    Save Both Images
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      shareImageFeedUrl &&
                      forceDownload(shareImageFeedUrl, "slots-feed.png")
                    }
                  >
                    Save Feed Only
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      shareImageStoryUrl &&
                      forceDownload(shareImageStoryUrl, "slots-story.png")
                    }
                  >
                    Save Story Only
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {feedback ? (
        <StatusBanner
          variant={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
    </div>
  );
}
