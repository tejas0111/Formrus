import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { normalizeDna } from "../lib/crypto";
import { fetchWalrusJson } from "../lib/walrusRead";
import { submitResponseAndAct } from "../lib/submission";
import { uploadFileToWalrusWithPolicy } from "../lib/walrusAdapter";
import { checkSubmissionEligibility, type EligibilityCheckResult } from "../lib/eligibility";
import type { FormDraft } from "../types/form";
import { suiNetwork } from "../lib/config";
import { FieldInput } from "../components/FormFields";
import { SkeletonFormPage } from "../components/Skeleton";
import FormrusConnectButton from "../components/FormrusConnectButton";
import ThemeToggle from "../components/ThemeToggle";
import SiteFooter from "../components/SiteFooter";
import { safeUrl, parseFormFields, mistToSui, type FormChainState } from "../lib/utils";
import { translateError } from "../lib/errors";
import { IllustrationStage } from "../components/IllustrationStage";

const DEFAULT_RESPONSE_LIMIT = 1;
const submitIllustration = "/brand/submission-success.png";
const questionIllustration = "/brand/form-missing.png";

function responseCountStorageKey(formObjectId: string, address?: string) {
  return `formrus_response_count_${formObjectId}_${(address ?? "anon").toLowerCase()}`;
}

function getStoredResponseCount(formObjectId: string, address?: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(responseCountStorageKey(formObjectId, address));
    const count = Number(raw ?? "0");
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  } catch {
    return 0;
  }
}

function setStoredResponseCount(formObjectId: string, address: string | undefined, count: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(responseCountStorageKey(formObjectId, address), String(Math.max(0, Math.floor(count))));
  } catch {
    // Ignore storage errors.
  }
}

function parsePathFormObjectId(): string {
  const match = window.location.pathname.match(/\/(?:view|embed)\/([^/]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
}

interface ValidationResult {
  fieldId: string;
  message: string;
}

function richTextPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function fieldHasValue(field: FormDraft["fields"][number], formData: FormData): boolean {
  if (field.type === "rich_text") {
    return richTextPlainText(String(formData.get(field.id) ?? "")).length > 0;
  }
  if (field.type === "checkboxes") {
    return formData.getAll(field.id).length > 0;
  }
  if (field.type === "star_rating") {
    return Number(formData.get(field.id) ?? 0) > 0;
  }
  if (field.type === "dropdown") {
    const value = String(formData.get(field.id) ?? "").trim();
    if (!value) return false;
    if (value === "other") return String(formData.get(`${field.id}__other`) ?? "").trim().length > 0;
    return true;
  }
  if (field.type === "confirmation") {
    return formData.get(field.id) === "on";
  }
  if (field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload") {
    return formData
      .getAll(field.id)
      .some((value) => value instanceof File && value.size > 0 && value.name.trim().length > 0);
  }
  return String(formData.get(field.id) ?? "").trim().length > 0;
}

function validateRequiredCustomFields(schema: FormDraft, formData: FormData): ValidationResult | null {
  for (const field of schema.fields) {
    if (!field.required) continue;
    if (!fieldHasValue(field, formData)) {
      return { fieldId: field.id, message: `${field.label} is required.` };
    }
  }
  return null;
}

function responseValueForField(field: FormDraft["fields"][number], formData: FormData): unknown {
  if (field.type === "dropdown" && formData.get(field.id) === "other") {
    return String(formData.get(`${field.id}__other`) ?? "").trim();
  }
  return formData.get(field.id);
}

function focusField(fieldId: string) {
  const directTarget = document.getElementById(`field-${fieldId}`);
  if (directTarget instanceof HTMLElement) {
    directTarget.focus();
    return;
  }

  const fieldEl = document.querySelector<HTMLElement>(`[data-form-field-id="${fieldId}"]`);
  const fallbackTarget = fieldEl?.querySelector<HTMLElement>("textarea, select, input:not([type='hidden']), [contenteditable='true']");
  fallbackTarget?.focus();
}

function revealInvalidField(fieldId: string, message: string) {
  setTimeout(() => {
    const fieldEl = document.querySelector<HTMLElement>(`[data-form-field-id="${fieldId}"]`);
    fieldEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    focusField(fieldId);
  }, 0);
  return { fieldId, message };
}

async function uploadResponseFiles(field: FormDraft["fields"][number], formData: FormData) {
  const files = formData
    .getAll(field.id)
    .filter((value): value is File => value instanceof File && value.size > 0);

  const maxFiles = field.maxFiles ?? 1;
  if (files.length > maxFiles) {
    throw new Error(`${field.label} allows up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}.`);
  }

  const uploaded = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      blobId: await uploadFileToWalrusWithPolicy(file, {
        maxSizeBytes: field.maxSizeBytes,
        acceptedMimeTypes: field.acceptedMimeTypes
      })
    }))
  );

  return maxFiles > 1 ? uploaded : uploaded[0] ?? null;
}

export function PublicViewPage() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const formObjectId = useMemo(() => parsePathFormObjectId(), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<FormDraft | null>(null);
  const [dna, setDna] = useState("");
  const [chainState, setChainState] = useState<FormChainState | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityCheckResult | null>(null);
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set());
  const [invalidFieldId, setInvalidFieldId] = useState<string | null>(null);
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    void load();
  }, [formObjectId]);

  useEffect(() => {
    const count = getStoredResponseCount(formObjectId, account?.address);
    setResponseCount(count);
  }, [formObjectId, account?.address]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const object = await client.getObject({ id: formObjectId, options: { showContent: true } });
      if (!object.data?.content || object.data.content.dataType !== "moveObject") {
        throw new Error("Form object not found.");
      }
      const resolved = parseFormFields(object.data.content, normalizeDna);
      setDna(resolved.dna);
      setChainState(resolved);
      const draft = await fetchWalrusJson<FormDraft>(resolved.schemaBlobId);
      setSchema(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load form.");
    } finally {
      setLoading(false);
    }
  }

  // Track which fields have been filled
  function handleFieldInput(fieldId: string, value: unknown) {
    const field = schema?.fields.find((item) => item.id === fieldId);
    if (!field) return;

    let hasValue = false;
    if (field.type === "rich_text") {
      hasValue = richTextPlainText(String(value ?? "")).length > 0;
    } else if (field.type === "checkboxes") {
      hasValue = Array.isArray(value) && value.length > 0;
    } else if (field.type === "star_rating") {
      hasValue = Number(value ?? 0) > 0;
    } else if (field.type === "confirmation") {
      hasValue = value === true;
    } else if (field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload") {
      hasValue = Array.isArray(value) && value.some((file) => file instanceof File && file.size > 0);
    } else {
      hasValue =
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "";
    }

    if (invalidFieldId === fieldId && hasValue) setInvalidFieldId(null);
    setFilledFields((prev) => {
      const next = new Set(prev);
      if (hasValue) next.add(fieldId);
      else next.delete(fieldId);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    if (!schema || submitting) return;

    const effectiveLimit = chainState?.maxPerAddress && chainState.maxPerAddress > 0
      ? chainState.maxPerAddress
      : DEFAULT_RESPONSE_LIMIT;
    if (responseCount >= effectiveLimit) {
      setError(`Response limit reached for this wallet (${effectiveLimit}/${effectiveLimit}).`);
      return;
    }

    if (!account?.address) {
      setError("Connect your wallet to submit.");
      return;
    }

    if (chainState && !chainState.active) {
      setError("This form is no longer accepting responses.");
      return;
    }

    const formData = new FormData(formEl);
    const validationError = validateRequiredCustomFields(schema, formData);
    if (validationError) {
      setError(validationError.message);
      setInvalidFieldId(validationError.fieldId);
      revealInvalidField(validationError.fieldId, validationError.message);
      return;
    }

    setSubmitting(true);
    setError(null);
    setInvalidFieldId(null);

    try {
      const eligibility = await checkSubmissionEligibility({
        suiClient: client,
        submitter: account.address,
        form: { eligibility: schema.eligibility ?? {} }
      });
      setEligibilityResult(eligibility);

      if (!eligibility.eligible) {
        setError(eligibility.messages.join(" "));
        return;
      }

      const response: Record<string, unknown> = {};

      for (const field of schema.fields) {
        if (field.type === "checkboxes") {
          response[field.id] = formData.getAll(field.id);
        } else if (field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload") {
          response[field.id] = await uploadResponseFiles(field, formData);
        } else if (field.type === "confirmation") {
          response[field.id] = formData.get(field.id) === "on";
        } else {
          response[field.id] = responseValueForField(field, formData);
        }
      }

      await submitResponseAndAct(
        {
          formObjectId,
          dna,
          submitter: account.address,
          responsePrivacy: schema.responsePrivacy ?? "private",
          eligibilityProof: eligibility.proof,
          response,
          customHandlerTarget: schema.handler?.type === "custom" ? schema.handler.customTarget : undefined,
          typeArguments: schema.handler?.typeArguments,
        },
        client,
        ({ transaction }) => signAndExecuteTransaction({ transaction, chain: `sui:${suiNetwork}` })
      );

      const nextCount = responseCount + 1;
      setResponseCount(nextCount);
      setStoredResponseCount(formObjectId, account.address, nextCount);
      setSubmitted(true);
      formEl.reset();
      setFilledFields(new Set());
      setInvalidFieldId(null);
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────

  if (loading) {
    return <SkeletonFormPage />;
  }

  // ── Success ────────────────────────────────────────────────────

  const effectiveLimit = chainState?.maxPerAddress && chainState.maxPerAddress > 0
    ? chainState.maxPerAddress
    : DEFAULT_RESPONSE_LIMIT;
  const responseLimitReached = responseCount >= effectiveLimit;
  const showSubmittedView = submitted || responseLimitReached;

  if (showSubmittedView) {
    return (
      <div className="min-h-screen dot-grid flex items-center justify-center px-4 py-8" style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-2xl w-full border-[3px] border-retro-border overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "7px 7px 0px var(--shadow-color)" }}>
          <div className="grid md:grid-cols-[0.95fr_1.05fr]">
            <div className="p-5 md:p-6 border-b-[3px] md:border-b-0 md:border-r-[3px] border-retro-border" style={{ background: "linear-gradient(180deg, rgba(57,255,20,0.14) 0%, transparent 100%)" }}>
              <IllustrationStage src={submitIllustration} alt="Submission completed" label="Response Logged" tone="lime" imageMaxWidth={250} minHeightClassName="min-h-[240px]" />
            </div>
            <div className="p-6 md:p-8 text-center md:text-left flex flex-col justify-center">
              <div className="w-16 h-16 mx-auto md:mx-0 mb-4 border-[3px] border-retro-border flex items-center justify-center" style={{ background: "var(--neon-lime)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <CheckCircle size={32} color="#000" />
              </div>
              <h2 className="font-mono font-bold text-lg md:text-2xl uppercase mb-2" style={{ color: "var(--text)" }}>Response Submitted</h2>
              <p className="font-mono text-xs md:text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Your response has been recorded on Sui and stored on Walrus.
                {schema?.responsePrivacy === "private" ? " It is encrypted and only visible to the form creator or admins." : ""}
                {responseLimitReached ? ` Response limit reached for this wallet (${effectiveLimit}/${effectiveLimit}).` : ""}
              </p>
              {!responseLimitReached ? (
                <button
                  onClick={() => { setSubmitted(false); setError(null); }}
                  className="retro-button-neon text-xs md:text-sm self-center md:self-start"
                  style={{ backgroundColor: "#39FF14", color: "#000" }}
                >
                  Submit Another Response
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error (form not found) ─────────────────────────────────────

  if (error && !schema) {
    return (
      <div className="min-h-screen dot-grid flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-lg w-full border-[3px] border-retro-border overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}>
          <div className="px-6 pt-8 pb-3 text-center border-b-[3px] border-retro-border" style={{ background: "linear-gradient(180deg, rgba(255,105,180,0.14) 0%, transparent 100%)" }}>
            <IllustrationStage src={questionIllustration} alt="Form not found" label="Missing Form" tone="pink" imageMaxWidth={260} minHeightClassName="min-h-[230px]" />
          </div>
          <div className="p-8 text-center">
            <h2 className="font-mono font-bold text-lg uppercase mb-2" style={{ color: "#FF69B4" }}>Form Not Found</h2>
            <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────

  const privacy = schema?.responsePrivacy ?? "private";
  const totalFields = schema?.fields.length ?? 0;
  const filledCount = schema ? schema.fields.filter((f) => filledFields.has(f.id)).length : 0;
  const progressPct = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;
  const isFormDisabled =
    submitting ||
    !chainState?.active ||
    responseLimitReached;

  const bannerUrl = safeUrl(schema?.branding?.bannerUrl);
  const avatarUrl = safeUrl(schema?.branding?.avatarUrl);

  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <header
        className="h-16 flex items-center justify-between px-4 md:px-6 lg:px-10 sticky top-0 z-50"
        style={{ background: "var(--nav-bg)", borderBottom: "3px solid var(--border-color)", boxShadow: "0 3px 0 var(--shadow-color)" }}
      >
        <span className="font-mono text-sm font-bold uppercase tracking-tight truncate max-w-[60%]" style={{ color: "var(--text)" }}>
          {schema?.title ?? "Formrus"}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <FormrusConnectButton compact />
        </div>
      </header>

      {/* Content */}
      <main className="pt-6 md:pt-8 pb-20 px-4 md:px-6 lg:px-10 max-w-5xl mx-auto">
        <section
          className="border-[3px] border-retro-border mb-6"
          style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
        >
          {bannerUrl ? (
            <div
              className="relative border-b-[3px] border-retro-border overflow-hidden"
              style={{ height: `${schema?.branding?.bannerHeight ?? 180}px` }}
            >
              <img
                src={bannerUrl}
                alt=""
                className="w-full h-full block object-cover"
                style={{ objectPosition: `center ${schema?.branding?.bannerPosition ?? 50}%` }}
              />
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.1) 100%)" }}
              />
              <div className="absolute right-4 top-4 z-20 border-[2px] border-retro-border px-2 py-1 font-mono text-[10px] uppercase font-bold" style={{ background: "#FFFF00", color: "#000" }}>
                Live on Sui
              </div>
            </div>
          ) : null}

          <div className="p-5 md:p-6 relative z-30">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className={`${bannerUrl ? "-mt-12 md:-mt-16" : ""} object-cover border-[3px] border-retro-border mb-4 relative z-40`}
                style={{
                  width: `${schema?.branding?.logoSize ?? 80}px`,
                  height: `${schema?.branding?.logoSize ?? 80}px`,
                  boxShadow: "4px 4px 0px var(--shadow-color)",
                  background: "var(--bg-card)"
                }}
              />
            ) : null}

            <div className="space-y-4">
              <div className="max-w-2xl">
                <h1 className="font-mono font-bold text-2xl md:text-3xl uppercase tracking-tight mb-3" style={{ color: "var(--text)" }}>
                  {schema?.title ?? "Form"}
                </h1>
                {schema?.description ? (
                  <p className="font-mono text-xs md:text-sm leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
                    {schema.description}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                <div className="border-[2px] border-retro-border px-3 py-2.5" style={{ background: "var(--bg-secondary)" }}>
                  <div className="font-mono text-[9px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Privacy</div>
                  <div className="font-mono text-xs font-bold" style={{ color: privacy === "private" ? "var(--neon-magenta)" : "var(--text)" }}>
                    {privacy === "private" ? "Encrypted" : "Public"}
                  </div>
                </div>
                <div className="border-[2px] border-retro-border px-3 py-2.5" style={{ background: "var(--bg-secondary)" }}>
                  <div className="font-mono text-[9px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Fields</div>
                  <div className="font-mono text-xs font-bold" style={{ color: "var(--text)" }}>
                    {totalFields}
                  </div>
                </div>
                <div className="border-[2px] border-retro-border px-3 py-2.5 col-span-2 md:col-span-1" style={{ background: chainState?.actionType === 1 ? "#39FF14" : "var(--bg-secondary)" }}>
                  <div className="font-mono text-[9px] uppercase mb-1" style={{ color: chainState?.actionType === 1 ? "#000" : "var(--text-muted)" }}>Reward</div>
                  <div className="font-mono text-xs font-bold" style={{ color: chainState?.actionType === 1 ? "#000" : "var(--text)" }}>
                    {chainState?.actionType === 1 ? `${mistToSui(chainState.rewardAmountMist)} SUI` : "None"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="border-[3px] border-retro-border p-4 md:p-6"
          style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
        >
          <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "var(--text-muted)" }}>
                Response Form
              </div>
              <div className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                Fill every required field, then sign once to submit on-chain.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 border-[2px] border-retro-border px-2 py-1" style={{ background: "var(--bg-secondary)" }}>
                <ShieldCheck size={12} style={{ color: "var(--neon-lime)" }} />
                <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {account?.address ? "wallet connected" : "wallet required"}
                </span>
              </div>
              <div className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                {progressPct}% ready
              </div>
            </div>
          </div>

          {totalFields > 0 ? (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>Completion</span>
                <span className="font-mono text-[10px] font-bold" style={{ color: filledCount === totalFields ? "var(--neon-lime)" : "var(--text)" }}>
                  {filledCount}/{totalFields}
                </span>
              </div>
              <div className="h-3 border-[2px] border-retro-border p-[2px]" style={{ background: "var(--bg)" }}>
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${progressPct}%`,
                    background: filledCount === totalFields ? "var(--neon-lime)" : "var(--neon-cyan)",
                  }}
                />
              </div>
            </div>
          ) : null}

          {privacy === "public" ? (
            <div className="border-[3px] border-retro-border p-4 mb-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#FFFF00" }} />
                <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Public responses are readable by anyone with the Walrus blob ID. Your wallet address will be visible on-chain.
                </p>
              </div>
            </div>
          ) : null}

          {chainState && !chainState.active ? (
            <div className="border-[3px] border-retro-border p-4 mb-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <p className="font-mono text-[10px] font-bold uppercase" style={{ color: "#FF69B4" }}>
                This form is not accepting responses.
              </p>
            </div>
          ) : null}

          {responseLimitReached ? (
            <div className="border-[3px] border-retro-border p-4 mb-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <p className="font-mono text-[10px] font-bold uppercase" style={{ color: "#FF69B4" }}>
                Response limit reached for this wallet.
              </p>
              <p className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Allowed submissions per wallet: {effectiveLimit}
              </p>
            </div>
          ) : null}

          {chainState?.actionType === 1 && chainState.remainingPoolMist !== null && chainState.remainingPoolMist < chainState.rewardAmountMist ? (
            <div className="border-[3px] border-retro-border p-4 mb-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <p className="font-mono text-[10px] font-bold uppercase mb-1" style={{ color: "#FF69B4" }}>
                Reward funding low
              </p>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                New submissions will fail until the creator tops up the pool.
              </p>
            </div>
          ) : null}

          {/* Eligibility warning */}
          {eligibilityResult && !eligibilityResult.eligible ? (
            <div className="border-[3px] border-retro-border p-4 mb-5 font-mono text-xs flex items-start gap-2" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{eligibilityResult.messages.join(" ")}</span>
            </div>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="border-[3px] border-retro-border p-4 mb-5 font-mono text-xs flex items-start gap-2" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Form fields */}
          <form
            noValidate
            onSubmit={submit}
            onInvalidCapture={(e) => {
              e.preventDefault();
              const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              const rawName = "name" in target ? target.name : "";
              const fieldId = rawName
                ? rawName.endsWith("__other") ? rawName.slice(0, -7) : rawName
                : target.id.startsWith("field-") ? target.id.slice(6) : "";
              const field = schema?.fields.find((item) => item.id === fieldId);
              if (!fieldId || !field) return;
              const message = `${field.label} is required.`;
              setError(message);
              setInvalidFieldId(fieldId);
              revealInvalidField(fieldId, message);
            }}
            onInput={(e) => {
              const target = e.target as HTMLElement;
              const namedTarget = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              const rawName = "name" in namedTarget ? namedTarget.name : "";
              const fieldId = rawName
                ? rawName.endsWith("__other") ? rawName.slice(0, -7) : rawName
                : target.id.startsWith("field-") ? target.id.slice(6) : "";
              const field = schema?.fields.find((f) => f.id === fieldId);
              if (!fieldId || !field) return;

              if (target instanceof HTMLInputElement && target.type === "checkbox") {
                if (field.type === "confirmation") {
                  handleFieldInput(fieldId, target.checked);
                  return;
                }
                const values = target.form ? new FormData(target.form).getAll(fieldId) : [];
                handleFieldInput(fieldId, values);
                return;
              }
              if (target instanceof HTMLInputElement && target.type === "file") {
                handleFieldInput(fieldId, Array.from(target.files ?? []));
                return;
              }
              if (target instanceof HTMLElement && target.getAttribute("contenteditable") === "true") {
                handleFieldInput(fieldId, target.innerHTML);
                return;
              }
              if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
                handleFieldInput(fieldId, target.value);
              }
            }}
            onChange={(e) => {
              const target = e.target as HTMLElement;
              if (target instanceof HTMLInputElement && target.type === "file") {
                const fieldId = target.name;
                if (fieldId && schema?.fields.some((f) => f.id === fieldId)) {
                  handleFieldInput(fieldId, Array.from(target.files ?? []));
                }
              }
            }}
            className="space-y-4"
          >
            {(schema?.fields ?? []).map((field, index) => (
              <div
                key={field.id}
                className="relative scroll-mt-24"
                data-form-field-id={field.id}
              >
                <div
                  className="absolute left-0 top-5 bottom-5 w-[3px]"
                  style={{ background: invalidFieldId === field.id ? "#FF69B4" : filledFields.has(field.id) ? "var(--neon-lime)" : "var(--border-light)" }}
                />
                <div className="absolute left-0 top-0 -translate-x-1/2 w-8 h-8 flex items-center justify-center border-[2px] border-retro-border font-mono text-[10px] font-bold z-10" style={{ background: invalidFieldId === field.id ? "#FF69B4" : filledFields.has(field.id) ? "var(--neon-lime)" : "#00FFFF", color: "#000", boxShadow: "2px 2px 0px var(--shadow-color)" }}>
                  {index + 1}
                </div>
                <div className="pl-6">
                  <FieldInput field={field} invalid={invalidFieldId === field.id} />
                </div>
              </div>
            ))}

            {/* Submit area */}
            <div className="pt-4 mt-2 border-t-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
              {!account?.address ? (
                <div
                  className="border-[3px] border-retro-border p-5 text-center"
                  style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
                >
                  <p className="font-mono text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                    Connect your wallet to submit this form.
                  </p>
                  <FormrusConnectButton />
                </div>
              ) : (
                <button
                  className="retro-button-neon w-full justify-center text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#39FF14", color: "#000" }}
                  type="submit"
                  disabled={isFormDisabled}
                >
                  {submitting ? "Submitting…" : "Submit Response"}
                </button>
              )}
            </div>
          </form>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
