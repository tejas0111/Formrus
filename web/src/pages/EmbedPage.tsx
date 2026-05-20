import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { normalizeDna } from "../lib/crypto";
import { fetchWalrusJson } from "../lib/walrusRead";
import { submitResponseAndAct } from "../lib/submission";
import { uploadFileToWalrusWithPolicy } from "../lib/walrusAdapter";
import { checkSubmissionEligibility, type EligibilityCheckResult } from "../lib/eligibility";
import type { FormDraft } from "../types/form";
import { suiNetwork } from "../lib/config";
import { FieldInput } from "../components/FormFields";
import { Skeleton } from "../components/Skeleton";
import FormrusConnectButton from "../components/FormrusConnectButton";
import SiteFooter from "../components/SiteFooter";
import ThemeToggle from "../components/ThemeToggle";
import { useWidgetWallet } from "../components/WidgetWalletContext";
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

function validateRequiredCustomFields(schema: FormDraft, formData: FormData): string | null {
  for (const field of schema.fields) {
    if (!field.required) continue;
    if (field.type === "rich_text") {
      const html = String(formData.get(field.id) ?? "");
      const plainText = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      if (!plainText) return `${field.label} is required.`;
    }
    if (field.type === "checkboxes" && formData.getAll(field.id).length === 0) {
      return `${field.label} is required.`;
    }
    if (field.type === "star_rating" && Number(formData.get(field.id) ?? 0) <= 0) {
      return `${field.label} is required.`;
    }
    if (field.type === "dropdown" && formData.get(field.id) === "other") {
      const otherValue = String(formData.get(`${field.id}__other`) ?? "").trim();
      if (!otherValue) return `${field.label} is required.`;
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

/**
 * Embeddable form page.
 * Renders the form in a minimal layout with no navigation — designed for <iframe> use.
 * Route: /embed/:formId
 */
export function EmbedPage({
  formObjectId: formObjectIdOverride,
  showThemeToggle = true,
}: {
  formObjectId?: string;
  showThemeToggle?: boolean;
} = {}) {
  const client = useSuiClient();
  const widgetWallet = useWidgetWallet();
  const dappKitAccount = useCurrentAccount();
  const account = widgetWallet?.account ?? dappKitAccount;
  const { mutateAsync: dappKitSignAndExecuteTransaction } = useSignAndExecuteTransaction();

  const formObjectId = useMemo(() => formObjectIdOverride ?? parsePathFormObjectId(), [formObjectIdOverride]);
  const isFramed = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<FormDraft | null>(null);
  const [dna, setDna] = useState("");
  const [chainState, setChainState] = useState<FormChainState | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityCheckResult | null>(null);
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set());
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
        throw new Error("Form not found.");
      }
      const resolved = parseFormFields(object.data.content, normalizeDna);
      setDna(resolved.dna);
      setChainState(resolved);
      const draft = await fetchWalrusJson<FormDraft>(resolved.schemaBlobId);
      setSchema(draft);
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setLoading(false);
    }
  }

  function handleFieldInput(fieldId: string, value: unknown) {
    setFilledFields((prev) => {
      const next = new Set(prev);
      const hasValue =
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0);
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
      setError(isFramed ? "Wallet access is limited inside embedded iframes. Open the full form in a new tab to connect and submit." : "Connect your wallet first.");
      return;
    }

    if (chainState && !chainState.active) {
      setError("This form is closed.");
      return;
    }

    const formData = new FormData(formEl);
    const validationError = validateRequiredCustomFields(schema, formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

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
          typeArguments: schema.handler?.typeArguments
        },
        client,
        ({ transaction }) =>
          widgetWallet?.signAndExecuteTransaction
            ? widgetWallet.signAndExecuteTransaction({ transaction, chain: `sui:${suiNetwork}` })
            : dappKitSignAndExecuteTransaction({ transaction, chain: `sui:${suiNetwork}` })
      );

      const nextCount = responseCount + 1;
      setResponseCount(nextCount);
      setStoredResponseCount(formObjectId, account.address, nextCount);
      setSubmitted(true);
      formEl.reset();
      setFilledFields(new Set());
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[200px] p-6 max-w-lg mx-auto" style={{ background: "var(--bg)" }}>
        <Skeleton className="h-5 w-3/4 mb-3" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-2/3 mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-[3px] border-retro-border p-4 mb-3" style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-full mt-2" />
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────

  const effectiveLimit = chainState?.maxPerAddress && chainState.maxPerAddress > 0
    ? chainState.maxPerAddress
    : DEFAULT_RESPONSE_LIMIT;
  const responseLimitReached = responseCount >= effectiveLimit;
  const showSubmittedView = submitted || responseLimitReached;

  if (showSubmittedView) {
    return (
      <div className="min-h-full w-full flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-md border-[3px] border-retro-border overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
          <div className="p-4 border-b-[3px] border-retro-border" style={{ background: "linear-gradient(180deg, rgba(57,255,20,0.14) 0%, transparent 100%)" }}>
            <IllustrationStage src={submitIllustration} alt="Submission completed" label="Submitted" tone="lime" imageMaxWidth={170} minHeightClassName="min-h-[190px]" />
          </div>
          <div className="p-5 text-center" style={{ background: "var(--bg-card)" }}>
          <div className="w-14 h-14 mx-auto mb-3 border-[3px] border-retro-border flex items-center justify-center" style={{ background: "var(--neon-lime)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
            <CheckCircle size={28} color="#000" />
          </div>
          <p className="font-mono font-bold text-sm uppercase mb-1" style={{ color: "var(--text)" }}>Response Submitted</p>
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Response recorded on Sui.
            {schema?.responsePrivacy === "private" ? " Encrypted — only the form creator or admins can read it." : ""}
            {responseLimitReached ? ` Response limit reached for this wallet (${effectiveLimit}/${effectiveLimit}).` : ""}
          </p>
          {!responseLimitReached ? (
            <button
              onClick={() => { setSubmitted(false); setError(null); }}
              className="mt-4 retro-button-neon text-[11px] flex mx-auto justify-center leading-none"
              style={{ backgroundColor: "#39FF14", color: "#000", boxShadow: "none" }}
            >
              Submit another
            </button>
          ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────

  if (error && !schema) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-sm border-[3px] border-retro-border p-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
          <IllustrationStage src={questionIllustration} alt="Form not found" label="Not Found" tone="pink" imageMaxWidth={170} minHeightClassName="min-h-[180px]" />
          <p className="font-mono text-xs" style={{ color: "#FF69B4" }}>{error}</p>
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
    <div className="min-h-[200px]" style={{ background: "var(--bg)", overflowX: "hidden" }}>
      <div className="max-w-2xl mx-auto p-4 md:p-5 pb-16">
        <section
          className="border-[3px] border-retro-border overflow-hidden mb-4"
          style={{ background: "var(--bg-card)", boxShadow: "5px 5px 0px var(--shadow-color)" }}
        >
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-b-[3px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
            <div className="flex items-center gap-2">
              {showThemeToggle ? <ThemeToggle compact /> : null}
              <FormrusConnectButton compact />
            </div>
          </div>

          {bannerUrl ? (
            <div
              className="relative border-b-[3px] border-retro-border overflow-hidden"
              style={{ height: `${schema?.branding?.bannerHeight ?? 140}px` }}
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
            </div>
          ) : null}

          <div className={`p-4 md:p-5 relative z-30 flex flex-col ${
            schema?.branding?.logoAlign === "center" ? "items-center" : 
            schema?.branding?.logoAlign === "right" ? "items-end" : "items-start"
          }`}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className={`${bannerUrl ? "-mt-10 md:-mt-12" : ""} object-cover border-[3px] border-retro-border mb-4 relative z-40`}
                style={{
                  width: `${schema?.branding?.logoSize ?? 80}px`,
                  height: `${schema?.branding?.logoSize ?? 80}px`,
                  boxShadow: "4px 4px 0px var(--shadow-color)",
                  background: "var(--bg-card)"
                }}
              />
            ) : null}
            <h1 className="font-mono font-bold text-lg md:text-2xl uppercase tracking-tight mb-2" style={{ color: "var(--text)" }}>
              {schema?.title ?? "Form"}
            </h1>
            {schema?.description ? (
              <p className="font-mono text-[11px] md:text-xs leading-relaxed max-w-xl" style={{ color: "var(--text-secondary)" }}>
                {schema.description}
              </p>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="border-[2px] border-retro-border px-2.5 py-2" style={{ background: "var(--bg-secondary)" }}>
                <div className="font-mono text-[8px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Privacy</div>
                <div className="font-mono text-[10px] font-bold" style={{ color: privacy === "private" ? "var(--neon-magenta)" : "var(--text)" }}>
                  {privacy === "private" ? "Encrypted" : "Public"}
                </div>
              </div>
              <div className="border-[2px] border-retro-border px-2.5 py-2" style={{ background: "var(--bg-secondary)" }}>
                <div className="font-mono text-[8px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Fields</div>
                <div className="font-mono text-[10px] font-bold" style={{ color: "var(--text)" }}>{totalFields}</div>
              </div>
              <div className="border-[2px] border-retro-border px-2.5 py-2" style={{ background: "var(--bg-secondary)" }}>
                <div className="font-mono text-[8px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Progress</div>
                <div className="font-mono text-[10px] font-bold" style={{ color: "var(--text)" }}>{progressPct}%</div>
              </div>
              <div className="border-[2px] border-retro-border px-2.5 py-2" style={{ background: chainState?.actionType === 1 ? "#39FF14" : "var(--bg-secondary)" }}>
                <div className="font-mono text-[8px] uppercase mb-1" style={{ color: chainState?.actionType === 1 ? "#000" : "var(--text-muted)" }}>Reward</div>
                <div className="font-mono text-[10px] font-bold" style={{ color: chainState?.actionType === 1 ? "#000" : "var(--text)" }}>
                  {chainState?.actionType === 1 ? mistToSui(chainState.rewardAmountMist) : "None"}
                </div>
              </div>
            </div>

            {privacy === "public" ? (
              <div className="flex items-start gap-2 mt-3 p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#FFFF00" }} />
                <p className="font-mono text-[9px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Public responses are readable by anyone with the blob ID. Your wallet address will be visible.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {totalFields > 0 ? (
          <div className="mb-4 border-[3px] border-retro-border p-3" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>Progress</span>
              <span className="font-mono text-[9px] font-bold" style={{ color: filledCount === totalFields ? "var(--neon-lime)" : "var(--text-muted)" }}>
                {filledCount}/{totalFields}
              </span>
            </div>
            <div className="h-2 border-[2px] border-retro-border p-[2px]" style={{ background: "var(--bg)" }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progressPct}%`, background: filledCount === totalFields ? "var(--neon-lime)" : "var(--neon-cyan)" }}
              />
            </div>
          </div>
        ) : null}

        {/* Eligibility */}
        {eligibilityResult && !eligibilityResult.eligible ? (
          <div className="border-[2px] border-retro-border p-3 mb-4 font-mono text-[10px] flex items-start gap-2" style={{ background: "var(--bg-card)", color: "#FF69B4" }}>
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>{eligibilityResult.messages.join(" ")}</span>
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="border-[2px] border-retro-border p-3 mb-4 font-mono text-[10px] flex items-start gap-2" style={{ background: "var(--bg-card)", color: "#FF69B4" }}>
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {isFramed && !account?.address ? (
          <div className="border-[2px] border-retro-border p-3 mb-4" style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
            <p className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
              Embedded iframes do not reliably receive wallet access from browser wallets. Open the full form to connect and submit.
            </p>
            <a
              href={`/view/${formObjectId}`}
              target="_blank"
              rel="noopener"
              className="retro-button-neon inline-flex text-[10px]"
              style={{ backgroundColor: "#39FF14", color: "#000" }}
            >
              Open Full Form
            </a>
          </div>
        ) : null}

        {/* Fields */}
        <form
          onSubmit={submit}
          onInput={(e) => {
            const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            const fieldId = target.name.endsWith("__other") ? target.name.slice(0, -7) : target.name;
            if (fieldId && schema?.fields.some((f) => f.id === fieldId)) {
              handleFieldInput(fieldId, target.value);
            }
          }}
          className="space-y-4 border-[3px] border-retro-border p-4 md:p-5"
          style={{ background: "var(--bg-card)", boxShadow: "5px 5px 0px var(--shadow-color)" }}
        >
          {(schema?.fields ?? []).map((field, index) => (
            <div key={field.id} className="relative">
              <div className="absolute left-0 top-5 bottom-5 w-[3px]" style={{ background: filledFields.has(field.id) ? "var(--neon-lime)" : "var(--border-light)" }} />
              <div
                className="absolute left-0 top-0 -translate-x-1/2 w-7 h-7 flex items-center justify-center border-[2px] border-retro-border font-mono text-[8px] font-bold z-10"
                style={{
                  background: filledFields.has(field.id) ? "var(--neon-lime)" : "#00FFFF",
                  color: "#000",
                  boxShadow: "2px 2px 0px var(--shadow-color)",
                }}
              >
                {index + 1}
              </div>
              <div className="pl-5">
                <FieldInput field={field} />
              </div>
            </div>
          ))}

          <div className="pt-3 mt-1 border-t-[2px] border-retro-border flex items-center gap-2" style={{ borderColor: "var(--border-light)" }}>
            {!account?.address ? (
              isFramed ? (
                <>
                  <a
                    href={`/view/${formObjectId}`}
                    target="_blank"
                    rel="noopener"
                    className="retro-button-neon"
                    style={{ backgroundColor: "#39FF14", color: "#000" }}
                  >
                    Open Full Form
                  </a>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Open in a new tab to connect wallet
                  </p>
                </>
              ) : (
                <>
                  <FormrusConnectButton />
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Connect wallet to submit
                  </p>
                </>
              )
            ) : (
              <button
                className="retro-button-neon flex-1 justify-center text-xs py-2.5 disabled:opacity-50"
                style={{ backgroundColor: "#39FF14", color: "#000" }}
                type="submit"
                disabled={isFormDisabled}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              )}
          </div>
        </form>

        {/* Paused */}
        {chainState && !chainState.active ? (
          <p className="font-mono text-[10px] text-center mt-3" style={{ color: "#FF69B4" }}>
            This form is closed.
          </p>
        ) : null}

        {/* Pool exhausted */}
        {chainState?.actionType === 1 && chainState.remainingPoolMist !== null && chainState.remainingPoolMist < chainState.rewardAmountMist ? (
          <p className="font-mono text-[10px] text-center mt-3" style={{ color: "#FF69B4" }}>
            Reward pool is below the required payout. New submissions will fail until the creator tops up the pool.
          </p>
        ) : null}

        {responseLimitReached ? (
          <p className="font-mono text-[10px] text-center mt-3" style={{ color: "#FF69B4" }}>
            Response limit reached for this wallet.
          </p>
        ) : null}

        <SiteFooter compact showLinks={false} brandHref="/" />
      </div>
    </div>
  );
}
