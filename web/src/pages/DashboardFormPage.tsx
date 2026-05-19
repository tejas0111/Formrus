import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useCurrentAccount, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { EventId } from "@mysten/sui/jsonRpc";
import {
  ArrowUpRight,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  KeyRound,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  X
} from "lucide-react";
import TopNav from "../components/TopNav";
import SiteFooter from "../components/SiteFooter";
import FormrusConnectButton from "../components/FormrusConnectButton";
import { ResponseChart } from "../components/ResponseChart";
import { useToast } from "../components/Toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Tooltip, HelpLabel } from "../components/Tooltip";
import { formrusPackageId, suiNetwork } from "../lib/config";
import { sealDecryptResponse, sealDecryptBatch } from "../lib/seal";
import { fetchWalrusJson, fetchWalrusText } from "../lib/walrusRead";
import { uploadJson } from "../lib/walrusAdapter";
import {
  buildSetAdminTx,
  buildSetViewerTx,
  buildTopUpPoolTx,
  buildSetFormActiveTx,
  buildUpdateSchemaBlobIdTx,
  buildUpdateRewardAmountTx,
  buildDrainAndDeactivateTx,
  buildSetMaxSubmissionsTx,
  buildExtendExpiryTx
} from "../lib/suiFormrus";
import type { FormDraft, StoredResponseBlob } from "../types/form";
import { asRecord, asStringList, eventDigest, formatTime, shorten, stringifyValue, suiToMist, mistToSui, parseFormFields, normalizeSuiAddress, readAddressSet } from "../lib/utils";
import { cacheGet, cacheSet, responseEventsCacheKey, formObjectCacheKey, TTL_EVENTS, TTL_FORM_OBJECT } from "../lib/cache";
import { translateError } from "../lib/errors";
import { normalizeDna } from "../lib/crypto";
import { IllustrationStage } from "../components/IllustrationStage";

const notFoundIllustration = "/brand/not-found-walrus.png";
const questionIllustration = "/brand/form-missing.png";

interface FormEventRow {
  formId: string;
  creator: string;
  schemaBlobId: string;
  actionType: number;
  rewardAmount: string;
  createdAtMs: string;
  txDigest: string;
  admins: string[];
  viewers: string[];
  maxPerAddress?: number;
  maxTotal?: number;
  packageId?: string;
  isLegacy?: boolean;
  expiresAtMs?: string;
}

interface ResponseEventRow {
  responseBlobId: string;
  submitter: string;
  createdAtMs: string;
  txDigest: string;
}

interface SelectedResponse {
  event: ResponseEventRow;
  blob: StoredResponseBlob | null;
  raw: string;
  decoded: Record<string, unknown> | null;
}

type DashboardAccessState = "checking" | "needs_wallet" | "forbidden" | "allowed";
type GuidePlacement = "top" | "right" | "bottom" | "left" | "center";
const MANAGE_GUIDE_DISMISSED_KEY = "manage_guide_dismissed_v1";

function packageIdFromType(type: unknown): string {
  const raw = typeof type === "string" ? type : "";
  const [pkg] = raw.split("::");
  return pkg ?? "";
}

export function DashboardFormPage() {
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionsMobileRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonMobileRef = useRef<HTMLButtonElement | null>(null);
  const queueRef = useRef<HTMLDivElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const { formId = "" } = useParams();
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const toast = useToast();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) => {
      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true }
      });
      return { digest: result.digest };
    }
  });

  const [form, setForm] = useState<FormEventRow | null>(null);
  const [schema, setSchema] = useState<FormDraft | null>(null);
  const [responses, setResponses] = useState<ResponseEventRow[]>([]);
  const [selected, setSelected] = useState<SelectedResponse | null>(null);
  const [remainingPoolMist, setRemainingPoolMist] = useState<string | null>(null);
  const [formActive, setFormActive] = useState<boolean | null>(null);
  const [maxPerAddress, setMaxPerAddress] = useState<number>(1);
  const [maxTotal, setMaxTotal] = useState<number>(0);
  const [chainDna, setChainDna] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"roles" | "pool" | "form" | "danger">("roles");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [eventTypePrefix, setEventTypePrefix] = useState("");
  const [accessState, setAccessState] = useState<DashboardAccessState>("checking");
  const [formPreviewOpen, setFormPreviewOpen] = useState(false);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideDismissForever, setGuideDismissForever] = useState(false);
  const [schemaBlobStatus, setSchemaBlobStatus] = useState<"checking" | "ok" | "missing">("checking");
  const [schemaRenewBusy, setSchemaRenewBusy] = useState(false);

  useEffect(() => {
    if (!formId) return;
    void loadFormPage();
  }, [formId, account?.address]);

  useEffect(() => {
    if (!account?.address || accessState !== "allowed") {
      setShowGuide(false);
      return;
    }
    try {
      if (!localStorage.getItem(MANAGE_GUIDE_DISMISSED_KEY)) {
        setGuideStep(0);
        setGuideDismissForever(false);
        setShowGuide(true);
      }
    } catch {
      setGuideStep(0);
      setGuideDismissForever(false);
      setShowGuide(true);
    }
  }, [account?.address, accessState]);

  useEffect(() => {
    if (!showGuide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showGuide]);

  // Poll for new responses every 30 seconds (pauses when tab is hidden)
  useEffect(() => {
    if (!formId || !eventTypePrefix) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval) return;
      interval = setInterval(async () => {
        try {
          const newResponses = await loadResponses(formId, eventTypePrefix);
          setResponses(newResponses);
        } catch {
          // Polling failed silently
        }
      }, 30_000);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) stopPolling();
      else startPolling();
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [formId, eventTypePrefix]);

  async function loadFormPage() {
    setLoading(true);
    setError(null);
    setSelected(null);
    setAccessState("checking");

    if (!account?.address) {
      setForm(null);
      setSchema(null);
      setResponses([]);
      setRemainingPoolMist(null);
      setFormActive(null);
      setEventTypePrefix("");
      setAccessState("needs_wallet");
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch latest on-chain state (most reliable)
      const object = await client.getObject({ id: formId, options: { showContent: true } });
      const content = object.data?.content;
      if (!content || content.dataType !== "moveObject") {
        throw new Error("Form object not found or invalid.");
      }
      
      const state = parseFormFields(content, normalizeDna);
      const packageId = packageIdFromType(object.data?.type) || packageIdFromType((content as { type?: string }).type) || formrusPackageId || "";
      const nextEventTypePrefix = packageId ? `${packageId}::registry::` : "";
      const connectedWallet = account.address.toLowerCase();
      const canView = connectedWallet === state.creator.toLowerCase()
        || state.admins.some((wallet) => wallet.toLowerCase() === connectedWallet)
        || state.viewers.some((wallet) => wallet.toLowerCase() === connectedWallet);

      if (!canView) {
        setForm(null);
        setSchema(null);
        setResponses([]);
        setRemainingPoolMist(null);
        setFormActive(null);
        setEventTypePrefix("");
        setAccessState("forbidden");
        return;
      }

      const initialForm: FormEventRow = {
        formId,
        creator: state.creator,
        schemaBlobId: state.schemaBlobId,
        actionType: state.actionType,
        rewardAmount: String(state.rewardAmountMist),
        createdAtMs: state.createdAtMs,
        txDigest: object.data?.digest ?? "",
        admins: state.admins,
        viewers: state.viewers,
        packageId,
        isLegacy: Boolean(packageId && formrusPackageId && packageId !== formrusPackageId),
        expiresAtMs: state.expiresAtMs,
      };
      setAccessState("allowed");
      setForm(initialForm);
      setEventTypePrefix(nextEventTypePrefix);
      setFormActive(state.active);
      setRemainingPoolMist(state.remainingPoolMist !== null ? String(state.remainingPoolMist) : null);

      // 2. Fetch schema from Walrus
      try {
        const loadedSchema = await fetchWalrusJson<FormDraft>(state.schemaBlobId);
        setSchema(loadedSchema);
        setSchemaBlobStatus("ok");
      } catch {
        setSchemaBlobStatus("missing");
        setSchema(null);
      }

      // 3. Parallel background loads
      void Promise.all([
        loadResponses(formId, nextEventTypePrefix).then(setResponses),
        loadFormActive(formId), // Refreshes state.active, maxPerAddress, etc.
      ]);

      // 4. Try to find the original registration event for the real txDigest (optional)
      findFormEvent(formId, nextEventTypePrefix).then((eventData) => {
        setForm(prev => prev ? { ...prev, txDigest: eventData.txDigest } : prev);
      }).catch(() => {
        // Ignore if registration event is too old to find
      });

    } catch (caught) {
      setError(translateError(caught));
      setSchemaBlobStatus("missing");
    } finally {
      setLoading(false);
    }
  }

  async function findFormEvent(targetFormId: string, typePrefix: string): Promise<FormEventRow> {
    if (!typePrefix) throw new Error("Form package could not be determined.");
    // Check cache first — avoids paginating through all events
    const cached = cacheGet<FormEventRow>(`formevent_${typePrefix}_${targetFormId}`);
    if (cached) return cached;

    let cursor: EventId | null = null;

    for (let i = 0; i < 10; i += 1) {
      const page = await client.queryEvents({
        query: { MoveEventType: `${typePrefix}FormRegistered` },
        cursor,
        limit: 50,
        order: "descending"
      });

      for (const event of page.data) {
        const parsed = asRecord(event.parsedJson);
        if (String(parsed.form_id ?? "") !== targetFormId) continue;

        const result: FormEventRow = {
          formId: String(parsed.form_id ?? ""),
          creator: String(parsed.creator ?? ""),
          schemaBlobId: String(parsed.schema_blob_id ?? ""),
          actionType: Number(parsed.action_type ?? 0),
          rewardAmount: String(parsed.reward_amount ?? "0"),
          createdAtMs: String(parsed.created_at_ms ?? "0"),
          txDigest: eventDigest(event.id),
          admins: asStringList(parsed.admins),
          viewers: asStringList(parsed.viewers),
          packageId: packageIdFromType(event.type),
          isLegacy: Boolean(packageIdFromType(event.type) && formrusPackageId && packageIdFromType(event.type) !== formrusPackageId)
        };
        cacheSet(`formevent_${typePrefix}_${targetFormId}`, result, TTL_FORM_OBJECT);
        return result;
      }

      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    throw new Error("Form registration event was not found.");
  }

  async function loadResponses(targetFormId: string, typePrefix: string): Promise<ResponseEventRow[]> {
    if (!typePrefix) return [];
    // Try cache first
    const cacheKey = responseEventsCacheKey(`${typePrefix}_${targetFormId}`);
    const cached = cacheGet<ResponseEventRow[]>(cacheKey);
    if (cached) return cached;

    const collected: ResponseEventRow[] = [];
    let cursor: EventId | null = null;

    for (let i = 0; i < 10; i += 1) {
      const page = await client.queryEvents({
        query: { MoveEventType: `${typePrefix}ResponseAccepted` },
        cursor,
        limit: 50,
        order: "descending"
      });

      for (const event of page.data) {
        const parsed = asRecord(event.parsedJson);
        if (String(parsed.form_id ?? "") !== targetFormId) continue;

        collected.push({
          responseBlobId: String(parsed.response_blob_id ?? ""),
          submitter: String(parsed.submitter ?? ""),
          createdAtMs: String(parsed.created_at_ms ?? "0"),
          txDigest: eventDigest(event.id)
        });
      }

      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    cacheSet(cacheKey, collected, TTL_EVENTS);
    return collected;
  }

  async function loadFormPool(targetFormId: string) {
    setRemainingPoolMist(null);
    try {
      const object = await client.getObject({ id: targetFormId, options: { showContent: true } });
      const content = object.data?.content;
      if (!content || content.dataType !== "moveObject") return;
      const fields = asRecord(asRecord(content as unknown).fields);
      const feePool = asRecord(fields.fee_pool);
      const feePoolFields = asRecord(feePool.fields);
      if (feePoolFields.value !== undefined) setRemainingPoolMist(String(feePoolFields.value));
    } catch {
      setRemainingPoolMist(null);
    }
  }

  async function loadFormActive(targetFormId: string) {
    try {
      const object = await client.getObject({ id: targetFormId, options: { showContent: true } });
      const content = object.data?.content;
      if (!content || content.dataType !== "moveObject") return;
      const state = parseFormFields(content, normalizeDna);
      setFormActive(state.active);
      setRemainingPoolMist(state.remainingPoolMist !== null ? String(state.remainingPoolMist) : null);
      setMaxPerAddress(state.maxPerAddress);
      setMaxTotal(state.maxTotal);
      setChainDna(state.dna);
    } catch {
      setFormActive(null);
    }
  }

  async function loadFormRoles(targetFormId: string) {
    try {
      const object = await client.getObject({ id: targetFormId, options: { showContent: true } });
      const content = object.data?.content;
      if (!content || content.dataType !== "moveObject") return;
      const fields = asRecord(asRecord(content as unknown).fields);

      const onChainAdmins = readAddressSet(fields.admins);
      const onChainViewers = readAddressSet(fields.viewers);

      // Update form state with on-chain roles (authoritative source)
      setForm((prev) => {
        if (!prev) return prev;
        return { ...prev, admins: onChainAdmins, viewers: onChainViewers };
      });
    } catch {
      // If role loading fails, keep the event-based data as fallback
    }
  }

  async function openResponse(response: ResponseEventRow) {
    setLoadingResponse(true);
    setError(null);

    try {
      const raw = await fetchWalrusText(response.responseBlobId);
      let blob: StoredResponseBlob | null = null;
      let decoded: Record<string, unknown> | null = null;

      try {
        const parsed = JSON.parse(raw) as StoredResponseBlob;
        if (parsed.kind === "formrus_response_v1") {
          blob = parsed;
          if (parsed.privacy === "public" && parsed.response) decoded = parsed.response;
        }
      } catch {
        // Raw payload remains visible below.
      }

      setSelected({ event: response, blob, raw, decoded });
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setLoadingResponse(false);
    }
  }

  async function decryptSelectedResponse() {
    if (!selected?.blob?.ciphertext) return;
    if (!account?.address) {
      setError("Connect an owner or admin wallet to decrypt private responses.");
      return;
    }
    // Use the authoritative on-chain DNA, not the blob-stored one.
    // The blob DNA may differ from on-chain due to vector<u8> serialization.
    const dnaForDecrypt = chainDna || selected.blob.dna;
    if (!dnaForDecrypt) {
      setError("Could not determine form DNA. Try refreshing the page.");
      return;
    }

    setDecrypting(true);
    setError(null);

    try {
      const decoded = await sealDecryptResponse({
        suiClient: client,
        formObjectId: formId,
        identityId: dnaForDecrypt,
        ciphertextHex: selected.blob.ciphertext,
        signerAddress: account.address,
        signPersonalMessage
      });
      setSelected({ ...selected, decoded });
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setDecrypting(false);
    }
  }

  // ── Admin actions ──────────────────────────────────────────────

  async function adminSetRole(kind: "admin" | "viewer", wallet: string, enabled: boolean) {
    if (!account?.address) return;
    const normalized = normalizeSuiAddress(wallet);
    if (!normalized) {
      setError("Invalid Sui address. Enter a valid 0x... address.");
      return;
    }
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = kind === "admin"
        ? buildSetAdminTx({ formObjectId: formId, wallet: normalized, enabled })
        : buildSetViewerTx({ formObjectId: formId, wallet: normalized, enabled });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`${enabled ? "Added" : "Removed"} ${kind}: ${shorten(wallet)} | tx: ${result.digest}`);
      toast.success(`${enabled ? "Added" : "Removed"} ${kind}: ${shorten(wallet)}`);
      await loadFormPage();
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminTopUp(amountSui: string) {
    if (!account?.address) return;
    const amountMist = suiToMist(amountSui);
    if (amountMist <= 0n) { setError("Amount must be positive."); return; }
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildTopUpPoolTx({ formObjectId: formId, amountMist });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Topped up ${amountSui} SUI | tx: ${result.digest}`);
      toast.success(`Topped up ${amountSui} SUI`);
      await loadFormPool(formId);
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminSetActive(active: boolean) {
    if (!account?.address) return;
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildSetFormActiveTx({ formObjectId: formId, active });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Form ${active ? "resumed" : "paused"} | tx: ${result.digest}`);
      toast.success(`Form ${active ? "resumed" : "paused"}`);
      setFormActive(active);
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminUpdateSchema(newBlobId: string) {
    if (!account?.address || !newBlobId.trim()) return;
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildUpdateSchemaBlobIdTx({ formObjectId: formId, newSchemaBlobId: newBlobId.trim() });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Schema updated | tx: ${result.digest}`);
      toast.success("Schema updated");
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminRenewSchemaBlob(epochs: number) {
    if (!account?.address || !schema) return;
    if (!Number.isInteger(epochs) || epochs < 1) {
      setError("Epochs must be a positive integer.");
      return;
    }
    setSchemaRenewBusy(true);
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const newBlobId = await uploadJson(schema, { epochs });
      const tx = buildUpdateSchemaBlobIdTx({ formObjectId: formId, newSchemaBlobId: newBlobId });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Schema renewed | tx: ${result.digest}`);
      toast.success("Schema renewed");
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setSchemaRenewBusy(false);
      setAdminBusy(false);
    }
  }

  async function adminExtendExpiry(newExpiresAtMs: number) {
    if (!account?.address) return;
    if (!Number.isFinite(newExpiresAtMs) || newExpiresAtMs <= Date.now()) {
      setError("Expiry must be in the future.");
      return;
    }
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildExtendExpiryTx({ formObjectId: formId, newExpiresAtMs: BigInt(Math.floor(newExpiresAtMs)) });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Expiry extended | tx: ${result.digest}`);
      toast.success("Expiry extended");
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminUpdateReward(newRewardSui: string) {
    if (!account?.address) return;
    const amountMist = suiToMist(newRewardSui);
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildUpdateRewardAmountTx({ formObjectId: formId, newRewardAmountMist: amountMist });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Reward updated to ${newRewardSui} SUI | tx: ${result.digest}`);
      toast.success("Reward updated");
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminSetMaxSubmissions(maxPer: number, maxTot: number) {

    if (!account?.address) return;
    if (!Number.isFinite(maxPer) || maxPer < 1) {
      setError("Per-wallet submission limit must be at least 1.");
      return;
    }
    if (!Number.isFinite(maxTot) || maxTot < 0) {
      setError("Total submission cap must be 0 or greater.");
      return;
    }
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildSetMaxSubmissionsTx({ formObjectId: formId, maxPerAddress: maxPer, maxTotal: maxTot });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Limits updated: ${maxPer}/wallet, ${maxTot || "unlimited"} total | tx: ${result.digest}`);
      toast.success("Submission limits updated");
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function adminDrainAndDeactivate() {
    if (!account?.address) return;
    setAdminBusy(true);
    setAdminMsg(null);
    setError(null);
    try {
      const tx = buildDrainAndDeactivateTx({ formObjectId: formId });
      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      setAdminMsg(`Pool drained and form deactivated | tx: ${result.digest}`);
      toast.success("Pool drained and form deactivated");
      // Optimistic local status update so UI reflects deactivation immediately.
      setFormActive(false);
      await loadFormPage();
    } catch (caught) {
      const message = translateError(caught);
      setError(message);
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function exportResponsesCsv() {
    if (!schema || responses.length === 0) {
      setError("No responses to export.");
      return;
    }

    const isPrivate = schema.responsePrivacy === "private";

    if (isPrivate && !canDecrypt) {
      setError("Connect an admin or creator wallet to decrypt and export private responses.");
      return;
    }

    setAdminBusy(true);
    setAdminMsg(isPrivate ? "Decrypting responses..." : "Exporting responses...");
    setError(null);

    try {
      const fieldLabels = schema.fields.map((f) => f.label);
      const fieldIds = schema.fields.map((f) => f.id);
      const header = ["submitter", "submitted_at", "blob_id", "privacy", ...fieldLabels];

      // Step 1: Fetch all blobs from Walrus
      const CONCURRENCY = 5;
      const fetchedBlobs: { response: ResponseEventRow; parsed: StoredResponseBlob }[] = [];
      const fetchErrors: string[] = [];

      for (let batchStart = 0; batchStart < responses.length; batchStart += CONCURRENCY) {
        const batch = responses.slice(batchStart, batchStart + CONCURRENCY);
        setAdminMsg(`Fetching responses... ${batchStart + 1}-${Math.min(batchStart + CONCURRENCY, responses.length)} of ${responses.length}`);

        const results = await Promise.allSettled(
          batch.map(async (response) => {
            const raw = await fetchWalrusText(response.responseBlobId);
            const parsed = JSON.parse(raw) as StoredResponseBlob;
            return { response, parsed };
          })
        );

        for (const result of results) {
          if (result.status === "rejected") {
            fetchErrors.push(result.reason instanceof Error ? result.reason.message : "Fetch failed");
            continue;
          }
          fetchedBlobs.push(result.value);
        }
      }

      // Step 2: Decrypt private responses in batch (one session key, one signature)
      let decryptedMap: Map<number, Record<string, unknown>> = new Map();

      if (isPrivate) {
        const privateItems = fetchedBlobs
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item.parsed.privacy === "private" && item.parsed.ciphertext);

        if (privateItems.length > 0) {
          setAdminMsg(`Decrypting ${privateItems.length} private response(s)...`);

          // Use on-chain DNA for all items — blob DNA may be a stale serialization
          const dnaForBatch = chainDna || privateItems[0]?.item.parsed.dna || "";

          const batchResults = await sealDecryptBatch({
            suiClient: client,
            formObjectId: formId,
            items: privateItems.map(({ item }) => ({
              ciphertextHex: item.parsed.ciphertext!,
              dna: dnaForBatch
            })),
            signerAddress: account!.address,
            signPersonalMessage,
            onProgress: (current, total) => {
              setAdminMsg(`Decrypting... ${current}/${total}`);
            }
          });

          for (const result of batchResults) {
            if (result.response) {
              decryptedMap.set(privateItems[result.index]!.idx, result.response);
            }
          }
        }
      }

      // Step 3: Build CSV rows
      const rows: string[][] = [];

      for (let i = 0; i < fetchedBlobs.length; i++) {
        const { response, parsed } = fetchedBlobs[i]!;
        let decoded: Record<string, unknown> | null = null;
        const privacy = parsed.privacy ?? "unknown";

        if (privacy === "public" && parsed.response) {
          decoded = parsed.response;
        } else if (privacy === "private") {
          decoded = decryptedMap.get(i) ?? null;
        }

        const cellValues = fieldIds.map((id) => {
          if (!decoded) return privacy === "private" ? "[decryption failed]" : "[unreadable]";
          const val = decoded[id];
          if (Array.isArray(val)) return val.join("; ");
          if (typeof val === "boolean") return val ? "Yes" : "No";
          if (val === null || val === undefined || val === "") return "";
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        });

        rows.push([
          response.submitter,
          formatTime(response.createdAtMs),
          response.responseBlobId,
          privacy,
          ...cellValues
        ]);
      }

      // Step 4: Download
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(schema.title || "formrus-responses").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const decryptFailures = isPrivate ? fetchedBlobs.filter((_, i) => {
        const item = fetchedBlobs[i]!;
        return item.parsed.privacy === "private" && !decryptedMap.has(i);
      }).length : 0;

      const parts: string[] = [];
      parts.push(`Exported ${rows.length} response(s)`);
      if (isPrivate && decryptFailures > 0) parts.push(`${decryptFailures} failed to decrypt`);
      if (fetchErrors.length > 0) parts.push(`${fetchErrors.length} failed to fetch`);
      setAdminMsg(parts.join(", ") + ".");
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setAdminBusy(false);
    }
  }

  async function cloneForm() {
    if (!schema) return;
    try {
      sessionStorage.setItem("formrus_clone", JSON.stringify(schema));
      navigate("/builder?clone=1");
    } catch {
      setError("Failed to prepare form clone.");
    }
  }

  const connected = account?.address?.toLowerCase() ?? "";
  const isCreator = Boolean(connected && form?.creator && connected === form.creator.toLowerCase());
  const isAdminWallet = Boolean(connected && form?.admins.some((wallet) => wallet.toLowerCase() === connected));
  const isViewerWallet = Boolean(connected && form?.viewers.some((wallet) => wallet.toLowerCase() === connected));
  const canViewDashboard = isCreator || isAdminWallet || isViewerWallet;
  const canDecrypt = isCreator || isAdminWallet;
  const canAdmin = isCreator || isAdminWallet;
  const canManageRoles = isCreator;
  const uniqueSubmitters = new Set(responses.map((response) => response.submitter.toLowerCase()).filter(Boolean)).size;
  const latestResponse = responses[0]?.createdAtMs;
  const publicLink = formId ? `${window.location.origin}/view/${formId}` : "";
  const responseModalOpen = Boolean(selected) || loadingResponse;
  const getTarget = (...refs: React.RefObject<HTMLElement | null>[]) => {
    for (const ref of refs) {
      if (ref.current && (ref.current.offsetWidth > 0 || ref.current.offsetHeight > 0)) return ref.current;
    }
    return null;
  };

  const guideSteps = [
    {
      title: "Primary Actions",
      body: "This stack is the fastest path for refresh, clone, public form preview, and form settings.",
      target: getTarget(actionsMobileRef, actionsRef),
      placement: "left" as GuidePlacement,
    },
    {
      title: "Form Settings",
      body: "Open the settings modal here to manage roles, pool, form controls, and danger actions.",
      target: getTarget(settingsButtonMobileRef, settingsButtonRef),
      placement: "left" as GuidePlacement,
    },
    {
      title: "Submission Queue",
      body: "This is the operational response list. Open any response for detail and decryption where permitted.",
      target: queueRef.current,
      placement: "right" as GuidePlacement,
    },
    {
      title: "Distribution Links",
      body: "Keep sharing and embedding actions here so they stay separate from admin controls.",
      target: linksRef.current,
      placement: "left" as GuidePlacement,
    },
  ];

  const metrics = [
    { label: "Responses", value: String(responses.length), icon: Send, color: "#00FFFF" },
    { label: "Submitters", value: String(uniqueSubmitters), icon: Users, color: "#FF00FF" },
    { label: "Reward", value: form ? `${mistToSui(form.rewardAmount)} SUI` : "—", icon: ShieldCheck, color: "#39FF14" },
    { label: "Pool", value: remainingPoolMist ? `${mistToSui(remainingPoolMist)} SUI` : "—", icon: Database, color: "#FFFF00" },
  ];

  const showAccessGate = accessState === "needs_wallet" || accessState === "forbidden";

  function closeGuide(remember: boolean) {
    if (remember) {
      try {
        localStorage.setItem(MANAGE_GUIDE_DISMISSED_KEY, "1");
      } catch {
        // Ignore storage failures
      }
    }
    setShowGuide(false);
    setGuideStep(0);
    setGuideDismissForever(false);
  }

  return (
    <div className="min-h-screen flex flex-col dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      <TopNav />

      <main className="flex-1 pt-24 pb-12 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto w-full overflow-x-hidden">
        {showAccessGate ? (
          <section className="max-w-4xl mx-auto border-[3px] border-retro-border overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}>
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <div className="relative p-6 md:p-8 border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-retro-border" style={{ background: "linear-gradient(180deg, rgba(0,255,255,0.12) 0%, transparent 100%)" }}>
                <div className="inline-flex items-center gap-2 border-[2px] border-retro-border px-3 py-1.5 mb-4 font-mono text-[10px] uppercase font-bold tracking-[0.16em]" style={{ background: accessState === "forbidden" ? "#FF69B4" : "#00FFFF", color: "#000" }}>
                  {accessState === "forbidden" ? "Restricted" : "Wallet Required"}
                </div>
                <IllustrationStage
                  src={accessState === "forbidden" ? notFoundIllustration : questionIllustration}
                  alt={accessState === "forbidden" ? "No team access" : "Connect wallet"}
                  label={accessState === "forbidden" ? "Team Locked" : "Team Wallet"}
                  tone={accessState === "forbidden" ? "pink" : "cyan"}
                  imageMaxWidth={280}
                  minHeightClassName="min-h-[280px]"
                />
              </div>

              <div className="p-6 md:p-8">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center border-[3px] border-retro-border px-3 py-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                    style={{ background: "#00FFFF", color: "#000", boxShadow: "4px 4px 0px var(--shadow-color)" }}
                    aria-label="Back to dashboard"
                  >
                    <span className="font-mono font-bold text-xl md:text-2xl uppercase leading-none">&lt;</span>
                  </Link>
                  <div className="inline-flex items-center border-[3px] border-retro-border px-4 py-2" style={{ background: "#00FFFF", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                    <h1 className="font-mono font-bold text-xl md:text-2xl uppercase tracking-tight leading-none" style={{ color: "#000" }}>
                      Team Access
                    </h1>
                  </div>
                </div>

                <p className="font-mono text-xs md:text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                  {accessState === "needs_wallet"
                    ? "Connect a wallet first. This manage page only opens for creator, admin, or viewer wallets on the form team."
                    : "This wallet is not on the form team. Only creator, admin, or viewer wallets can open this dashboard route."}
                </p>

                <p className="font-mono text-[11px] mb-6" style={{ color: "var(--text-muted)" }}>
                  Public form links remain shareable, but this dashboard route is reserved for the actual team behind the form.
                </p>

                <div className="flex items-center gap-3 flex-wrap">
                  {accessState === "needs_wallet" ? <FormrusConnectButton /> : null}
                  <Link to="/dashboard" className="retro-button text-xs">
                    <Users size={14} />
                    Back to Dashboard
                  </Link>
                  <a href={`/view/${formId}`} target="_blank" rel="noopener" className="retro-button-neon text-xs" style={{ backgroundColor: "#39FF14", color: "#000" }}>
                    <ArrowUpRight size={14} />
                    Open Public Form
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!showAccessGate ? (
          <>
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center border-[3px] border-retro-border px-3 py-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                style={{ background: "#00FFFF", color: "#000", boxShadow: "4px 4px 0px var(--shadow-color)" }}
                aria-label="Back to dashboard"
              >
                <span className="font-mono font-bold text-xl md:text-2xl uppercase leading-none">&lt;</span>
              </Link>
              <div className="inline-flex items-center border-[3px] border-retro-border px-4 py-2" style={{ background: "#00FFFF", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <h1 className="font-mono font-bold text-xl md:text-2xl uppercase tracking-tight leading-none" style={{ color: "#000" }}>
                  {schema?.title ?? "Form Detail"}
                </h1>
              </div>
            </div>
            <p className="font-mono text-xs max-w-2xl" style={{ color: "var(--text-secondary)" }}>
              {schema?.description || "Team response console for this Formrus form."}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border-[2px] border-retro-border" style={{ background: form?.actionType === 1 ? "var(--neon-lime)" : "var(--bg-secondary)", color: form?.actionType === 1 ? "#000" : "var(--text-muted)" }}>
                        {form?.actionType === 1 ? "reward" : "basic"}
                      </span>
                      {form?.isLegacy ? (
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border-[2px] border-retro-border" style={{ background: "#FF69B4", color: "#000" }}>
                          legacy
                        </span>
                      ) : null}
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border-[2px] border-retro-border" style={{ background: formActive === false ? "#FF69B4" : "var(--neon-lime)", color: "#000" }}>
                        {formActive === false ? "paused" : "active"}
                      </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                {maxPerAddress}/wallet · {maxTotal ? `${maxTotal} max` : "∞"}
              </span>
              {schema?.handler?.type === "custom" ? (
                <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border-[2px] border-retro-border" style={{ background: "#FF00FF", color: "#000" }}>
                  custom handler
                </span>
              ) : null}
              <span className="font-mono text-[10px] break-all" style={{ color: "var(--text-muted)" }}>
                {formId}
              </span>
            </div>
          </div>
          <div ref={actionsRef} className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap items-start gap-2">
              <button onClick={() => void loadFormPage()} disabled={loading} className="retro-button text-[10px] sm:text-xs disabled:opacity-50">
                <RefreshCw size={16} />
                Refresh
              </button>
              <button onClick={() => void cloneForm()} disabled={!schema} className="retro-button text-[10px] sm:text-xs disabled:opacity-50">
                <Copy size={16} />
                Clone
              </button>
              <div className="flex w-full sm:w-auto flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setFormPreviewOpen(true)}
                  className="retro-button-neon text-[10px] sm:text-xs justify-center sm:min-w-[11rem]"
                  style={{ backgroundColor: "#39FF14", color: "#000" }}
                >
                  <ArrowUpRight size={16} />
                  Open Form
                </button>
                {canAdmin ? (
                  <button
                    ref={settingsButtonRef}
                    type="button"
                    onClick={() => setFormSettingsOpen(true)}
                    className="retro-button text-[10px] sm:text-xs justify-center sm:min-w-[11rem]"
                  >
                    <Settings2 size={16} />
                    Form Settings
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div ref={actionsMobileRef} className="xl:hidden grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setFormPreviewOpen(true)}
            className="retro-button-neon text-[10px] justify-center"
            style={{ backgroundColor: "#39FF14", color: "#000" }}
          >
            <ArrowUpRight size={14} />
            Open Form
          </button>
          {canAdmin ? (
            <button
              ref={settingsButtonMobileRef}
              type="button"
              onClick={() => setFormSettingsOpen(true)}
              className="retro-button text-[10px] justify-center"
              title="Open admin form settings"
            >
              <Settings2 size={14} />
              Admin Settings
            </button>
          ) : null}
          <a
            href={`/embed/${formId}`}
            target="_blank"
            rel="noopener"
            className="retro-button text-[10px] justify-center"
          >
            <Send size={14} />
            Preview Embed
          </a>
        </div>

        {/* ── Status banners ──────────────────────────────────── */}
        {error ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline hover:text-neon-lime">dismiss</button>
          </div>
        ) : null}

        {adminMsg ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs" style={{ background: "var(--bg-card)", color: "var(--neon-lime)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            {adminMsg}
            <button onClick={() => setAdminMsg(null)} className="ml-2 underline hover:text-neon-pink">dismiss</button>
          </div>
        ) : null}

        {canViewDashboard && !canDecrypt && form ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            This wallet has viewer access. Private response decryption and form controls still require a creator or admin wallet.
          </div>
        ) : null}

        {formActive === false ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs flex items-center gap-2" style={{ background: "var(--bg-card)", color: "#FFFF00", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            <Pause size={14} /> This form is paused. No new submissions accepted.
          </div>
        ) : null}
        {schemaBlobStatus === "missing" ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs flex items-center gap-2" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            <FileText size={14} />
            Form schema blob is unavailable. Public form may fail to load until renewed.
          </div>
        ) : null}

        {/* ── Metrics ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="border-[3px] border-retro-border p-4" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <div className="w-9 h-9 flex items-center justify-center border-[3px] border-retro-border mb-3" style={{ backgroundColor: metric.color, boxShadow: "2px 2px 0px var(--shadow-color)" }}>
                  <Icon size={16} color="#000" />
                </div>
                <div className="font-mono font-bold text-lg truncate" style={{ color: "var(--text)" }}>{metric.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>{metric.label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid 2xl:grid-cols-[minmax(0,1fr)_24rem] gap-4 md:gap-6">
          <section className="space-y-4">
            <div ref={queueRef} className="border-[3px] border-retro-border p-4 md:p-5" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-mono font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text)" }}>Submission Queue</h2>
                  <p className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Open any record for a dedicated detail view. Private answers decrypt in a focused modal instead of inline page state.
                  </p>
                </div>
                {responses.length > 0 ? (
                  <button
                    onClick={() => void exportResponsesCsv()}
                    disabled={adminBusy || (schema?.responsePrivacy === "private" && !canDecrypt)}
                    className="retro-button text-[10px] disabled:opacity-50"
                    title={schema?.responsePrivacy === "private" && !canDecrypt ? "Connect creator or admin wallet to decrypt & export" : undefined}
                  >
                    <Download size={12} />
                    {schema?.responsePrivacy === "private" ? "Decrypt CSV" : "Export CSV"}
                  </button>
                ) : null}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border-[2px] border-retro-border p-3 animate-pulse" style={{ background: "var(--bg-secondary)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 border-[2px] border-retro-border" style={{ background: "var(--code-bg)" }} />
                        <div className="flex-1">
                          <div className="h-3 w-32 mb-1.5" style={{ background: "var(--code-bg)" }} />
                          <div className="h-2.5 w-48" style={{ background: "var(--code-bg)" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!loading && responses.length === 0 ? (
                <div className="border-[2px] border-retro-border p-6 text-center font-mono text-[10px]" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                  No responses recorded yet.
                </div>
              ) : null}

              <div className="space-y-2">
                {responses.map((response, index) => (
                  <button
                    key={`${response.txDigest}-${response.responseBlobId}`}
                    onClick={() => void openResponse(response)}
                    className="w-full text-left border-[2px] border-retro-border p-3 hover:border-neon-lime transition-colors"
                    style={{ background: selected?.event.responseBlobId === response.responseBlobId ? "var(--code-bg)" : "var(--bg-secondary)" }}
                  >
                    <div className="grid sm:grid-cols-[3rem_minmax(0,1fr)] xl:grid-cols-[3rem_minmax(0,1fr)_11rem_11rem] gap-3 items-center">
                      <div className="w-10 h-10 border-[2px] border-retro-border flex items-center justify-center font-mono text-[10px] font-bold" style={{ background: "#39FF14", color: "#000" }}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate" style={{ color: "var(--text)" }}>{shorten(response.responseBlobId, 16, 10)}</div>
                        <div className="font-mono text-[10px] break-all md:truncate" style={{ color: "var(--text-muted)" }}>Tx {response.txDigest}</div>
                      </div>
                      <div className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        <div style={{ color: "var(--text-muted)" }}>Submitter</div>
                        <div className="mt-1">{shorten(response.submitter, 12, 8)}</div>
                      </div>
                      <div className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        <div style={{ color: "var(--text-muted)" }}>Received</div>
                        <div className="mt-1">{formatTime(response.createdAtMs)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0 border-[3px] border-retro-border p-4 overflow-x-hidden" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <h2 className="font-mono font-bold text-xs uppercase mb-3" style={{ color: "var(--text)" }}>Distribution</h2>
                {responses.length > 0 ? <ResponseChart responses={responses} /> : (
                  <div className="border-[2px] border-dashed border-retro-border p-6 text-center font-mono text-[10px]" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                    Analytics appear here after submissions arrive.
                  </div>
                )}
              </div>

              <div ref={linksRef} className="min-w-0 border-[3px] border-retro-border p-4 space-y-4 overflow-x-hidden" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <div>
                  <h2 className="font-mono font-bold text-xs uppercase mb-2" style={{ color: "var(--text)" }}>Distribution Links</h2>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Keep public distribution links separate from response review and administration.
                  </p>
                </div>
                <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                  <div className="font-mono text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Public Form</div>
                  <div className="font-mono text-[10px] break-all" style={{ color: "var(--text)" }}>{publicLink}</div>
                </div>
                <CopyButton text={publicLink} label="Copy Public Link" />
                <CopyButton
                  text={`<div id="formrus-${formId}"></div>\n<script src="${window.location.origin}/widget.js" data-form-id="${formId}" data-target="#formrus-${formId}"></script>`}
                  label="Copy Script Embed"
                />
                <a href={`/embed/${formId}`} target="_blank" rel="noopener" className="retro-button justify-center text-[10px]">
                  <ArrowUpRight size={12} />
                  Preview Embed
                </a>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="border-[3px] border-retro-border p-4" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
              <h2 className="font-mono font-bold text-xs uppercase mb-3" style={{ color: "var(--text)" }}>Form Profile</h2>
              <div className="space-y-3">
                <InfoTile label="Creator" value={shorten(form?.creator ?? "—", 14, 8)} />
                <InfoTile label="Latest Response" value={latestResponse ? formatTime(latestResponse) : "None"} />
                <InfoTile label="Privacy" value={schema?.responsePrivacy ?? "private"} />
                <InfoTile label="Object ID" value={formId} />
                <InfoTile label="Schema Blob" value={form?.schemaBlobId ?? "—"} />
              </div>
            </div>

          </aside>
        </div>

        {responseModalOpen ? (
          <ResponseDetailModal
            selected={selected}
            schema={schema}
            canDecrypt={canDecrypt}
            decrypting={decrypting}
            loading={loadingResponse}
            onClose={() => {
              setSelected(null);
              setLoadingResponse(false);
            }}
            onDecrypt={() => void decryptSelectedResponse()}
          />
        ) : null}
        {formPreviewOpen ? (
          <FormPreviewModal
            formId={formId}
            onClose={() => setFormPreviewOpen(false)}
          />
        ) : null}
        {canAdmin && formSettingsOpen ? (
          <FormSettingsModal
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            adminBusy={adminBusy}
            form={form}
            formActive={formActive}
            remainingPoolMist={remainingPoolMist}
            isCreator={isCreator}
            canManageRoles={canManageRoles}
            responsesCount={responses.length}
            maxPerAddress={maxPerAddress}
            maxTotal={maxTotal}
            onClose={() => setFormSettingsOpen(false)}
            onOpenGuide={() => setShowGuide(true)}
            onSetRole={adminSetRole}
            onTopUp={adminTopUp}
            onToggleActive={adminSetActive}
            onUpdateSchema={adminUpdateSchema}
            onUpdateReward={adminUpdateReward}
            onSetMaxSubmissions={adminSetMaxSubmissions}
            onDrain={adminDrainAndDeactivate}
            onRenewSchema={adminRenewSchemaBlob}
            schemaBlobMissing={schemaBlobStatus === "missing"}
            schemaRenewBusy={schemaRenewBusy}
            schemaLoaded={Boolean(schema)}
            onExtendExpiry={adminExtendExpiry}
          />
        ) : null}
        {showGuide ? (
          <ManageGuideOverlay
            steps={guideSteps}
            stepIndex={guideStep}
            dismissForever={guideDismissForever}
            onDismissForeverChange={() => setGuideDismissForever((prev) => !prev)}
            onClose={() => closeGuide(guideDismissForever)}
            onNext={() => {
              if (guideStep >= guideSteps.length - 1) closeGuide(guideDismissForever);
              else setGuideStep((prev) => prev + 1);
            }}
            onBack={guideStep > 0 ? () => setGuideStep((prev) => prev - 1) : undefined}
          />
        ) : null}
          </>
        ) : null}
        <SiteFooter />
      </main>
    </div>
  );
}

interface ManageGuideStep {
  title: string;
  body: string;
  target: HTMLElement | null;
  placement: GuidePlacement;
}

function ManageGuideOverlay({
  steps,
  stepIndex,
  dismissForever,
  onDismissForeverChange,
  onClose,
  onNext,
  onBack,
}: {
  steps: ManageGuideStep[];
  stepIndex: number;
  dismissForever: boolean;
  onDismissForeverChange: () => void;
  onClose: () => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const step = steps[stepIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function updateRect() {
      if (step.target) {
        step.target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
      setTargetRect(step.target ? step.target.getBoundingClientRect() : null);
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [step]);

  const cardStyle = computeGuideCardStyle(targetRect, step.placement);

  return (
    <div className="fixed inset-0 z-[250]">
      <div className="absolute inset-0" style={{ background: "rgba(17,17,17,0.72)" }} />
      {targetRect ? (
        <div
          className="pointer-events-none fixed border-[3px] border-retro-border"
          style={{
            top: Math.max(targetRect.top - 8, 8),
            left: Math.max(targetRect.left - 8, 8),
            width: Math.min(targetRect.width + 16, window.innerWidth - 16),
            height: Math.min(targetRect.height + 16, window.innerHeight - 16),
            boxShadow: "0 0 0 9999px rgba(17,17,17,0.72)",
          }}
        />
      ) : null}
      <div
        className="fixed w-[min(22rem,calc(100vw-2rem))] border-[3px] border-retro-border p-4 md:p-5"
        style={{ ...cardStyle, background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: "var(--text-muted)" }}>
              Manage Guide {stepIndex + 1}/{steps.length}
            </div>
            <h3 className="font-mono font-bold text-sm uppercase" style={{ color: "var(--text)" }}>
              {step.title}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", boxShadow: "1px 1px 0px var(--shadow-color)" }}>
            <X size={12} />
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
          {step.body}
        </p>
        <button
          type="button"
          onClick={onDismissForeverChange}
          className="w-full flex items-center gap-2 px-2.5 py-2 border-[2px] border-retro-border mb-4 text-left"
          style={{ background: dismissForever ? "var(--code-bg)" : "var(--bg-secondary)", boxShadow: "1px 1px 0px var(--shadow-color)" }}
        >
          <span className="w-3.5 h-3.5 border-[2px] border-retro-border flex items-center justify-center flex-shrink-0" style={{ background: dismissForever ? "var(--neon-lime)" : "transparent" }}>
            {dismissForever ? <span className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
          </span>
          <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>
            Do Not Show Again
          </span>
        </button>
        <div className="flex items-center justify-between gap-2">
          {onBack ? <button type="button" onClick={onBack} className="retro-button text-[10px]">Back</button> : <button type="button" onClick={onClose} className="retro-button text-[10px]">Skip</button>}
          <button type="button" onClick={onNext} className="retro-button-neon text-[10px]" style={{ backgroundColor: "#39FF14", color: "#000" }}>
            {stepIndex === steps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function computeGuideCardStyle(targetRect: DOMRect | null, placement: GuidePlacement): CSSProperties {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
  const cardWidth = Math.min(352, viewportWidth - 32);
  const cardHeight = 260;
  const gutter = 20;

  if (!targetRect || placement === "center") {
    return {
      top: Math.max((viewportHeight - cardHeight) / 2, 16),
      left: Math.max((viewportWidth - cardWidth) / 2, 16),
    };
  }

  const clampLeft = (value: number) => Math.min(Math.max(value, 16), viewportWidth - cardWidth - 16);
  const clampTop = (value: number) => Math.min(Math.max(value, 16), viewportHeight - cardHeight - 16);

  if (placement === "right") return { top: clampTop(targetRect.top), left: clampLeft(targetRect.right + gutter) };
  if (placement === "left") return { top: clampTop(targetRect.top), left: clampLeft(targetRect.left - cardWidth - gutter) };
  if (placement === "top") return { top: clampTop(targetRect.top - cardHeight - gutter), left: clampLeft(targetRect.left) };
  return { top: clampTop(targetRect.bottom + gutter), left: clampLeft(targetRect.left) };
}

function FormPreviewModal({ formId, onClose }: { formId: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-6xl h-[85vh] border-[3px] border-retro-border overflow-hidden"
        style={{ background: "var(--bg-card)", boxShadow: "8px 8px 0px var(--shadow-color)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Public form preview"
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 border-b-[3px] border-retro-border"
          style={{ background: "var(--nav-bg)" }}
        >
          <div>
            <h2 className="font-mono font-bold text-xs uppercase" style={{ color: "var(--text)" }}>Open Form</h2>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              Public form preview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/view/${formId}`}
              target="_blank"
              rel="noopener"
              className="retro-button text-[10px]"
            >
              <ArrowUpRight size={12} />
              New Tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border"
              style={{ boxShadow: "2px 2px 0px var(--shadow-color)" }}
              aria-label="Close form preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <iframe
          src={`/view/${formId}`}
          title="Public form preview"
          className="w-full h-[calc(85vh-61px)] bg-white"
        />
      </div>
    </div>
  );
}

function FormSettingsModal({
  adminTab,
  setAdminTab,
  adminBusy,
  form,
  formActive,
  remainingPoolMist,
  isCreator,
  canManageRoles,
  responsesCount,
  maxPerAddress,
  maxTotal,
  onClose,
  onOpenGuide,
  onSetRole,
  onTopUp,
  onToggleActive,
  onUpdateSchema,
  onUpdateReward,
  onSetMaxSubmissions,
  onDrain,
  onRenewSchema,
  schemaBlobMissing,
  schemaRenewBusy,
  schemaLoaded,
  onExtendExpiry,
}: {
  adminTab: "roles" | "pool" | "form" | "danger";
  setAdminTab: Dispatch<SetStateAction<"roles" | "pool" | "form" | "danger">>;
  adminBusy: boolean;
  form: FormEventRow | null;
  formActive: boolean | null;
  remainingPoolMist: string | null;
  isCreator: boolean;
  canManageRoles: boolean;
  responsesCount: number;
  maxPerAddress: number;
  maxTotal: number;
  onClose: () => void;
  onOpenGuide: () => void;
  onSetRole: (role: "admin" | "viewer", wallet: string, enabled: boolean) => Promise<void>;
  onTopUp: (suiAmount: string) => Promise<void>;
  onToggleActive: (active: boolean) => Promise<void>;
  onUpdateSchema: (blobId: string) => Promise<void>;
  onUpdateReward: (suiAmount: string) => Promise<void>;
  onSetMaxSubmissions: (nextMaxPerAddress: number, nextMaxTotal: number) => Promise<void>;
  onDrain: () => Promise<void>;
  onRenewSchema: (epochs: number) => Promise<void>;
  schemaBlobMissing: boolean;
  schemaRenewBusy: boolean;
  schemaLoaded: boolean;
  onExtendExpiry: (newExpiresAtMs: number) => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-auto border-[3px] border-retro-border"
        style={{ background: "var(--bg-card)", boxShadow: "8px 8px 0px var(--shadow-color)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Form settings"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-[2px] border-retro-border" style={{ background: "var(--nav-bg)", borderColor: "var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <Settings2 size={14} style={{ color: "var(--neon-lime)" }} />
            <h2 className="font-mono font-bold text-xs uppercase" style={{ color: "var(--text)" }}>Form Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { onClose(); setTimeout(onOpenGuide, 50); }} className="retro-button text-[10px]">
              <Eye size={12} />
              Guide
            </button>
            <button onClick={onClose} className="retro-button text-xs">
              <X size={14} />
              Close
            </button>
          </div>
        </div>

        <div className="flex border-b-[2px] border-retro-border overflow-x-auto" style={{ borderColor: "var(--border-light)" }}>
          {([["roles", "Roles"], ["pool", "Pool"], ["form", "Form"], ["danger", "Danger"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAdminTab(key)}
              className="flex-1 py-2 font-mono text-[10px] uppercase font-bold border-r-[1px] border-retro-border last:border-r-0 transition-colors whitespace-nowrap"
              style={{
                background: adminTab === key ? "var(--neon-lime)" : "transparent",
                color: adminTab === key ? "#000" : "var(--text-muted)"
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {adminBusy ? (
            <div className="font-mono text-[10px] mb-3 flex items-center gap-2" style={{ color: "var(--neon-cyan)" }}>
              <LoadingSpinner size={12} label="Processing transaction..." />
            </div>
          ) : null}

          {adminTab === "roles" ? <RolesPanel form={form} canManage={canManageRoles} busy={adminBusy} onSetRole={onSetRole} /> : null}
          {adminTab === "pool" ? <PoolPanel remainingMist={remainingPoolMist} busy={adminBusy} canTopUp={isCreator} onTopUp={onTopUp} /> : null}
          {adminTab === "form" ? (
            <FormControlsPanel
              form={form}
              formActive={formActive}
              busy={adminBusy}
              onToggleActive={onToggleActive}
              onUpdateSchema={onUpdateSchema}
              onUpdateReward={onUpdateReward}
              onSetMaxSubmissions={onSetMaxSubmissions}
              maxPerAddress={maxPerAddress}
              maxTotal={maxTotal}
              onRenewSchema={onRenewSchema}
              schemaBlobMissing={schemaBlobMissing}
              schemaRenewBusy={schemaRenewBusy}
              schemaLoaded={schemaLoaded}
              onExtendExpiry={onExtendExpiry}
            />
          ) : null}
          {adminTab === "danger" ? <DangerPanel canManage={canManageRoles} busy={adminBusy} responseCount={responsesCount} onDrain={onDrain} /> : null}
        </div>
      </div>
    </div>
  );
}

// ── Admin Sub-panels ──────────────────────────────────────────────

function RolesPanel({ form, canManage, busy, onSetRole }: {
  form: FormEventRow | null;
  canManage: boolean;
  busy: boolean;
  onSetRole: (kind: "admin" | "viewer", wallet: string, enabled: boolean) => Promise<void>;
}) {
  const [newAdmin, setNewAdmin] = useState("");
  const [newViewer, setNewViewer] = useState("");

  if (!form) return null;

  return (
    <div className="space-y-4">
      {/* Admins */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-2" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            Admins ({form.admins.length})
            <Tooltip text="Admins can decrypt private responses, pause/resume the form, and update settings. Only the creator can add or remove admins and top up the pool." />
          </span>
        </span>
        <div className="space-y-1.5 mb-2">
          <div className="flex items-center gap-2 border-[2px] border-retro-border px-2 py-1.5" style={{ background: "var(--code-bg)" }}>
            <Wallet size={12} style={{ color: "var(--neon-lime)" }} />
            <span className="font-mono text-[10px] truncate flex-1" style={{ color: "var(--text)" }}>{shorten(form.creator, 14, 8)}</span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-retro-border" style={{ background: "#39FF14", color: "#000" }}>creator</span>
          </div>
          {form.admins.map((wallet) => (
            <div key={wallet} className="flex items-center gap-2 border-[2px] border-retro-border px-2 py-1.5" style={{ background: "var(--bg-secondary)" }}>
              <Wallet size={12} style={{ color: "var(--text-muted)" }} />
              <span className="font-mono text-[10px] truncate flex-1" style={{ color: "var(--text)" }}>{shorten(wallet, 14, 8)}</span>
              {canManage ? (
                <button onClick={() => void onSetRole("admin", wallet, false)} disabled={busy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                  <Minus size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <input
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              placeholder="0x..."
              className="flex-1 retro-input text-[10px]"
              style={{ padding: "6px 8px" }}
            />
            <button
              onClick={() => { if (newAdmin.trim()) { void onSetRole("admin", newAdmin.trim(), true); setNewAdmin(""); } }}
              disabled={busy || !newAdmin.trim()}
              className="retro-button text-[10px] px-2 disabled:opacity-50"
            >
              <Plus size={12} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Viewers */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-2" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            Viewers ({form.viewers.length})
            <Tooltip text="Viewers can see the dashboard, responses, and analytics but cannot decrypt private answers or change any settings." />
          </span>
        </span>
        {form.viewers.length === 0 ? (
          <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>No viewers configured.</p>
        ) : (
          <div className="space-y-1.5 mb-2">
            {form.viewers.map((wallet) => (
              <div key={wallet} className="flex items-center gap-2 border-[2px] border-retro-border px-2 py-1.5" style={{ background: "var(--bg-secondary)" }}>
                <Eye size={12} style={{ color: "var(--text-muted)" }} />
                <span className="font-mono text-[10px] truncate flex-1" style={{ color: "var(--text)" }}>{shorten(wallet, 14, 8)}</span>
                {canManage ? (
                  <button onClick={() => void onSetRole("viewer", wallet, false)} disabled={busy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                    <Minus size={12} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {canManage ? (
          <div className="flex gap-2">
            <input
              value={newViewer}
              onChange={(e) => setNewViewer(e.target.value)}
              placeholder="0x..."
              className="flex-1 retro-input text-[10px]"
              style={{ padding: "6px 8px" }}
            />
            <button
              onClick={() => { if (newViewer.trim()) { void onSetRole("viewer", newViewer.trim(), true); setNewViewer(""); } }}
              disabled={busy || !newViewer.trim()}
              className="retro-button text-[10px] px-2 disabled:opacity-50"
            >
              <Plus size={12} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PoolPanel({ remainingMist, busy, canTopUp, onTopUp }: {
  remainingMist: string | null;
  busy: boolean;
  canTopUp: boolean;
  onTopUp: (amountSui: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("0.1");
  const suiDisplay = remainingMist ? mistToSui(remainingMist) : "—";

  return (
    <div className="space-y-3">
      <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            Remaining Pool
            <Tooltip text="SUI available for reward payouts. If pool balance drops below reward amount, new submissions fail until the creator tops up." />
          </span>
        </span>
        <span className="font-mono font-bold text-lg" style={{ color: "var(--text)" }}>{suiDisplay} <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>SUI</span></span>
      </div>
      <label className="block">
        <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Top up amount (SUI)</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          className="retro-input text-[10px]"
          style={{ padding: "6px 8px" }}
        />
      </label>
      <button
        onClick={() => void onTopUp(amount)}
        disabled={busy || !canTopUp || !amount || Number(amount) <= 0}
        className="retro-button-neon w-full justify-center text-xs disabled:opacity-50"
        style={{ backgroundColor: "#39FF14", color: "#000" }}
      >
        <Wallet size={14} />
        Top Up Pool
      </button>
      {!canTopUp ? (
        <p className="font-mono text-[9px]" style={{ color: "#FFFF00" }}>
          Only the creator wallet can top up the pool.
        </p>
      ) : null}
    </div>
  );
}

function FormControlsPanel({ form, formActive, busy, onToggleActive, onUpdateSchema, onUpdateReward, onSetMaxSubmissions, maxPerAddress, maxTotal, onRenewSchema, schemaBlobMissing, schemaRenewBusy, schemaLoaded, onExtendExpiry }: {
  form: FormEventRow | null;
  formActive: boolean | null;
  busy: boolean;
  onToggleActive: (active: boolean) => Promise<void>;
  onUpdateSchema: (blobId: string) => Promise<void>;
  onUpdateReward: (rewardSui: string) => Promise<void>;
  onSetMaxSubmissions: (maxPerAddress: number, maxTotal: number) => Promise<void>;
  maxPerAddress: number;
  maxTotal: number;
  onRenewSchema: (epochs: number) => Promise<void>;
  schemaBlobMissing: boolean;
  schemaRenewBusy: boolean;
  schemaLoaded: boolean;
  onExtendExpiry: (newExpiresAtMs: number) => Promise<void>;
}) {
  const [newSchema, setNewSchema] = useState("");
  const [newReward, setNewReward] = useState("");
  const [newMaxPer, setNewMaxPer] = useState("");
  const [newMaxTotal, setNewMaxTotal] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [renewEpochs, setRenewEpochs] = useState("5");

  return (
    <div className="space-y-4">
      {/* Pause / Resume */}
      <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
        <button
          onClick={() => void onToggleActive(!formActive)}
          disabled={busy || formActive === null}
          className="retro-button w-full justify-center text-xs disabled:opacity-50"
        >
          {formActive ? <><Pause size={14} /> Pause Form</> : <><Play size={14} /> Resume Form</>}
        </button>
      </div>

      {/* Update schema */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
          Update Schema Blob ID
        </span>
        <p className="font-mono text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
          Schema blob storage only. This does not change reward, pool, or submission settings.
        </p>
        <p className="font-mono text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
          Current: {form ? shorten(form.schemaBlobId, 16, 10) : "..."}
        </p>
        <div className="flex gap-2">
          <input
            value={newSchema}
            onChange={(e) => setNewSchema(e.target.value)}
            placeholder="new blob id..."
            className="flex-1 retro-input text-[10px]"
            style={{ padding: "6px 8px" }}
          />
          <button
            onClick={() => void onUpdateSchema(newSchema)}
            disabled={busy || !newSchema.trim()}
            className="retro-button text-[10px] px-2 disabled:opacity-50"
          >
            Update
          </button>
        </div>
      </div>

      {/* Extend expiry */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
          Extend Expiry
        </span>
        <p className="font-mono text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
          Current: {form?.expiresAtMs && Number(form.expiresAtMs) > 0 ? formatTime(form.expiresAtMs) : "No expiry"}
        </p>
        <div className="flex gap-2">
          <input
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            type="number"
            min="1"
            placeholder="30"
            className="flex-1 retro-input text-[10px]"
            style={{ padding: "6px 8px" }}
          />
          <button
            onClick={() => {
              const days = Number(expiryDays);
              if (!Number.isFinite(days) || days < 1) return;
              const targetMs = Date.now() + days * 24 * 60 * 60 * 1000;
              void onExtendExpiry(targetMs);
            }}
            disabled={busy || !expiryDays || Number(expiryDays) < 1}
            className="retro-button text-[10px] px-2 disabled:opacity-50"
          >
            Extend
          </button>
        </div>
      </div>

      {/* Update reward */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
          Update Reward (SUI)
        </span>
        <p className="font-mono text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
          Current: {form ? mistToSui(form.rewardAmount) : "..."} SUI
        </p>
        {Number(form?.rewardAmount ?? "0") > 0 ? (
          <p className="font-mono text-[9px] mb-2" style={{ color: "#FFFF00" }}>
            ⚠ Reward is locked after first submission. Changes will be rejected by the contract if any submissions exist.
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={newReward}
            onChange={(e) => setNewReward(e.target.value)}
            type="number"
            step="0.001"
            min="0"
            placeholder="0.05"
            className="flex-1 retro-input text-[10px]"
            style={{ padding: "6px 8px" }}
          />
          <button
            onClick={() => void onUpdateReward(newReward)}
            disabled={busy || !newReward}
            className="retro-button text-[10px] px-2 disabled:opacity-50"
          >
            Update
          </button>
        </div>
        <span className="font-mono text-[10px] uppercase font-bold block mt-3 mb-1.5" style={{ color: "var(--text-muted)" }}>
          Renew Schema Blob
        </span>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 mt-1">
          <input
            value={renewEpochs}
            onChange={(e) => setRenewEpochs(e.target.value)}
            type="number"
            min="1"
            step="1"
            placeholder="epochs"
            className="retro-input text-[10px]"
            style={{ padding: "6px 8px" }}
            aria-label="Schema renew epochs"
          />
          <button
            onClick={() => {
              const parsedEpochs = Number(renewEpochs);
              if (!Number.isInteger(parsedEpochs) || parsedEpochs < 1) return;
              void onRenewSchema(parsedEpochs);
            }}
            disabled={busy || schemaRenewBusy || !schemaLoaded || !Number.isInteger(Number(renewEpochs)) || Number(renewEpochs) < 1}
            className="retro-button text-[10px] px-2 disabled:opacity-50"
            title={!schemaLoaded ? "Schema JSON is not loaded in this session, so renew cannot re-upload it." : undefined}
          >
            {schemaRenewBusy ? "Renewing..." : "Renew"}
          </button>
        </div>
        <p className="font-mono text-[9px] mt-2" style={{ color: "var(--text-muted)" }}>
          Renew re-uploads the current schema JSON to Walrus with the epoch value above, then updates this form's schema blob pointer.
        </p>
        {schemaBlobMissing ? (
          <p className="font-mono text-[9px] mt-2" style={{ color: "#FF69B4" }}>
            Schema blob is unavailable. Renew to upload the current schema JSON and repoint this form.
          </p>
        ) : null}
      </div>

      {/* Submission limits */}
      <div>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1.5" style={{ color: "var(--text-muted)" }}>
          Submission Limits
        </span>
        <p className="font-mono text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
          Per wallet: {maxPerAddress} · Total cap: {maxTotal || "unlimited"}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <span className="font-mono text-[9px] block mb-1" style={{ color: "var(--text-muted)" }}>Per wallet</span>
            <input
              value={newMaxPer}
              onChange={(e) => setNewMaxPer(e.target.value)}
              type="number"
              min="1"
              placeholder={String(maxPerAddress)}
              className="retro-input text-[10px]"
              style={{ padding: "6px 8px" }}
            />
          </div>
          <div>
            <span className="font-mono text-[9px] block mb-1" style={{ color: "var(--text-muted)" }}>Total cap (0=∞)</span>
            <input
              value={newMaxTotal}
              onChange={(e) => setNewMaxTotal(e.target.value)}
              type="number"
              min="0"
              placeholder={String(maxTotal)}
              className="retro-input text-[10px]"
              style={{ padding: "6px 8px" }}
            />
          </div>
        </div>
        <button
          onClick={() => {
            const parsedMaxPer = parseInt(newMaxPer || String(maxPerAddress), 10);
            const parsedMaxTotal = parseInt(newMaxTotal || String(maxTotal), 10);
            void onSetMaxSubmissions(
              Number.isFinite(parsedMaxPer) && parsedMaxPer > 0 ? parsedMaxPer : 1,
              Number.isFinite(parsedMaxTotal) && parsedMaxTotal >= 0 ? parsedMaxTotal : 0
            );
          }}
          disabled={busy || (!newMaxPer && !newMaxTotal)}
          className="retro-button w-full text-[10px] justify-center disabled:opacity-50"
        >
          Update Limits
        </button>
      </div>
    </div>
  );
}

function DangerPanel({ canManage, busy, responseCount, onDrain }: {
  canManage: boolean;
  busy: boolean;
  responseCount: number;
  onDrain: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!canManage) {
    return (
      <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
        Only the form creator can access destructive actions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)", borderColor: "#FF69B4" }}>
        <span className="font-mono text-[10px] uppercase font-bold block mb-1" style={{ color: "#FF69B4" }}>Drain Pool & Deactivate</span>
        <p className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
          Withdraws all SUI from the reward pool and permanently deactivates the form. Submissions already recorded are preserved. The form cannot be reactivated after draining.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="retro-button w-full justify-center text-xs disabled:opacity-50"
            style={{ borderColor: "#FF69B4" }}
          >
            <Trash2 size={14} />
            Drain & Deactivate
          </button>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-bold" style={{ color: "#FF69B4" }}>
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void onDrain().then(() => setConfirming(false))}
                disabled={busy}
                className="flex-1 retro-button justify-center text-xs"
                style={{ borderColor: "#FF69B4", color: "#FF69B4" }}
              >
                Confirm Drain
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="retro-button text-xs px-3"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
      <div className="font-mono text-[10px] uppercase font-bold mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-mono text-xs break-all" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={() => void handleCopy()}
      className="retro-button w-full justify-center text-[10px]"
      style={copied ? { background: "var(--neon-lime)", color: "#000" } : {}}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function ResponseDetailModal({
  selected,
  schema,
  canDecrypt,
  decrypting,
  loading,
  onClose,
  onDecrypt,
}: {
  selected: SelectedResponse | null;
  schema: FormDraft | null;
  canDecrypt: boolean;
  decrypting: boolean;
  loading: boolean;
  onClose: () => void;
  onDecrypt: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-auto border-[3px] border-retro-border p-4 md:p-5"
        style={{ background: "var(--bg-card)", boxShadow: "8px 8px 0px var(--shadow-color)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Response detail"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Response Detail</div>
            <h2 className="font-mono font-bold text-lg uppercase" style={{ color: "var(--text)" }}>
              {selected ? shorten(selected.event.responseBlobId, 18, 10) : "Loading"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {selected?.blob?.privacy === "private" && !selected.decoded ? (
              <button onClick={onDecrypt} disabled={decrypting || !canDecrypt || loading} className="retro-button-neon text-xs disabled:opacity-50" style={{ backgroundColor: "#FF00FF", color: "#000" }}>
                <KeyRound size={14} />
                {decrypting ? "Decrypting" : "Decrypt"}
              </button>
            ) : null}
            <button onClick={onClose} className="retro-button text-xs">
              <X size={14} />
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-[2px] border-retro-border p-3 animate-pulse" style={{ background: "var(--bg-secondary)" }}>
                  <div className="h-2.5 w-16 mb-1.5" style={{ background: "var(--code-bg)" }} />
                  <div className="h-3 w-24" style={{ background: "var(--code-bg)" }} />
                </div>
              ))}
            </div>
            <div className="border-[2px] border-retro-border p-4 animate-pulse" style={{ background: "var(--bg-secondary)" }}>
              <div className="h-3 w-full mb-2" style={{ background: "var(--code-bg)" }} />
              <div className="h-3 w-3/4" style={{ background: "var(--code-bg)" }} />
            </div>
          </div>
        ) : null}

        {selected && !loading ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <InfoTile label="Submitter" value={shorten(selected.event.submitter, 12, 8)} />
              <InfoTile label="Submitted" value={formatTime(selected.event.createdAtMs)} />
              <InfoTile label="Privacy" value={selected.blob?.privacy ?? "Raw"} />
            </div>

            {selected.blob?.privacy === "private" && !selected.decoded ? (
              <div className="border-[3px] border-retro-border p-4 flex items-start gap-3" style={{ background: "var(--bg-secondary)" }}>
                <Lock size={18} style={{ color: "var(--neon-magenta)" }} />
                <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  This response is encrypted. Decrypt with a creator or admin wallet to inspect the payload in full detail.
                </p>
              </div>
            ) : null}

            {selected.decoded ? (
              <div className="space-y-3">
                {(schema?.fields ?? []).map((field) => (
                  <div key={field.id} className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                    <div className="font-mono text-[10px] uppercase font-bold mb-1" style={{ color: "var(--text-muted)" }}>{field.label}</div>
                    <div className="font-mono text-sm break-words" style={{ color: "var(--text)" }}>{stringifyValue(selected.decoded?.[field.id])}</div>
                  </div>
                ))}
                <details>
                  <summary className="font-mono text-[10px] uppercase font-bold cursor-pointer" style={{ color: "var(--text-secondary)" }}>Raw JSON</summary>
                  <pre className="font-mono text-[10px] whitespace-pre-wrap break-words max-h-64 overflow-auto mt-2" style={{ color: "var(--text-secondary)" }}>
                    {JSON.stringify(selected.decoded, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}

            {!selected.blob && selected.raw ? (
              <pre className="font-mono text-[10px] whitespace-pre-wrap break-words max-h-96 overflow-auto" style={{ color: "var(--text-secondary)" }}>{selected.raw}</pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
