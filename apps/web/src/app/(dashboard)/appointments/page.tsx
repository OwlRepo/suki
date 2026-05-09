"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Business {
  id: string;
  name: string;
  businessType: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string | null;
}

interface Appointment {
  id: string;
  customerId: string;
  businessId: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

type ShareBackgroundTemplate = "classic" | "sunrise" | "mint" | "photo";
interface ShareTemplate {
  id: string;
  businessId: string;
  name: string;
  slots: string[];
  updatedAt: string;
}

function formatSlotLabel(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function AppointmentsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const orgId = syncData?.organization?.id ?? null;
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [syncReady, setSyncReady] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerId: "",
    scheduledAt: "",
    notes: "",
    remindersOn: true,
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<{ id: string; customerName: string } | null>(null);
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

  const loadCustomers = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ customers: Customer[] }>(
      `/customers?businessId=${selectedBiz}&limit=500`,
      { token },
    );
    setCustomers(res.customers);
  };

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
      setSelectedTemplateId((prev) =>
        prev && (res.templates ?? []).some((t) => t.id === prev) ? prev : "",
      );
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to load slot templates.") });
    } finally {
      setShareTemplatesLoading(false);
    }
  };

  const loadAppointments = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    setAppointmentsLoading(true);
    try {
      let url = `/appointments?businessId=${selectedBiz}`;
      if (dateFrom) url += `&from=${new Date(dateFrom).toISOString()}`;
      if (dateTo) url += `&to=${new Date(dateTo).toISOString()}`;
      const res = await apiRequest<{ appointments: Appointment[] }>(url, { token });
      setAppointments(res.appointments);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    if (!selectedBiz) return;
    loadCustomers();
    loadShareTemplates();
  }, [selectedBiz]);

  useEffect(() => {
    if (!selectedBiz) return;
    loadAppointments();
  }, [selectedBiz, dateFrom, dateTo]);

  useEffect(() => {
    const todayKey = new Date().toDateString();
    const slotLabels = appointments
      .filter((a) => a.status === "scheduled" && new Date(a.scheduledAt).toDateString() === todayKey)
      .map((a) => formatSlotLabel(a.scheduledAt));
    if (!slotLabels.length) return;
    setShareSlots((prev) => (prev.length ? prev : slotLabels));
  }, [appointments]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedBiz) return;
    const base = `${window.location.origin}/intake/${selectedBiz}`;
    const url = new URL(base);
    url.searchParams.set("utm_source", "facebook");
    url.searchParams.set("utm_medium", "organic");
    url.searchParams.set("utm_campaign", "daily_slots");
    setShareLink(url.toString());
  }, [selectedBiz]);

  const resetForm = () => {
    const today = new Date();
    const defaultTime = new Date(today);
    defaultTime.setHours(14, 0, 0, 0); // 2pm default
    setFormData({
      customerId: "",
      scheduledAt: defaultTime.toISOString().slice(0, 16),
      notes: "",
      remindersOn: true,
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const applyTimePreset = (preset: "morning" | "afternoon" | "evening") => {
    const d = formData.scheduledAt ? new Date(formData.scheduledAt) : new Date();
    if (preset === "morning") d.setHours(9, 0, 0, 0);
    else if (preset === "afternoon") d.setHours(14, 0, 0, 0);
    else d.setHours(18, 0, 0, 0);
    setFormData((prev) => ({ ...prev, scheduledAt: d.toISOString().slice(0, 16) }));
  };

  const handleEdit = (a: Appointment) => {
    setEditingId(a.id);
    setFormData({
      customerId: a.customerId,
      scheduledAt: a.scheduledAt.slice(0, 16),
      notes: a.notes ?? "",
      remindersOn: true,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz || !formData.customerId || !formData.scheduledAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const body = {
        customerId: formData.customerId,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        notes: formData.notes || undefined,
      };
      if (editingId) {
        await apiRequest(`/appointments/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            scheduledAt: body.scheduledAt,
            notes: body.notes,
          }),
        });
      } else {
        await apiRequest("/appointments", {
          method: "POST",
          token,
          body: JSON.stringify({ businessId: selectedBiz, ...body }),
        });
      }
      resetForm();
      if (!editingId) {
        recordOnboardingEvent("appointment_created", orgId);
      }
      loadAppointments();
      setFeedback({ type: "success", message: editingId ? "Appointment updated." : "Appointment created." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(fromError(err, "Failed to save appointment. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id: string, status: "scheduled" | "completed" | "missed" | "cancelled") => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/appointments/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      loadAppointments();
      setFeedback({ type: "success", message: "Status updated." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to update status. Please try again.") });
    }
  };

  const handleReminderSent = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/appointments/${id}/reminder-sent`, {
        method: "PATCH",
        token,
      });
      loadAppointments();
      setFeedback({ type: "success", message: "Reminder marked as sent." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to mark reminder. Please try again.") });
    }
  };

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.name ?? "—";

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
    setShareSlots((prev) => {
      if (prev.includes(label)) return prev;
      return [...prev, label];
    });
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
    const visibleSlots = slots.slice(0, 10);
    visibleSlots.forEach((slot, index) => {
      ctx.fillText(`• ${slot}`, 58, 210 + index * 54);
    });

    ctx.fillStyle = "#93c5fd";
    ctx.font = "500 24px system-ui";
    ctx.fillText("Tap our booking link in caption to reserve.", 48, height - 72);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Failed to render image"));
          return;
        }
        resolve(result);
      }, "image/png");
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
      const captionLines = [
        "Today's available slots:",
        ...slots.map((slot) => `• ${slot}`),
        "",
        "Reserve now:",
        shareLink,
      ];
      setShareCaption(captionLines.join("\n"));
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

  const applySelectedTemplate = () => {
    if (!selectedTemplate) return;
    setShareSlots(selectedTemplate.slots);
    setFeedback({ type: "success", message: `Applied template: ${selectedTemplate.name}` });
    setTimeout(() => setFeedback(null), 2500);
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
    if (!slots.length) {
      setShareError("Add at least one time slot.");
      return;
    }
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

  const handleSaveBothImages = async () => {
    if (!shareImageFeedUrl || !shareImageStoryUrl) return;
    await forceDownload(shareImageFeedUrl, "slots-feed.png");
    await forceDownload(shareImageStoryUrl, "slots-story.png");
    setFeedback({ type: "success", message: "Saved 2 images: Feed and Story." });
    setTimeout(() => setFeedback(null), 3000);
  };

  if (!workspace?.loading && !businesses.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Appointments"
          plainLanguageDescription="Appointments help you plan your day."
          whatThisPageIsFor="Schedule visits and keep each appointment status up to date."
          whatToDoNext="Create a business in Setup first, then add customers and appointments."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
        <PageHeader
          title="Appointments"
          plainLanguageDescription="Appointments help you plan your day — but you can use the app without them."
          whatThisPageIsFor="Schedule visits and keep each appointment status up to date."
          whatToDoNext={appointments.length === 0 ? "Create your first appointment." : "Update the next appointment status."}
          actions={
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                className="w-36"
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                className="w-36"
                aria-label="To date"
              />
            </div>
          }
        />
        <PrimaryPageAction
          primaryAction={
            <Button onClick={() => { resetForm(); setShowForm(true); }} size="lg">
              {appointments.length === 0 ? "Create first appointment" : "New appointment"}
            </Button>
          }
          hintText="Pick a customer first, then choose a time preset or exact date and time."
        />
        <PageSection>
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            <h2 className="text-lg font-medium">Share Today&apos;s Slots (Facebook)</h2>
            <p className="text-sm text-muted-foreground">
              Keep your current posting style with guided steps. Add times, pick a background, generate assets, then post to Facebook Feed and Story.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 1: Add available times</Label>
              <p className="text-xs text-muted-foreground">
                Reuse a saved template or add times one by one. You can save up to 3 templates.
              </p>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Select value={selectedTemplateId || "__none__"} onValueChange={(v) => setSelectedTemplateId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-full min-h-[44px]">
                    <SelectValue placeholder={shareTemplatesLoading ? "Loading templates..." : "Choose a saved template"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template selected</SelectItem>
                    {shareTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={applySelectedTemplate} disabled={!selectedTemplate}>
                  Use template
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="Template name (e.g. Weekday Slots)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveNewTemplate}
                  disabled={templateActionBusy || shareTemplates.length >= 3 || parseSlots().length === 0}
                >
                  Save template
                </Button>
                <Button type="button" variant="outline" onClick={renameSelectedTemplate} disabled={templateActionBusy || !selectedTemplate}>
                  Rename
                </Button>
                <Button type="button" variant="outline" onClick={updateSelectedTemplateSlots} disabled={templateActionBusy || !selectedTemplate}>
                  Update slots
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={deleteSelectedTemplate} disabled={templateActionBusy || !selectedTemplate}>
                  Delete selected template
                </Button>
                <p className="text-xs text-muted-foreground self-center">
                  Saved templates: {shareTemplates.length}/3
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="time"
                  value={shareTimeInput}
                  onChange={(e) => setShareTimeInput(e.target.value)}
                  className="w-44"
                  aria-label="Select slot time"
                />
                <Button type="button" variant="outline" onClick={addSlotFromPicker} disabled={!shareTimeInput}>
                  Add time
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {shareSlots.map((slot) => (
                  <Button key={slot} type="button" variant="secondary" size="sm" onClick={() => removeSlot(slot)}>
                    {slot} ×
                  </Button>
                ))}
                {shareSlots.length === 0 && <p className="text-sm text-muted-foreground">No slots yet. Add at least one time.</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 2: Choose background</Label>
              <Select value={shareBackground} onValueChange={(v) => setShareBackground(v as ShareBackgroundTemplate)}>
                <SelectTrigger className="w-full min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic navy gradient</SelectItem>
                  <SelectItem value="sunrise">Warm sunrise gradient</SelectItem>
                  <SelectItem value="mint">Fresh mint gradient</SelectItem>
                  <SelectItem value="photo">Use uploaded photo</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleBackgroundUpload(e.target.files?.[0])}
              />
              <p className="text-xs text-muted-foreground">Tip: upload a shop photo for a familiar look customers already recognize.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 3: Generate and post</Label>
              <Label htmlFor="share-link">Booking link</Label>
              <Input id="share-link" value={shareLink} readOnly />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={generateShareAssets} disabled={shareBusy || parseSlots().length === 0}>
                {shareBusy ? "Generating..." : "Generate post assets"}
              </Button>
              <Button type="button" variant="outline" onClick={() => copyText(shareLink, "Booking link copied.")}>
                Copy booking link
              </Button>
              <Button type="button" variant="outline" onClick={() => copyText(shareCaption, "Caption copied.")} disabled={!shareCaption}>
                Copy caption
              </Button>
            </div>
            {shareError && <p className="text-sm text-destructive">{shareError}</p>}
            {(shareImageFeedUrl || shareImageStoryUrl) && (
              <div className="grid gap-4 md:grid-cols-2">
                {shareImageFeedUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Feed image</p>
                    <Image
                      src={shareImageFeedUrl}
                      alt="Facebook feed slot card"
                      width={1080}
                      height={1080}
                      unoptimized
                      className="h-auto w-full rounded-md border border-border"
                    />
                  </div>
                )}
                {shareImageStoryUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Story image</p>
                    <Image
                      src={shareImageStoryUrl}
                      alt="Facebook story slot card"
                      width={1080}
                      height={1920}
                      unoptimized
                      className="h-auto w-full rounded-md border border-border"
                    />
                  </div>
                )}
              </div>
            )}
            {!!(shareImageFeedUrl && shareImageStoryUrl) && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-medium">Final step: Save and post</p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full min-h-[52px] text-base"
                  onClick={handleSaveBothImages}
                >
                  Save Both Images
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => shareImageFeedUrl && forceDownload(shareImageFeedUrl, "slots-feed.png")}>
                    Save Feed Only
                  </Button>
                  <Button type="button" variant="outline" onClick={() => shareImageStoryUrl && forceDownload(shareImageStoryUrl, "slots-story.png")}>
                    Save Story Only
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PageSection>

        {feedback && (
          <StatusBanner
            variant={feedback.type}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        )}

        <ConfirmDialog
          open={!!pendingCancel}
          onOpenChange={(o) => !o && setPendingCancel(null)}
          title="Cancel this appointment?"
          description={
            pendingCancel
              ? `This will mark the appointment for ${pendingCancel.customerName} as cancelled. You can still see it in the list.`
              : ""
          }
          confirmLabel="Yes, cancel"
          cancelLabel="No, keep it"
          destructive
          onConfirm={async () => {
            if (pendingCancel) {
              await handleStatus(pendingCancel.id, "cancelled");
            }
          }}
        />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">{editingId ? "Reschedule" : "New appointment"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customer-select" className="mb-1 block">
                Customer
              </Label>
              <Select
                value={formData.customerId || "__none__"}
                onValueChange={(v) =>
                  setFormData((d) => ({ ...d, customerId: v === "__none__" ? "" : v }))
                }
                disabled={!!editingId}
              >
                <SelectTrigger id="customer-select" className="w-full min-h-[44px]">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Date & time</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("morning")}>
                  Morning
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("afternoon")}>
                  Afternoon
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("evening")}>
                  Evening
                </Button>
              </div>
              <Input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData((d) => ({ ...d, scheduledAt: e.target.value }))}
                required
                className="mt-2"
              />
            </div>
          </div>
          {!editingId && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
              <Checkbox
                id="reminders-on"
                checked={formData.remindersOn}
                onCheckedChange={(checked) =>
                  setFormData((d) => ({ ...d, remindersOn: checked === true }))
                }
              />
              <Label htmlFor="reminders-on" className="cursor-pointer text-sm text-foreground">
                We&apos;ll remind the customer so you don&apos;t have to.
              </Label>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Nothing is final until you confirm.</p>
          <div>
            <Label className="mb-1 block">Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <PageSection>
        <p className="text-sm text-muted-foreground">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
        {!syncReady || workspace?.loading || (!!selectedBiz && appointmentsLoading) ? (
          <ListSkeleton rowCount={5} className="mt-4" />
        ) : (
          <>
        <ul className="mt-4 divide-y divide-border">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-5 first:pt-0"
            >
              <div>
                <span className="font-medium">{getCustomerName(a.customerId)}</span>
                <Badge
                  variant={a.status === "cancelled" ? "destructive" : a.status === "completed" ? "secondary" : "outline"}
                  className={a.status !== "cancelled" && a.status !== "completed" ? "bg-primary/10 border-primary/20 capitalize" : "capitalize"}
                >
                  {a.status}
                </Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString()}
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                    {a.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => handleReminderSent(a.id)}>
                        Reminder sent
                      </Button>
                    )}
                    <Select
                      value={a.status}
                      onValueChange={(v) => {
                        const status = v as "scheduled" | "completed" | "missed" | "cancelled";
                        if (status === "cancelled") {
                          setPendingCancel({ id: a.id, customerName: getCustomerName(a.customerId) });
                        } else {
                          handleStatus(a.id, status);
                        }
                      }}
                    >
                      <SelectTrigger className="min-h-[44px] capitalize" aria-label="Change status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="missed">Missed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    {a.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(a as Appointment)}>
                        Reschedule
                      </Button>
                    )}
              </div>
            </li>
          ))}
        </ul>
        {appointments.length === 0 && (
          <EmptyState
            what="No appointments yet"
            why="Appointments help you plan your day — but you can use the app without them."
            nextAction={
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                Create first appointment
              </Button>
            }
          />
        )}
          </>
        )}
      </PageSection>
    </div>
  );
}

export default function AppointmentsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage appointments.
        </p>
      </div>
    );
  }
  return <AppointmentsPageContent />;
}
