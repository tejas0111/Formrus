import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties, type Dispatch, type DragEvent, type ReactNode, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiObjectChange } from "@mysten/sui/jsonRpc";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Image,
  Italic,
  Key,
  Link2,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  Type,
  Upload,
  Video,
  Users,
  Wallet,
  X
} from "lucide-react";
import { computeFormDna, generateSaltHex32, type ActionType } from "../lib/dna";
import { formrusPackageId, formrusRegistryId, sealKeyServers, suiNetwork, walrusAggregatorUrl, walrusPublisherUrl } from "../lib/config";
import { buildRegisterFormTx } from "../lib/suiFormrus";
import { uploadFileToWalrus, uploadFormToWalrus } from "../lib/walrusAdapter";
import type { FieldOption, FieldType, FormDraft, FormField } from "../types/form";
import FormrusConnectButton from "../components/FormrusConnectButton";
import ThemeToggle from "../components/ThemeToggle";
import SiteFooter from "../components/SiteFooter";
import { safeUrl, suiToMist } from "../lib/utils";
import { Tooltip } from "../components/Tooltip";
import { useToast } from "../components/Toast";
import { translateError } from "../lib/errors";

const fieldLibrary: { type: FieldType; icon: typeof Type; label: string }[] = [
  { type: "short_text", icon: Type, label: "Short text" },
  { type: "long_text", icon: AlignLeft, label: "Long text" },
  { type: "rich_text", icon: Bold, label: "Rich text" },
  { type: "checkboxes", icon: CheckSquare, label: "Checkboxes" },
  { type: "dropdown", icon: ChevronDown, label: "Dropdown" },
  { type: "star_rating", icon: Star, label: "Star rating" },
  { type: "confirmation", icon: CheckCircle, label: "Confirmation" },
  { type: "url", icon: Link2, label: "URL" },
  { type: "file_upload", icon: Upload, label: "File upload" },
  { type: "screenshot_upload", icon: Image, label: "Screenshot upload" },
  { type: "video_upload", icon: Video, label: "Video upload" }
];

const accentColors = ["#39FF14", "#00FFFF", "#FF00FF", "#FFFF00", "#FF69B4", "#00FF88", "#FF4500", "#7B68EE"];
const deepsurgeAdminAddress = "0xc4d6ee019649edba41d5a5ed1081fe3c86afc41fea413195dd6ecdd0f6090e54";
const BUILDER_GUIDE_DISMISSED_KEY = "builder_guide_dismissed_v1";

const initialDraft: FormDraft = {
  title: "Untitled form",
  description: "Describe what you want to collect.",
  branding: {},
  responsePrivacy: "private",
  eligibility: {},
  access: { admins: [], viewers: [] },
  fields: [],
  createdAt: new Date().toISOString()
};

const feedbackTemplate: FormDraft = {
  title: "Formrus feedback form",
  description: "Share product feedback, media, and links",
  branding: {},
  responsePrivacy: "private",
  eligibility: {},
  access: { admins: [], viewers: [] },
  fields: [
    {
      id: "fld_name",
      type: "short_text",
      label: "Full Name",
      placeholder: "Enter your name",
      required: true
    },
    {
      id: "fld_role",
      type: "dropdown",
      label: "Role",
      required: true,
      options: [
        { label: "Developer", value: "developer" },
        { label: "Designer", value: "designer" },
        { label: "Community", value: "community" },
        { label: "Other", value: "other" }
      ]
    },
    {
      id: "fld_feedback",
      type: "rich_text",
      label: "Feedback",
      placeholder: "Describe the issue, request, or application details",
      required: true
    },
    {
      id: "fld_screenshot",
      type: "screenshot_upload",
      label: "Screenshot",
      helpText: "Attach a screenshot if it helps explain the feedback.",
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      maxSizeBytes: 5 * 1024 * 1024,
      required: false
    },
    {
      id: "fld_demo_video",
      type: "video_upload",
      label: "Demo Video",
      helpText: "Attach a short video walkthrough when useful.",
      acceptedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
      maxSizeBytes: 25 * 1024 * 1024,
      required: false
    }
  ],
  createdAt: new Date().toISOString()
};

const formTemplates: Record<string, FormDraft> = {
  feedback: feedbackTemplate,
  event: {
    title: "Event registration",
    description: "Collect attendee details and wallet-gated RSVPs",
    branding: {},
    responsePrivacy: "private",
    eligibility: {},
    access: { admins: [], viewers: [] },
    fields: [
      { id: "fld_name", type: "short_text", label: "Full Name", placeholder: "Enter your name", required: true },
      { id: "fld_email", type: "short_text", label: "Email", placeholder: "you@example.com", required: true },
      {
        id: "fld_ticket",
        type: "dropdown",
        label: "Ticket Type",
        required: true,
        options: [
          { label: "Builder", value: "builder" },
          { label: "Investor", value: "investor" },
          { label: "Community", value: "community" }
        ]
      }
    ],
    createdAt: new Date().toISOString()
  },
  grant: {
    title: "Grant application",
    description: "Review project applications with encrypted team responses",
    branding: {},
    responsePrivacy: "private",
    eligibility: {},
    access: { admins: [], viewers: [] },
    fields: [
      { id: "fld_project", type: "short_text", label: "Project Name", placeholder: "Enter project name", required: true },
      { id: "fld_summary", type: "rich_text", label: "Project Summary", placeholder: "What are you building?", required: true },
      { id: "fld_repo", type: "url", label: "Repository URL", placeholder: "https://github.com/...", required: false },
      { id: "fld_visual", type: "screenshot_upload", label: "Project Screenshot", required: false },
      { id: "fld_video", type: "video_upload", label: "Demo Video", required: false },
      { id: "fld_budget", type: "short_text", label: "Requested Budget", placeholder: "Amount requested", required: true }
    ],
    createdAt: new Date().toISOString()
  }
};

type GuidePlacement = "top" | "right" | "bottom" | "left" | "center";

interface DeployResult {
  digest: string;
  objectChanges?: SuiObjectChange[];
}

function toOptionValue(label: string, index: number): string {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || `option_${index + 1}`;
}

function newField(type: FieldType): FormField {
  const id = `fld_${Math.random().toString(36).slice(2, 8)}`;
  const base: FormField = {
    id,
    type,
    label:
      type === "confirmation"
        ? "I agree to the terms"
        : type === "url"
          ? "Website URL"
        : type === "file_upload"
          ? "Upload File"
          : type === "screenshot_upload"
            ? "Upload Screenshot"
            : type === "video_upload"
              ? "Upload Video"
            : `New ${fieldLibrary.find((field) => field.type === type)?.label ?? "Field"}`,
    placeholder: type === "short_text" ? "Enter text" : type === "long_text" || type === "rich_text" ? "Enter longer text" : "",
    required: false
  };

  if (type === "dropdown" || type === "checkboxes") {
    base.options = [
      { label: "Option 1", value: "option_1" },
      { label: "Option 2", value: "option_2" },
      { label: "Option 3", value: "option_3" }
    ];
  }
  if (type === "screenshot_upload") {
    base.acceptedMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    base.maxSizeBytes = 5 * 1024 * 1024;
  }
  if (type === "video_upload") {
    base.acceptedMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
    base.maxSizeBytes = 25 * 1024 * 1024;
  }
  if (type === "file_upload") {
    base.maxSizeBytes = 10 * 1024 * 1024;
  }

  return base;
}

function findCreatedFormObjectId(result: DeployResult): string {
  const formType = formrusPackageId ? `${formrusPackageId}::registry::Form` : "::registry::Form";
  const created = result.objectChanges?.find(
    (change) => change.type === "created" && "objectType" in change && change.objectType.endsWith(formType)
  );
  return created && "objectId" in created ? created.objectId : "";
}

function validateDraft(draft: FormDraft, poolSui: string, rewardSui: string, actionType: ActionType): string[] {
  const errors: string[] = [];
  const admins = parseWalletList(draft.access?.admins);
  const viewers = parseWalletList(draft.access?.viewers);
  if (!formrusPackageId) errors.push("Missing VITE_FORMRUS_PACKAGE_ID for the deployed mainnet contract.");
  if (!formrusRegistryId) errors.push("Missing VITE_FORMRUS_REGISTRY_ID for the mainnet registry object.");
  if (!walrusPublisherUrl) errors.push("Missing VITE_WALRUS_PUBLISHER_URL for schema and media uploads.");
  if (draft.responsePrivacy === "private" && sealKeyServers.length === 0) {
    errors.push("Missing VITE_SEAL_KEY_SERVER_IDS for private encrypted responses.");
  }
  if (!draft.title.trim()) errors.push("Form title is required.");
  if (draft.fields.length === 0) errors.push("Add at least one field.");

  draft.fields.forEach((field, index) => {
    if (!field.label.trim()) errors.push(`Field ${index + 1} needs a label.`);
    if ((field.type === "dropdown" || field.type === "checkboxes") && (field.options ?? []).filter((option) => option.label.trim()).length === 0) {
      errors.push(`Field ${index + 1} needs at least one option.`);
    }
  });

  const pool = Number(poolSui);
  const reward = Number(rewardSui);
  if (!Number.isFinite(pool) || pool < 0) errors.push("Initial pool must be a valid SUI amount.");
  if (!Number.isFinite(reward) || reward < 0) errors.push("Reward must be a valid SUI amount.");
  if (actionType === 1 && reward > pool) errors.push("Reward cannot be greater than the initial pool.");
  if (draft.eligibility.minSuiMist?.trim() && !/^\d+$/.test(draft.eligibility.minSuiMist.trim())) {
    errors.push("Minimum SUI balance must be a whole mist amount.");
  }
  if (draft.eligibility.minCoinBalance?.trim() && !/^\d+$/.test(draft.eligibility.minCoinBalance.trim())) {
    errors.push("Minimum coin balance must be a whole token unit amount.");
  }
  if (draft.eligibility.minCoinBalance?.trim() && !draft.eligibility.coinType?.trim()) {
    errors.push("Coin type is required when minimum coin balance is set.");
  }
  if (admins.length > 50) errors.push("Admin list cannot exceed 50 wallets.");
  if (viewers.length > 50) errors.push("Viewer list cannot exceed 50 wallets.");

  const enabledEligibilityChecks = [
    Boolean(draft.eligibility.minSuiMist?.trim()),
    Boolean(draft.eligibility.coinType?.trim() || draft.eligibility.minCoinBalance?.trim()),
    Boolean(draft.eligibility.requiredObjectType?.trim())
  ].filter(Boolean).length;
  if (enabledEligibilityChecks > 1) errors.push("Choose only one onchain eligibility check per form.");

  return errors;
}

function parseWalletList(value?: string[]): string[] {
  return (value ?? [])
    .flatMap((entry) => entry.split(/[\n,]+/g))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeSuiAddress);
}

/** Normalize a Sui address to 0x + 64 hex chars (padded). Returns empty string if invalid. */
function normalizeSuiAddress(addr: string): string {
  const clean = addr.trim();
  if (!clean) return "";
  const hex = clean.startsWith("0x") ? clean.slice(2) : clean;
  if (!/^[0-9a-fA-F]{1,64}$/.test(hex)) return "";
  return "0x" + hex.padStart(64, "0");
}

export function BuilderPage() {
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const fieldToolsRef = useRef<HTMLDetailsElement | null>(null);
  const fieldToolsMobileRef = useRef<HTMLButtonElement | null>(null);
  const rulesCardRef = useRef<HTMLDivElement | null>(null);
  const rulesButtonMobileRef = useRef<HTMLButtonElement | null>(null);
  const publishButtonRef = useRef<HTMLButtonElement | null>(null);
  const publishButtonMobileRef = useRef<HTMLButtonElement | null>(null);
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState<FormDraft>(initialDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>("none");
  const [draggedType, setDraggedType] = useState<FieldType | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [poolSui, setPoolSui] = useState("0");
  const [rewardSui, setRewardSui] = useState("0");
  const [actionType, setActionType] = useState<ActionType>(0);

  // When action type changes, sync pool/reward state
  function handleActionTypeChange(newType: ActionType) {
    setActionType(newType);
    if (newType === 0) {
      // "None" action — no pool needed
      setPoolSui("0");
      setRewardSui("0");
    } else if (newType === 1 && poolSui === "0") {
      // Switching back to reward — restore sensible defaults
      setPoolSui("0.2");
      setRewardSui("0.05");
    }
  }
  const [saltHex32, setSaltHex32] = useState(generateSaltHex32());
  const [expiresAtMs, setExpiresAtMs] = useState<string>("");
  const [deployState, setDeployState] = useState<"idle" | "deploying" | "done" | "error">("idle");
  const [deployMessage, setDeployMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [brandingUpload, setBrandingUpload] = useState<"idle" | "banner" | "avatar">("idle");
  const [lastDeletedField, setLastDeletedField] = useState<{ field: FormField; index: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideDismissForever, setGuideDismissForever] = useState(false);
  const [mobileFieldPickerOpen, setMobileFieldPickerOpen] = useState(false);

  const account = useCurrentAccount();
  const client = useSuiClient();
  const toast = useToast();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction<DeployResult>({
    execute: async ({ bytes, signature }) => {
      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true }
      });
      return { digest: result.digest, objectChanges: result.objectChanges ?? undefined };
    }
  });

  const selectedField = draft.fields.find((field) => field.id === selectedId) ?? null;
  const formSelected = selectedId === "form";
  const validationErrors = useMemo(() => validateDraft(draft, poolSui, rewardSui, actionType), [draft, poolSui, rewardSui, actionType]);
  const publishedFormUrl = shareLink || "";
  const builderSteps = [
    { key: "form", label: "Form", icon: Settings2, complete: Boolean(draft.title.trim()), onClick: () => { setPreviewMode(false); setSelectedId("form"); } },
    { key: "fields", label: "Fields", icon: Plus, complete: draft.fields.length > 0, onClick: () => { setPreviewMode(false); setLeftPanelOpen(true); } },
    { key: "rules", label: "Rules", icon: ShieldCheck, complete: true, onClick: () => { setPreviewMode(false); setAdvancedSettingsOpen(true); } },
    { key: "publish", label: "Publish", icon: Rocket, complete: deployState === "done", onClick: () => { setPreviewMode(false); } },
    ] as const;

    const getTarget = (...refs: React.RefObject<HTMLElement | null>[]) => {
    for (const ref of refs) {
      if (ref.current && (ref.current.offsetWidth > 0 || ref.current.offsetHeight > 0)) return ref.current;
    }
    return null;
    };

    const guideSteps = [
    {
      title: "Form Block",
      body: "Start here. The form itself is selectable, and its title, description, and branding open in the right settings panel.",
      target: formCardRef.current,
      placement: "right" as GuidePlacement,
    },
    {
      title: "Field Library",
      body: "Add fields from the library or drag them into the canvas. Dedicated screenshot and video uploads live here too.",
      target: getTarget(fieldToolsMobileRef, fieldToolsRef),
      placement: "right" as GuidePlacement,
    },
    {
      title: "Rules And Access",
      body: "Open advanced settings here to configure privacy, team access, rewards, limits, and onchain eligibility.",
      target: getTarget(rulesButtonMobileRef, rulesCardRef),
      placement: "right" as GuidePlacement,
    },
    {
      title: "Publish",
      body: "When the structure looks right, publish the form. After publishing, you can open the live form or embed view directly.",
      target: getTarget(publishButtonMobileRef, publishButtonRef),
      placement: "left" as GuidePlacement,
    },
    ];

  function togglePreviewMode() {
    setPreviewMode((current) => {
      const next = !current;
      if (next) {
        setLeftPanelOpen(false);
        setSelectedId(null);
      } else {
        setLeftPanelOpen(true);
        setSelectedId(null);
      }
      return next;
    });
  }

  useEffect(() => {
    const templateId = searchParams.get("template");
    const isClone = searchParams.get("clone");

    // Handle form cloning from sessionStorage
    if (isClone) {
      try {
        const raw = sessionStorage.getItem("formrus_clone");
        if (raw) {
          const cloned = JSON.parse(raw) as FormDraft;
          const nextDraft = {
            ...cloned,
            title: `${cloned.title} (Copy)`,
            fields: cloned.fields.map((field) => ({
              ...field,
              id: `fld_${Math.random().toString(36).slice(2, 8)}`,
              options: field.options?.map((option) => ({ ...option })),
            })),
            branding: { ...cloned.branding },
            eligibility: { ...cloned.eligibility },
            access: {
              admins: [...(cloned.access?.admins ?? [])],
              viewers: [...(cloned.access?.viewers ?? [])],
            },
            createdAt: new Date().toISOString(),
          };
          setDraft(nextDraft);
          setEligibilityMode(getEligibilityMode(nextDraft));
          setSelectedId("form");
          sessionStorage.removeItem("formrus_clone");
        }
      } catch {
        // Ignore parse errors
      }
      return;
    }

    if (!templateId) return;
    const template = formTemplates[templateId];
    if (!template) return;
    const nextDraft = {
      ...template,
      fields: template.fields.map((field) => ({
        ...field,
        id: `fld_${Math.random().toString(36).slice(2, 8)}`,
        options: field.options?.map((option) => ({ ...option }))
      })),
      branding: { ...template.branding },
      eligibility: { ...template.eligibility },
      access: {
        admins: [...(template.access?.admins ?? [])],
        viewers: [...(template.access?.viewers ?? [])]
      },
      createdAt: new Date().toISOString()
    };
    setDraft(nextDraft);
    setEligibilityMode(getEligibilityMode(nextDraft));
    setSelectedId("form");
  }, [searchParams]);

  useEffect(() => {
    if (!account?.address) {
      setShowGuide(false);
      return;
    }
    try {
      if (!localStorage.getItem(BUILDER_GUIDE_DISMISSED_KEY)) {
        setGuideStep(0);
        setGuideDismissForever(false);
        setShowGuide(true);
      }
    } catch {
      setGuideStep(0);
      setGuideDismissForever(false);
      setShowGuide(true);
    }
  }, [account?.address]);

  useEffect(() => {
    if (!showGuide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showGuide]);

  useEffect(() => {
    if (!mobileFieldPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFieldPickerOpen]);

  // Lock body scroll when the compact settings sheet is open
  useEffect(() => {
    const usesCompactSheet = window.matchMedia("(max-width: 1279px)").matches;
    if (selectedId && usesCompactSheet && !previewMode) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [selectedId, previewMode]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (deployState === "done") return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [deployState]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape — close mobile field settings sheet or deselect field
      if (e.key === "Escape") {
        if (selectedId) {
          setSelectedId(null);
          return;
        }
      }

      // Cmd/Ctrl+Z — undo last field deletion
      if (isMod && e.key === "z" && !e.shiftKey) {
        if (lastDeletedField) {
          e.preventDefault();
          const { field, index } = lastDeletedField;
          setDraft((current) => {
            const fields = [...current.fields];
            fields.splice(index, 0, field);
            return { ...current, fields };
          });
          setSelectedId(field.id);
          setLastDeletedField(null);
          toast.success("Field restored");
        }
      }

      // Cmd/Ctrl+P — toggle preview
      if (isMod && e.key === "p") {
        e.preventDefault();
        togglePreviewMode();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lastDeletedField, toast, selectedId]);

  const addField = useCallback((type: FieldType, index?: number, shouldSelect = true) => {
    const field = newField(type);
    setDraft((current) => {
      const fields = [...current.fields];
      if (index !== undefined && index >= 0) fields.splice(index, 0, field);
      else fields.push(field);
      return { ...current, fields };
    });
    if (shouldSelect) setSelectedId(field.id);
  }, []);

  function updateField(fieldId: string, patch: Partial<FormField>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    }));
  }

  function updateEligibility(patch: Partial<FormDraft["eligibility"]>) {
    setDraft((current) => ({ ...current, eligibility: { ...current.eligibility, ...patch } }));
  }

  function updateBranding(patch: Partial<NonNullable<FormDraft["branding"]>>) {
    setDraft((current) => ({ ...current, branding: { ...current.branding, ...patch } }));
  }

  async function uploadBrandingAsset(kind: "banner" | "avatar", file: File | null) {
    if (!file) return;
    setBrandingUpload(kind);
    setDeployMessage("");

    try {
      const blobId = await uploadFileToWalrus(file);
      const readBase = walrusAggregatorUrl ?? walrusPublisherUrl;
      if (!readBase) throw new Error("Missing VITE_WALRUS_AGGREGATOR_URL or VITE_WALRUS_PUBLISHER_URL.");

      const url = `${readBase}/v1/blobs/${blobId}`;
      updateBranding(kind === "banner" ? { bannerUrl: url } : { avatarUrl: url });
    } catch (error) {
      setDeployState("error");
      setDeployMessage(translateError(error));
    } finally {
      setBrandingUpload("idle");
    }
  }

  function removeField(fieldId: string) {
    const index = draft.fields.findIndex((f) => f.id === fieldId);
    if (index === -1) return;
    const removedField = draft.fields[index];
    setLastDeletedField({ field: removedField, index });
    setDraft((current) => ({ ...current, fields: current.fields.filter((field) => field.id !== fieldId) }));
    if (selectedId === fieldId) setSelectedId(null);
    toast.info("Field deleted — Ctrl+Z to undo");
  }

  function moveField(fromIndex: number, toIndex: number) {
    setDraft((current) => {
      if (toIndex < 0 || toIndex >= current.fields.length) return current;
      const fields = [...current.fields];
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      return { ...current, fields };
    });
  }

  function updateOption(fieldId: string, optionIndex: number, patch: Partial<FieldOption>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => {
        if (field.id !== fieldId) return field;
        const options = [...(field.options ?? [])];
        const currentOption = options[optionIndex] ?? { label: "", value: "" };
        options[optionIndex] = { ...currentOption, ...patch };
        if (patch.label !== undefined && patch.value === undefined) options[optionIndex].value = toOptionValue(patch.label, optionIndex);
        return { ...field, options };
      })
    }));
  }

  async function deploy() {
    if (!account?.address) {
      setDeployState("error");
      setDeployMessage("Connect wallet first.");
      return;
    }

    setDeployState("deploying");
    setDeployMessage("");
    setShareLink("");

    try {
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);

      const { schemaBlobId } = await uploadFormToWalrus(draft);
      const dna = computeFormDna({
        creatorAddress: account.address,
        schemaBlobId,
        actionType,
        saltHex32
      });

      const tx = buildRegisterFormTx({
        dna: dna.dnaHex,
        schemaBlobId,
        actionType,
        rewardAmountMist: suiToMist(rewardSui),
        eligibility: draft.eligibility,
        admins: parseWalletList(draft.access?.admins),
        viewers: parseWalletList(draft.access?.viewers),
        expiresAtMs: expiresAtMs ? BigInt(new Date(expiresAtMs).getTime()) : undefined,
        initialPoolMist: suiToMist(poolSui),
        maxPerAddress: draft.limits?.maxPerAddress,
        maxTotal: draft.limits?.maxTotal,
      });

      const result = await signAndExecuteTransaction({ transaction: tx, chain: `sui:${suiNetwork}` });
      const formObjectId = findCreatedFormObjectId(result);
      setDeployState("done");
      if (formObjectId) {
        setDeployMessage(`Published. DNA: ${dna.dnaHex} | blob: ${schemaBlobId} | tx: ${result.digest}`);
        setShareLink(`${window.location.origin}/view/${formObjectId}`);
      } else {
        setDeployMessage(`Published but could not extract form object ID. TX: ${result.digest}. Check the transaction on Sui explorer.`);
      }
    } catch (error) {
      setDeployState("error");
      setDeployMessage(translateError(error));
    }
  }

  const handleDragOver = (event: DragEvent, index: number) => {
    event.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (draggedType) {
      addField(draggedType, index);
      setDraggedType(null);
    }
    setDragOverIndex(null);
  };

  const handleFieldDragStart = (event: DragEvent, index: number) => {
    event.dataTransfer.setData("fieldIndex", index.toString());
  };

  const handleFieldDrop = (event: DragEvent, dropIndex: number) => {
    event.preventDefault();
    const fromIndex = Number.parseInt(event.dataTransfer.getData("fieldIndex"), 10);
    if (!Number.isNaN(fromIndex) && fromIndex !== dropIndex) moveField(fromIndex, dropIndex);
    setDragOverIndex(null);
  };

  function closeGuide(remember: boolean) {
    if (remember) {
      try {
        localStorage.setItem(BUILDER_GUIDE_DISMISSED_KEY, "1");
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
      <header
        className="min-h-16 flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6 z-50"
        style={{
          background: "var(--nav-bg)",
          borderBottom: "3px solid var(--border-color)",
          boxShadow: "0 3px 0 var(--shadow-color)"
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="w-8 h-8 flex items-center justify-center border-[3px] border-retro-border transition-colors hover:border-neon-lime flex-shrink-0"
            style={{ boxShadow: "2px 2px 0px var(--shadow-color)" }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            maxLength={120}
            className="bg-transparent font-mono font-bold text-sm md:text-base focus:outline-none w-32 sm:w-48 md:w-72 uppercase tracking-wide min-w-0"
            style={{ color: "var(--text)" }}
          />
          {deployState === "done" ? (
            <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase">
              <span className="w-1.5 h-1.5 bg-neon-lime animate-pulse" />
              <span style={{ color: "var(--neon-lime)" }}>Live</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ThemeToggle compact />
          <FormrusConnectButton compact />
          <button
            onClick={() => {
              if (publishedFormUrl) {
                window.open(publishedFormUrl, "_blank", "noopener,noreferrer");
                return;
              }
              togglePreviewMode();
            }}
            className="retro-button px-2.5 py-2 text-[10px] sm:text-xs"
            title={publishedFormUrl ? "Open live form" : previewMode ? "Back to edit (⌘P)" : "Preview form (⌘P)"}
            style={previewMode && !publishedFormUrl ? { background: "var(--neon-lime)", color: "#000" } : {}}
          >
            {publishedFormUrl ? <Eye size={14} strokeWidth={2.5} /> : previewMode ? <EyeOff size={14} strokeWidth={2.5} /> : <Eye size={14} strokeWidth={2.5} />}
            <span className="hidden sm:inline">{publishedFormUrl ? "Open Form" : previewMode ? "Edit" : "Preview"}</span>
          </button>
          <button
            ref={publishButtonRef}
            onClick={() => void deploy()}
            disabled={!account?.address || deployState === "deploying" || validationErrors.length > 0}
            className="retro-button-neon px-2.5 py-2 text-[10px] sm:text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#39FF14", color: "#000" }}
          >
            {deployState === "deploying" ? <Wallet size={14} strokeWidth={2.5} /> : <Rocket size={14} strokeWidth={2.5} />}
            <span className="hidden sm:inline">{deployState === "deploying" ? "Publishing" : "Publish"}</span>
          </button>
        </div>
      </header>

      {!account?.address ? (
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-lg border-[3px] border-retro-border p-6 md:p-8 text-center" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}>
            <img
              src="/brand/walrus-form-purple.png"
              alt=""
              className="w-40 h-40 object-cover mx-auto border-[3px] border-retro-border mb-5"
              style={{ boxShadow: "4px 4px 0px var(--shadow-color)" }}
            />
            <h1 className="font-mono font-bold text-xl uppercase mb-3" style={{ color: "var(--text)" }}>Connect Wallet to Build</h1>
            <p className="font-mono text-xs leading-relaxed mb-5 border-[3px] border-retro-border p-3" style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
              Form creation is tied to the connected creator wallet. Open the dashboard, connect your wallet, then create a form.
            </p>
            <Link to="/dashboard" className="retro-button-neon justify-center text-xs" style={{ backgroundColor: "#39FF14", color: "#000" }}>
              Back to Dashboard
            </Link>
          </div>
        </main>
      ) : (
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {!previewMode && leftPanelOpen ? (
          <aside
            className="w-80 xl:w-96 border-r-[3px] border-retro-border flex-shrink-0 overflow-y-auto hidden lg:block"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider" style={{ color: "var(--text)" }}>
                  Builder Tools
                </h3>
                <button onClick={() => setLeftPanelOpen(false)} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border transition-colors hover:border-neon-lime" style={{ boxShadow: "1px 1px 0px var(--shadow-color)" }} aria-label="Close settings panel">
                  <PanelLeftClose size={13} />
                </button>
              </div>

              <BuilderFlowCard steps={builderSteps} onOpenGuide={() => setShowGuide(true)} className="mb-4" />

              <details ref={fieldToolsRef} open className="border-[3px] border-retro-border p-4 mb-4" style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
                <summary className="font-mono text-xs uppercase font-bold cursor-pointer" style={{ color: "var(--text)" }}>
                  Add Fields
                </summary>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {fieldLibrary.map((field, index) => {
                    const Icon = field.icon;
                    const accent = accentColors[index % accentColors.length];
                    return (
                      <button
                        type="button"
                        key={field.type}
                        draggable
                        onClick={() => addField(field.type)}
                        onDragStart={() => setDraggedType(field.type)}
                        className="flex items-center gap-2 px-2.5 py-2 border-[3px] border-retro-border cursor-grab active:cursor-grabbing transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                        style={{ background: "var(--bg-secondary)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center border-[2px] border-retro-border flex-shrink-0" style={{ backgroundColor: accent }}>
                          <Icon size={12} color="#000" strokeWidth={2.5} />
                        </div>
                        <span className="font-mono text-[10px] text-left leading-tight" style={{ color: "var(--text)" }}>{field.label}</span>
                      </button>
                    );
                  })}
                </div>
              </details>

              <div ref={rulesCardRef} className="border-[3px] border-retro-border p-4 mb-4" style={{ color: "var(--text)", background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-mono text-xs uppercase font-bold">Rules & Access</h4>
                    <p className="font-mono text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {buildRulesSummary(draft, actionType)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdvancedSettingsOpen(true)}
                    className="retro-button text-[10px] flex-shrink-0"
                  >
                    <Settings2 size={13} />
                    Advanced
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                  <SummaryBadge label="Privacy" value={draft.responsePrivacy === "private" ? "Seal" : "Public"} />
                  <SummaryBadge label="Action" value={actionType === 1 ? "Reward" : "None"} />
                  <SummaryBadge label="Admins" value={`${draft.access?.admins?.length ?? 0}`} />
                  <SummaryBadge label="Viewers" value={`${draft.access?.viewers?.length ?? 0}`} />
                </div>
              </div>
            </div>
          </aside>
        ) : null}
        {!previewMode && !leftPanelOpen ? (
          <aside className="w-12 border-r-[3px] border-retro-border flex-shrink-0 hidden lg:flex items-start justify-center pt-4" style={{ background: "var(--bg-secondary)" }}>
            <button onClick={() => setLeftPanelOpen(true)} className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border transition-colors hover:border-neon-lime" style={{ boxShadow: "1px 1px 0px var(--shadow-color)" }} title="Show builder tools" aria-label="Open settings panel">
              <PanelLeftOpen size={14} />
            </button>
          </aside>
        ) : null}

        <main className="flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0">
          <div className="max-w-2xl mx-auto py-6 md:py-8 px-4">
            {!previewMode ? (
              <>
                <BuilderFlowCard steps={builderSteps} onOpenGuide={() => setShowGuide(true)} className="lg:hidden mb-4" />
                <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {fieldLibrary.map((field) => {
                    const Icon = field.icon;
                    return (
                      <button
                        key={field.type}
                        onClick={() => addField(field.type)}
                        className="flex items-center gap-1.5 px-3 py-2 border-[3px] border-retro-border font-mono text-[10px] uppercase text-left"
                        style={{ background: "var(--bg-card)", color: "var(--text-secondary)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
                      >
                        <Icon size={13} strokeWidth={2.5} />
                        {field.label}
                      </button>
                    );
                  })}
                </div>
                <div className="lg:hidden grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setSelectedId("form")}
                    className="retro-button text-[10px] justify-center"
                  >
                    <Settings2 size={13} />
                    Form Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancedSettingsOpen(true)}
                    className="retro-button text-[10px] justify-center"
                  >
                    <ShieldCheck size={13} />
                    Rules & Access
                  </button>
                </div>
              </>
            ) : null}

            <div
              ref={formCardRef}
              onClick={() => {
                if (!previewMode) {
                  setSelectedId("form");
                }
              }}
              className="border-[3px] border-retro-border mb-4 overflow-hidden"
              style={{
                background: formSelected && !previewMode ? "var(--code-bg)" : "var(--bg-card)",
                borderColor: formSelected && !previewMode ? "var(--neon-lime)" : "var(--border-color)",
                boxShadow: "4px 4px 0px var(--shadow-color)",
                cursor: previewMode ? "default" : "pointer"
              }}
            >
              {!previewMode ? (
                <div className="flex items-center justify-between px-3 py-2 border-b-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
                  <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <Settings2 size={14} />
                    <span className="font-mono text-[10px] uppercase font-bold">Form</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase" style={{ color: formSelected ? "var(--neon-lime)" : "var(--text-muted)" }}>
                    {formSelected ? "Editing" : "Select"}
                  </span>
                </div>
              ) : null}
              {safeUrl(draft.branding?.bannerUrl) ? (
                <div
                  className="h-40 md:h-48 bg-cover bg-center border-b-[3px] border-retro-border"
                  style={{ backgroundImage: `url(${safeUrl(draft.branding?.bannerUrl)})` }}
                />
              ) : null}
              <div className={`p-5 ${safeUrl(draft.branding?.bannerUrl) ? "pt-0" : ""}`}>
                {safeUrl(draft.branding?.avatarUrl) ? (
                  <img
                    src={safeUrl(draft.branding?.avatarUrl)}
                    alt=""
                    className={`${safeUrl(draft.branding?.bannerUrl) ? "-mt-10" : ""} w-20 h-20 object-cover border-[3px] border-retro-border mb-4`}
                    style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}
                  />
                ) : null}
                <h2 className="font-mono font-bold text-xl uppercase mb-2" style={{ color: "var(--text)" }}>{draft.title}</h2>
                <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{draft.description}</p>
                {publishedFormUrl ? (
                  <div className="mt-3 p-3 border-[3px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
                    <p className="font-mono text-[10px] uppercase font-bold mb-2" style={{ color: "var(--neon-lime)" }}>
                      Form published
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(publishedFormUrl, "_blank", "noopener,noreferrer")}
                        className="retro-button-neon text-[10px]"
                        style={{ backgroundColor: "#39FF14", color: "#000" }}
                      >
                        <Eye size={12} />
                        Open Form
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(publishedFormUrl.replace("/view/", "/embed/"), "_blank", "noopener,noreferrer")}
                        className="retro-button text-[10px]"
                      >
                        <Eye size={12} />
                        Open Embed
                      </button>
                    </div>
                  </div>
                ) : null}
                {deployMessage ? (
                  <p className="font-mono text-[10px] mt-3 break-words" style={{ color: deployState === "error" ? "#FF69B4" : "var(--text-muted)" }}>
                    {deployMessage}
                  </p>
                ) : null}
                {validationErrors.length > 0 ? (
                  <div className="font-mono text-[10px] mt-3 space-y-1" style={{ color: "#FF69B4" }}>
                    {validationErrors.map((error) => <p key={error}>{error}</p>)}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {draft.fields.length === 0 ? (
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, 0)}
                  className="border-[3px] border-dashed border-retro-border p-12 text-center"
                  style={{ background: "var(--bg-card)" }}
                >
                  <Plus size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                  <p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Drag fields here or click to add</p>
                </div>
              ) : null}

              {draft.fields.map((field, index) => (
                <div
                  key={field.id}
                  draggable={!previewMode}
                  onDragStart={(event) => handleFieldDragStart(event, index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={(event) => (draggedType ? handleDrop(event, index) : handleFieldDrop(event, index))}
                  onDragLeave={() => setDragOverIndex(null)}
                  onClick={() => {
                    if (!previewMode) {
                      setSelectedId(field.id);
                    }
                  }}
                  className="relative border-[3px] transition-all duration-150 cursor-pointer"
                  style={{
                    background: selectedId === field.id && !previewMode ? "var(--code-bg)" : "var(--bg-card)",
                    borderColor: selectedId === field.id && !previewMode ? "var(--neon-lime)" : dragOverIndex === index ? "var(--neon-cyan)" : "var(--border-color)",
                    boxShadow: "4px 4px 0px var(--shadow-color)"
                  }}
                >
                  {!previewMode ? (
                    <div className="flex items-center justify-between px-3 py-2 border-b-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
                      <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                        <GripVertical size={14} className="cursor-grab" />
                        <span className="font-mono text-[10px] uppercase font-bold">{field.type.replace("_", " ")}</span>
                        {field.required ? <span className="text-neon-magenta text-xs font-bold">*</span> : null}
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeField(field.id);
                        }}
                        className="p-1 transition-colors hover:text-red-500"
                        style={{ color: "var(--text-muted)" }}
                        aria-label={`Remove ${field.label}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}

                  <div className="px-3 py-3">
                    <FieldRenderer field={field} preview={previewMode} />
                  </div>
                </div>
              ))}

              {!previewMode ? (
                <button
                  onClick={() => addField("short_text")}
                  className="w-full py-4 border-[3px] border-dashed border-retro-border font-mono text-xs uppercase transition-colors hover:border-neon-lime flex items-center justify-center gap-2"
                  style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
                >
                  <Plus size={16} />
                  <span>Add field</span>
                </button>
              ) : null}
            </div>
          </div>
        </main>

        {!previewMode && selectedId ? (
          <>
            {/* Desktop settings sidebar */}
            <aside className="w-72 xl:w-80 border-l-[3px] border-retro-border flex-shrink-0 overflow-y-auto hidden xl:block" style={{ background: "var(--bg-secondary)" }}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text)" }}>
                    <Settings2 size={14} />
                    {formSelected ? "Form Settings" : "Field Settings"}
                  </h3>
                  <button onClick={() => setSelectedId(null)} className="w-6 h-6 flex items-center justify-center border-[2px] border-retro-border transition-colors hover:border-neon-lime" style={{ boxShadow: "1px 1px 0px var(--shadow-color)" }} aria-label="Close field settings">
                    <X size={12} />
                  </button>
                </div>

                {formSelected ? (
                  <FormSettings
                    draft={draft}
                    brandingUpload={brandingUpload}
                    setDraft={setDraft}
                    updateBranding={updateBranding}
                    uploadBrandingAsset={uploadBrandingAsset}
                    openAdvancedSettings={() => setAdvancedSettingsOpen(true)}
                  />
                ) : selectedField ? (
                  <FieldSettings
                    field={selectedField}
                    index={draft.fields.findIndex((field) => field.id === selectedField.id)}
                    fieldCount={draft.fields.length}
                    updateField={updateField}
                    updateOption={updateOption}
                    removeOption={(fieldId, optionIndex) =>
                      updateField(fieldId, { options: selectedField.options?.filter((_, index) => index !== optionIndex) ?? [] })
                    }
                    addOption={(fieldId) => {
                      const options = selectedField.options ?? [];
                      const label = `Option ${options.length + 1}`;
                      updateField(fieldId, { options: [...options, { label, value: toOptionValue(label, options.length) }] });
                    }}
                    moveField={moveField}
                  />
                ) : null}
              </div>
            </aside>

            {/* Compact settings bottom sheet */}
            <div
              className="xl:hidden fixed inset-0 z-[150] flex items-end"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
            >
              <div
                className="w-full max-h-[70vh] overflow-y-auto border-t-[3px] border-retro-border"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text)" }}>
                      <Settings2 size={14} />
                      {formSelected ? "Form Settings" : "Field Settings"}
                    </h3>
                    <button onClick={() => setSelectedId(null)} className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border" style={{ boxShadow: "1px 1px 0px var(--shadow-color)" }} aria-label="Close field settings">
                      <X size={14} />
                    </button>
                  </div>

                  {formSelected ? (
                    <FormSettings
                      draft={draft}
                      brandingUpload={brandingUpload}
                      setDraft={setDraft}
                      updateBranding={updateBranding}
                      uploadBrandingAsset={uploadBrandingAsset}
                      openAdvancedSettings={() => setAdvancedSettingsOpen(true)}
                    />
                  ) : selectedField ? (
                    <FieldSettings
                      field={selectedField}
                      index={draft.fields.findIndex((field) => field.id === selectedField.id)}
                      fieldCount={draft.fields.length}
                      updateField={updateField}
                      updateOption={updateOption}
                      removeOption={(fieldId, optionIndex) =>
                        updateField(fieldId, { options: selectedField.options?.filter((_, index) => index !== optionIndex) ?? [] })
                      }
                      addOption={(fieldId) => {
                        const options = selectedField.options ?? [];
                        const label = `Option ${options.length + 1}`;
                        updateField(fieldId, { options: [...options, { label, value: toOptionValue(label, options.length) }] });
                      }}
                      moveField={moveField}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
      )}
      {advancedSettingsOpen ? (
        <AdvancedSettingsModal
          draft={draft}
          setDraft={setDraft}
          actionType={actionType}
          setActionType={handleActionTypeChange}
          poolSui={poolSui}
          setPoolSui={setPoolSui}
          rewardSui={rewardSui}
          setRewardSui={setRewardSui}
          saltHex32={saltHex32}
          setSaltHex32={setSaltHex32}
          expiresAtMs={expiresAtMs}
          setExpiresAtMs={setExpiresAtMs}
          eligibilityMode={eligibilityMode}
          setEligibilityMode={setEligibilityMode}
          updateEligibility={updateEligibility}
          onClose={() => setAdvancedSettingsOpen(false)}
        />
      ) : null}

      <div className="mt-auto px-4 md:px-6 lg:px-10 pb-24 lg:pb-8">
        <SiteFooter />
      </div>

      {showGuide ? (
        <BuilderGuideOverlay
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

      {/* Compact action bar — visible until desktop side panels take over */}
      {account?.address ? (
        <div
          className="xl:hidden fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-between gap-2 px-3 pt-2 border-t-[3px] border-retro-border"
          style={{ background: "var(--nav-bg)", boxShadow: "0 -3px 0 var(--shadow-color)", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            ref={fieldToolsMobileRef}
            type="button"
            onClick={() => setMobileFieldPickerOpen(true)}
            className="retro-button text-[10px] p-2"
            title="Add field"
          >
            <Plus size={14} />
            <span className="hidden min-[360px]:inline">Field</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedId("form")}
            className="retro-button text-[10px] p-2"
            title="Open form settings"
          >
            <Settings2 size={14} />
            <span className="hidden min-[360px]:inline">Form</span>
          </button>
          <button
            ref={rulesButtonMobileRef}
            type="button"
            onClick={() => {
              setSelectedId(null);
              setAdvancedSettingsOpen(true);
            }}
            className="retro-button text-[10px] p-2"
            title="Advanced settings"
          >
            <ShieldCheck size={14} />
            <span className="hidden min-[360px]:inline">Rules</span>
          </button>
        </div>
      ) : null}

      {mobileFieldPickerOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-[170] flex items-end"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileFieldPickerOpen(false);
          }}
        >
          <div
            className="w-full max-h-[78vh] overflow-y-auto border-t-[3px] border-retro-border"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="sticky top-0 z-10 border-b-[2px] border-retro-border p-3 flex items-center justify-between gap-2" style={{ background: "var(--bg-card)" }}>
              <h3 className="font-mono text-xs uppercase font-bold" style={{ color: "var(--text)" }}>Add Field</h3>
              <div className="flex items-center gap-2">
                <button
                  ref={publishButtonMobileRef}
                  type="button"
                  onClick={() => void deploy()}
                  disabled={deployState === "deploying" || validationErrors.length > 0}
                  className="retro-button-neon text-[10px] disabled:opacity-50"
                  style={{ backgroundColor: "#39FF14", color: "#000" }}
                >
                  {deployState === "deploying" ? <Wallet size={13} /> : <Rocket size={13} />}
                  {deployState === "deploying" ? "Publishing" : "Publish"}
                </button>
                <button type="button" onClick={() => setMobileFieldPickerOpen(false)} className="retro-button text-[10px]">
                  <X size={13} />
                </button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {fieldLibrary.map((field) => {
                const Icon = field.icon;
                return (
                  <button
                    key={field.type}
                    type="button"
                    onClick={() => {
                      addField(field.type, undefined, false);
                      setMobileFieldPickerOpen(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 border-[3px] border-retro-border font-mono text-[10px] uppercase text-left transition-all active:scale-[0.98]"
                    style={{ background: "var(--bg-card)", color: "var(--text-secondary)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
                  >
                    <Icon size={13} strokeWidth={2.5} />
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildRulesSummary(draft: FormDraft, actionType: ActionType): string {
  const privacy = draft.responsePrivacy === "private" ? "Seal encrypted" : "public Walrus";
  const action = actionType === 1 ? "reward payout" : "no reward";
  const eligibility = draft.eligibility.requiredObjectType?.trim()
    ? "object gated"
    : draft.eligibility.coinType?.trim() || draft.eligibility.minCoinBalance?.trim()
      ? "coin gated"
      : draft.eligibility.minSuiMist?.trim()
        ? "SUI gated"
        : "open";
  return `${privacy}, ${eligibility}, ${action}`;
}

function BuilderFlowCard({
  steps,
  onOpenGuide,
  className = "",
}: {
  steps: readonly {
    key: string;
    label: string;
    icon: typeof Settings2;
    complete: boolean;
    onClick: () => void;
  }[];
  onOpenGuide: () => void;
  className?: string;
}) {
  return (
    <div className={`border-[3px] border-retro-border p-4 ${className}`.trim()} style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "var(--text-muted)" }}>
            Build Flow
          </div>
          <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Use this as a quick path through setup, fields, rules, and publish.
          </p>
        </div>
        <button type="button" onClick={onOpenGuide} className="retro-button text-[10px] flex-shrink-0">
          <Settings2 size={13} />
          Guide
        </button>
      </div>
      <div className="grid gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              type="button"
              onClick={step.onClick}
              className="flex items-center justify-between gap-3 px-2.5 py-2 border-[2px] border-retro-border text-left transition-all hover:-translate-y-px"
              style={{
                background: step.complete ? "rgba(57,255,20,0.12)" : "var(--bg-secondary)",
                color: "var(--text)",
                borderColor: step.complete ? "var(--neon-lime)" : "var(--border-color)",
                boxShadow: "2px 2px 0px var(--shadow-color)"
              }}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 flex items-center justify-center border-[2px] border-retro-border flex-shrink-0"
                  style={{ background: step.complete ? "var(--neon-lime)" : "var(--bg-card)", color: step.complete ? "#000" : "var(--text-muted)" }}
                >
                  {step.complete ? <CheckCircle size={11} strokeWidth={2.5} /> : <Icon size={11} strokeWidth={2.5} />}
                </span>
                <span className="font-mono text-[10px] uppercase font-bold">{step.label}</span>
              </span>
              <span className="font-mono text-[10px] uppercase" style={{ color: step.complete ? "var(--neon-lime)" : "var(--text-muted)" }}>
                Open
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BuilderGuideStep {
  title: string;
  body: string;
  target: HTMLElement | null;
  placement: GuidePlacement;
}

function BuilderGuideOverlay({
  steps,
  stepIndex,
  dismissForever,
  onDismissForeverChange,
  onClose,
  onNext,
  onBack,
}: {
  steps: BuilderGuideStep[];
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
              Builder Guide {stepIndex + 1}/{steps.length}
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
          <span
            className="w-3.5 h-3.5 border-[2px] border-retro-border flex items-center justify-center flex-shrink-0"
            style={{ background: dismissForever ? "var(--neon-lime)" : "transparent" }}
          >
            {dismissForever ? <span className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
          </span>
          <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>
            Do Not Show Again
          </span>
        </button>
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="retro-button text-[10px]">
              Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="retro-button text-[10px]">
              Skip
            </button>
          )}
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

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[2px] border-retro-border px-2 py-1.5 min-w-0" style={{ background: "var(--bg-secondary)" }}>
      <span className="block leading-none mb-1">{label}</span>
      <strong className="block text-[11px] truncate" style={{ color: "var(--text)" }}>{value}</strong>
    </div>
  );
}

function AdvancedSettingsModal({
  draft,
  setDraft,
  actionType,
  setActionType,
  poolSui,
  setPoolSui,
  rewardSui,
  setRewardSui,
  saltHex32,
  setSaltHex32,
  expiresAtMs,
  setExpiresAtMs,
  eligibilityMode,
  setEligibilityMode,
  updateEligibility,
  onClose
}: {
  draft: FormDraft;
  setDraft: Dispatch<SetStateAction<FormDraft>>;
  actionType: ActionType;
  setActionType: (value: ActionType) => void;
  poolSui: string;
  setPoolSui: (value: string) => void;
  rewardSui: string;
  setRewardSui: (value: string) => void;
  saltHex32: string;
  setSaltHex32: (value: string) => void;
  expiresAtMs: string;
  setExpiresAtMs: (value: string) => void;
  eligibilityMode: EligibilityMode;
  setEligibilityMode: (value: EligibilityMode) => void;
  updateEligibility: (patch: Partial<FormDraft["eligibility"]>) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"privacy" | "team" | "rewards" | "handler" | "limits" | "eligibility" | "dna">("privacy");

  // Close on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const tabs = [
    { key: "privacy" as const, label: "Privacy", icon: ShieldCheck },
    { key: "team" as const, label: "Team", icon: Users },
    { key: "rewards" as const, label: "Rewards", icon: Wallet },
    { key: "handler" as const, label: "Handler", icon: Rocket },
    { key: "limits" as const, label: "Limits", icon: CheckCircle },
    { key: "eligibility" as const, label: "Access", icon: CheckCircle },
    { key: "dna" as const, label: "DNA", icon: Key },
  ];

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6" style={{ background: "rgba(0,0,0,0.62)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden border-[3px] border-retro-border flex flex-col" style={{ background: "var(--bg-secondary)", boxShadow: "8px 8px 0px var(--shadow-color)" }} role="dialog" aria-modal="true" aria-label="Form Settings">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-[3px] border-retro-border flex-shrink-0" style={{ background: "var(--nav-bg)" }}>
          <div className="min-w-0">
            <h3 className="font-mono text-sm uppercase font-bold flex items-center gap-2" id="settings-dialog-title" style={{ color: "var(--text)" }}>
              <Settings2 size={16} />
              Form Settings
            </h3>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {buildRulesSummary(draft, actionType)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border transition-all hover:border-neon-lime hover:bg-neon-lime hover:text-black" style={{ boxShadow: "2px 2px 0px var(--shadow-color)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b-[3px] border-retro-border flex-shrink-0 overflow-x-auto" style={{ background: "var(--bg-card)" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-2.5 font-mono text-[10px] uppercase font-bold border-r-[1px] border-retro-border last:border-r-0 transition-all whitespace-nowrap"
                style={{
                  background: isActive ? "var(--neon-lime)" : "transparent",
                  color: isActive ? "#000" : "var(--text-muted)",
                  borderBottom: isActive ? "2px solid var(--neon-lime)" : "2px solid transparent",
                }}
              >
                <Icon size={13} strokeWidth={2.5} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "privacy" ? (
            <PrivacyTab draft={draft} setDraft={setDraft} />
          ) : null}
          {activeTab === "team" ? (
            <TeamTab draft={draft} setDraft={setDraft} />
          ) : null}
          {activeTab === "rewards" ? (
            <RewardsTab
              actionType={actionType}
              setActionType={setActionType}
              poolSui={poolSui}
              setPoolSui={setPoolSui}
              rewardSui={rewardSui}
              setRewardSui={setRewardSui}
              expiresAtMs={expiresAtMs}
              setExpiresAtMs={setExpiresAtMs}
            />
          ) : null}
          {activeTab === "handler" ? (
            <HandlerTab draft={draft} setDraft={setDraft} />
          ) : null}
          {activeTab === "limits" ? (
            <LimitsTab draft={draft} setDraft={setDraft} expiresAtMs={expiresAtMs} setExpiresAtMs={setExpiresAtMs} />
          ) : null}
          {activeTab === "eligibility" ? (
            <EligibilityTab
              draft={draft}
              eligibilityMode={eligibilityMode}
              setEligibilityMode={setEligibilityMode}
              updateEligibility={updateEligibility}
            />
          ) : null}
          {activeTab === "dna" ? (
            <DnaTab saltHex32={saltHex32} setSaltHex32={setSaltHex32} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t-[3px] border-retro-border flex-shrink-0" style={{ background: "var(--nav-bg)" }}>
          <div className="flex gap-2">
            {(["privacy", "team", "rewards", "handler", "limits", "eligibility", "dna"] as const).map((key) => (
              <div
                key={key}
                className="w-2 h-2 border border-retro-border transition-all"
                style={{
                  background: activeTab === key ? "var(--neon-lime)" : "var(--border-light)",
                }}
              />
            ))}
          </div>
          <button type="button" onClick={onClose} className="retro-button-neon text-xs" style={{ backgroundColor: "#39FF14", color: "#000" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab Components ──────────────────────────────────────

function SettingsCard({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-[3px] border-retro-border p-4 mb-4 transition-all ${className}`} style={{ background: "var(--bg-card)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
      <h4 className="font-mono font-bold text-xs uppercase mb-1" style={{ color: "var(--text)" }}>{title}</h4>
      {description ? <p className="font-mono text-[10px] mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p> : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RetroSelect({ value, onChange, children }: { value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: ReactNode }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full font-mono text-xs uppercase px-3 py-2 border-[3px] border-retro-border transition-all focus:outline-none focus:border-neon-lime cursor-pointer"
      style={{ background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
    >
      {children}
    </select>
  );
}

function RetroInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full font-mono text-xs px-3 py-2 border-[3px] border-retro-border transition-all focus:outline-none focus:border-neon-lime"
      style={{ background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
    />
  );
}

function FieldLabel({ label, tip }: { label: string; tip?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
      {tip ? <Tooltip text={tip} /> : null}
    </div>
  );
}

// ── Privacy Tab ──────────────────────────────────────────────────

function PrivacyTab({ draft, setDraft }: { draft: FormDraft; setDraft: Dispatch<SetStateAction<FormDraft>> }) {
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Response Privacy"
        description="Controls how response data is stored on Walrus."
      >
        <FieldLabel label="Storage Mode" tip="Private responses are encrypted with Seal before uploading to Walrus. Only the creator and admins can decrypt. Public responses are stored as plain JSON." />
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "private", label: "Seal Encrypted", desc: "Only you & admins can read", color: "#39FF14" },
            { value: "public", label: "Public JSON", desc: "Anyone with blob ID can read", color: "#FF69B4" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDraft((c) => ({ ...c, responsePrivacy: option.value }))}
              className="text-left p-3 border-[3px] border-retro-border transition-all"
              style={{
                background: draft.responsePrivacy === option.value ? "var(--code-bg)" : "var(--bg-secondary)",
                borderColor: draft.responsePrivacy === option.value ? option.color : "var(--border-color)",
                boxShadow: draft.responsePrivacy === option.value ? `3px 3px 0px var(--shadow-color)` : "2px 2px 0px var(--shadow-color)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 border-[2px] border-retro-border flex items-center justify-center" style={{ background: draft.responsePrivacy === option.value ? option.color : "transparent" }}>
                  {draft.responsePrivacy === option.value ? <div className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>{option.label}</span>
              </div>
              <p className="font-mono text-[9px] leading-relaxed ml-5" style={{ color: "var(--text-muted)" }}>{option.desc}</p>
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] leading-relaxed p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: draft.responsePrivacy === "public" ? "#FF69B4" : "var(--text-muted)" }}>
          {draft.responsePrivacy === "public"
            ? "⚠ Public responses are readable by anyone with the blob ID. Use for non-sensitive data only."
            : "Private responses encrypt content before Walrus upload. Metadata (submitter, timestamp) remains public onchain."}
        </p>
      </SettingsCard>
    </div>
  );
}

// ── Team Tab ─────────────────────────────────────────────────────

function TeamTab({ draft, setDraft }: { draft: FormDraft; setDraft: Dispatch<SetStateAction<FormDraft>> }) {
  const [newAddress, setNewAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "viewer">("admin");

  const admins = draft.access?.admins ?? [];
  const viewers = draft.access?.viewers ?? [];
  const hasSuggestedAdmin = admins.some((wallet) => wallet.toLowerCase() === deepsurgeAdminAddress.toLowerCase());

  function addAddress() {
    const addresses = newAddress
      .split(/[\n,]+/g)
      .map((a) => a.trim())
      .filter(Boolean)
      .map(normalizeSuiAddress)
      .filter(Boolean);
    if (addresses.length === 0) return;

    setDraft((current) => {
      const access = { ...current.access };
      if (selectedRole === "admin") {
        access.admins = [...(access.admins ?? []), ...addresses];
      } else {
        access.viewers = [...(access.viewers ?? []), ...addresses];
      }
      return { ...current, access };
    });
    setNewAddress("");
  }

  function removeAddress(role: "admin" | "viewer", index: number) {
    setDraft((current) => {
      const access = { ...current.access };
      const list = role === "admin" ? [...(access.admins ?? [])] : [...(access.viewers ?? [])];
      list.splice(index, 1);
      if (role === "admin") access.admins = list;
      else access.viewers = list;
      return { ...current, access };
    });
  }

  function addSuggestedAdmin() {
    if (hasSuggestedAdmin) return;
    setDraft((current) => ({
      ...current,
      access: {
        ...current.access,
        admins: [...(current.access?.admins ?? []), deepsurgeAdminAddress]
      }
    }));
  }

  return (
    <div className="space-y-4">
      {!hasSuggestedAdmin ? (
        <SettingsCard
          title="Suggested Admin"
          description="Recommended co-admin for support and private-response access. It is not added automatically."
        >
          <div className="flex items-start justify-between gap-3 p-3 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase font-bold mb-1" style={{ color: "var(--text)" }}>Suggested</p>
              <p className="font-mono text-[10px] break-all" style={{ color: "var(--text-muted)" }}>{deepsurgeAdminAddress}</p>
            </div>
            <button
              type="button"
              onClick={addSuggestedAdmin}
              className="retro-button text-[10px] flex-shrink-0"
              style={{ background: "#39FF14", color: "#000" }}
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        </SettingsCard>
      ) : null}

      <SettingsCard
        title="Team Access"
        description="Control who can view and manage this form on the dashboard."
      >
        {/* Role selector */}
        <FieldLabel label="Add Member" tip="Admins can decrypt private responses, pause/resume, and update settings. Only the creator can top up the pool and manage roles. Viewers can only see the dashboard and responses." />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([
            { value: "admin" as const, label: "Admin", desc: "Full access + decrypt", color: "#39FF14" },
            { value: "viewer" as const, label: "Viewer", desc: "Read-only dashboard", color: "#00FFFF" },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedRole(option.value)}
              className="text-left p-2.5 border-[3px] border-retro-border transition-all"
              style={{
                background: selectedRole === option.value ? "var(--code-bg)" : "var(--bg-secondary)",
                borderColor: selectedRole === option.value ? option.color : "var(--border-color)",
                boxShadow: selectedRole === option.value ? `2px 2px 0px var(--shadow-color)` : "1px 1px 0px var(--shadow-color)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-[2px] border-retro-border flex items-center justify-center" style={{ background: selectedRole === option.value ? option.color : "transparent" }}>
                  {selectedRole === option.value ? <div className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>{option.label}</span>
              </div>
              <p className="font-mono text-[9px] mt-1 ml-5" style={{ color: "var(--text-muted)" }}>{option.desc}</p>
            </button>
          ))}
        </div>

        {/* Address input with + button */}
        <div className="flex gap-2">
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAddress(); } }}
            placeholder="0x... (comma or newline separated for multiple)"
            className="flex-1 font-mono text-xs px-3 py-2 border-[3px] border-retro-border transition-all focus:outline-none focus:border-neon-lime"
            style={{ background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
          />
          <button
            type="button"
            onClick={addAddress}
            disabled={!newAddress.trim()}
            className="w-10 flex items-center justify-center border-[3px] border-retro-border transition-all hover:border-neon-lime hover:bg-neon-lime hover:text-black disabled:opacity-30 disabled:hover:border-retro-border disabled:hover:bg-transparent disabled:hover:text-inherit"
            style={{ background: selectedRole === "admin" ? "#39FF14" : "#00FFFF", color: "#000", boxShadow: "2px 2px 0px var(--shadow-color)" }}
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
        <p className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          Paste multiple addresses separated by commas or newlines to add them all at once.
        </p>
      </SettingsCard>

      {/* Current members list */}
      {(admins.length > 0 || viewers.length > 0) ? (
        <SettingsCard title="Current Members">
          <div className="space-y-2">
            {admins.map((wallet, i) => (
              <div key={`admin-${i}`} className="flex items-center gap-2 p-2 border-[2px] border-retro-border transition-all hover:border-neon-lime group" style={{ background: "var(--bg-secondary)" }}>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-retro-border flex-shrink-0" style={{ background: "#39FF14", color: "#000" }}>admin</span>
                <span className="font-mono text-[10px] truncate flex-1" style={{ color: "var(--text)" }}>{wallet.length > 20 ? `${wallet.slice(0, 10)}...${wallet.slice(-8)}` : wallet}</span>
                <button type="button" onClick={() => removeAddress("admin", i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400" style={{ color: "var(--text-muted)" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {viewers.map((wallet, i) => (
              <div key={`viewer-${i}`} className="flex items-center gap-2 p-2 border-[2px] border-retro-border transition-all hover:border-neon-cyan group" style={{ background: "var(--bg-secondary)" }}>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-retro-border flex-shrink-0" style={{ background: "#00FFFF", color: "#000" }}>viewer</span>
                <span className="font-mono text-[10px] truncate flex-1" style={{ color: "var(--text)" }}>{wallet.length > 20 ? `${wallet.slice(0, 10)}...${wallet.slice(-8)}` : wallet}</span>
                <button type="button" onClick={() => removeAddress("viewer", i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400" style={{ color: "var(--text-muted)" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </SettingsCard>
      ) : null}
    </div>
  );
}

// ── Rewards Tab ──────────────────────────────────────────────────

function RewardsTab({
  actionType,
  setActionType,
  poolSui,
  setPoolSui,
  rewardSui,
  setRewardSui,
  expiresAtMs,
  setExpiresAtMs,
}: {
  actionType: ActionType;
  setActionType: (value: ActionType) => void;
  poolSui: string;
  setPoolSui: (value: string) => void;
  rewardSui: string;
  setRewardSui: (value: string) => void;
  expiresAtMs: string;
  setExpiresAtMs: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Reward Action"
        description="Optionally pay SUI to each submitter from a pool you fund at creation."
      >
        <FieldLabel label="On Submit" tip="What happens when someone submits. 'Pay reward' sends SUI from the pool. 'None' just records the response." />
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 0, label: "None", desc: "Record response only", icon: "—" },
            { value: 1, label: "Pay Reward", desc: "Send SUI to submitter", icon: "💰" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActionType(option.value as ActionType)}
              className="text-left p-3 border-[3px] border-retro-border transition-all"
              style={{
                background: actionType === option.value ? "var(--code-bg)" : "var(--bg-secondary)",
                borderColor: actionType === option.value ? "#FFFF00" : "var(--border-color)",
                boxShadow: actionType === option.value ? "3px 3px 0px var(--shadow-color)" : "2px 2px 0px var(--shadow-color)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 border-[2px] border-retro-border flex items-center justify-center" style={{ background: actionType === option.value ? "#FFFF00" : "transparent" }}>
                  {actionType === option.value ? <div className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>{option.label}</span>
              </div>
              <p className="font-mono text-[9px] ml-5" style={{ color: "var(--text-muted)" }}>{option.desc}</p>
            </button>
          ))}
        </div>
      </SettingsCard>

      {actionType === 1 ? (
        <>
          <SettingsCard title="Pool & Reward" description="Set how much SUI to deposit and pay per submission.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Reward Per Submit" tip="SUI paid to each submitter. Locked after the first submission." />
                <RetroInput value={rewardSui} onChange={(e) => setRewardSui(e.target.value)} placeholder="0.05" type="number" />
                <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>SUI per response</p>
              </div>
              <div>
                <FieldLabel label="Initial Pool" tip="SUI deposited at creation to fund rewards. Must be ≥ reward amount." />
                <RetroInput value={poolSui} onChange={(e) => setPoolSui(e.target.value)} placeholder="0.2" type="number" />
                <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>Total SUI deposited</p>
              </div>
            </div>
            {Number(rewardSui) > 0 && Number(poolSui) > 0 ? (
              <div className="p-2 border-[2px] border-retro-border font-mono text-[10px]" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                ≈ {Math.floor(Number(poolSui) / Number(rewardSui))} submissions funded
              </div>
            ) : null}
          </SettingsCard>

          <SettingsCard title="Expiration" description="Optional. Stop accepting submissions after a date.">
            <FieldLabel label="Expires At" tip="Form stops accepting submissions after this date. Enforced on-chain." />
            <RetroInput value={expiresAtMs} onChange={(e) => setExpiresAtMs(e.target.value)} type="datetime-local" />
            {expiresAtMs ? (
              <button
                type="button"
                onClick={() => setExpiresAtMs("")}
                className="font-mono text-[10px] uppercase font-bold transition-all hover:text-neon-pink"
                style={{ color: "var(--text-secondary)" }}
              >
                Clear expiry
              </button>
            ) : null}
          </SettingsCard>
        </>
      ) : null}
    </div>
  );
}

// ── Eligibility Tab ──────────────────────────────────────────────

function EligibilityTab({
  draft,
  eligibilityMode,
  setEligibilityMode,
  updateEligibility,
}: {
  draft: FormDraft;
  eligibilityMode: EligibilityMode;
  setEligibilityMode: (value: EligibilityMode) => void;
  updateEligibility: (patch: Partial<FormDraft["eligibility"]>) => void;
}) {
  const modes = [
    { value: "none" as const, label: "Open", desc: "Anyone can submit", icon: "🌍" },
    { value: "sui" as const, label: "SUI Gate", desc: "Min SUI balance required", icon: "💎" },
    { value: "coin" as const, label: "Token Gate", desc: "Specific coin required", icon: "🪙" },
    { value: "object" as const, label: "NFT Gate", desc: "Must own specific object", icon: "🎨" },
  ];

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Submission Eligibility"
        description="Restrict who can submit based on on-chain holdings."
      >
        <FieldLabel label="Gate Type" tip="Who can submit. 'Open' has no restrictions. Gates require on-chain proof." />
        <div className="grid grid-cols-2 gap-2">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                setEligibilityMode(mode.value);
                applyEligibilityMode(mode.value, updateEligibility);
              }}
              className="text-left p-3 border-[3px] border-retro-border transition-all"
              style={{
                background: eligibilityMode === mode.value ? "var(--code-bg)" : "var(--bg-secondary)",
                borderColor: eligibilityMode === mode.value ? "#FF00FF" : "var(--border-color)",
                boxShadow: eligibilityMode === mode.value ? "3px 3px 0px var(--shadow-color)" : "2px 2px 0px var(--shadow-color)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 border-[2px] border-retro-border flex items-center justify-center" style={{ background: eligibilityMode === mode.value ? "#FF00FF" : "transparent" }}>
                  {eligibilityMode === mode.value ? <div className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>{mode.label}</span>
              </div>
              <p className="font-mono text-[9px] ml-5" style={{ color: "var(--text-muted)" }}>{mode.desc}</p>
            </button>
          ))}
        </div>
      </SettingsCard>

      {eligibilityMode === "sui" ? (
        <SettingsCard title="SUI Balance Gate" description="Submitters must hold a minimum SUI balance.">
          <FieldLabel label="Minimum SUI (in mist)" tip="1 SUI = 1,000,000,000 mist. Submitters must hold at least this amount." />
          <RetroInput value={draft.eligibility.minSuiMist ?? ""} onChange={(e) => updateEligibility({ minSuiMist: e.target.value })} placeholder="1000000000" />
        </SettingsCard>
      ) : null}

      {eligibilityMode === "coin" ? (
        <SettingsCard title="Token Gate" description="Submitters must hold a specific coin type.">
          <FieldLabel label="Coin Type" tip="Full type path, e.g. 0x2::sui::SUI" />
          <RetroInput value={draft.eligibility.coinType ?? ""} onChange={(e) => updateEligibility({ coinType: e.target.value })} placeholder="0x2::sui::SUI" />
          <FieldLabel label="Minimum Balance" tip="Amount in the coin's smallest unit." />
          <RetroInput value={draft.eligibility.minCoinBalance ?? ""} onChange={(e) => updateEligibility({ minCoinBalance: e.target.value })} placeholder="1000000" />
        </SettingsCard>
      ) : null}

      {eligibilityMode === "object" ? (
        <SettingsCard title="NFT / Object Gate" description="Submitters must own at least one object of this type.">
          <FieldLabel label="Object Type" tip="Full type path of the required NFT or object." />
          <RetroInput value={draft.eligibility.requiredObjectType ?? ""} onChange={(e) => updateEligibility({ requiredObjectType: e.target.value })} placeholder="0x...::collection::Nft" />
        </SettingsCard>
      ) : null}
    </div>
  );
}

// ── DNA Tab ──────────────────────────────────────────────────────

function DnaTab({ saltHex32, setSaltHex32 }: { saltHex32: string; setSaltHex32: (value: string) => void }) {
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Form DNA Salt"
        description="Random hex used to generate the unique on-chain form identity. Changing this creates a completely different form."
      >
        <FieldLabel label="Salt (64 hex chars)" tip="Used in DNA computation. Only change if you know what you're doing." />
        <div className="flex gap-2">
          <RetroInput value={saltHex32} onChange={(e) => setSaltHex32(e.target.value)} placeholder="0x..." />
          <button
            type="button"
            onClick={() => setSaltHex32(generateSaltHex32())}
            className="flex-shrink-0 px-3 py-2 border-[3px] border-retro-border font-mono text-[10px] uppercase font-bold transition-all hover:border-neon-lime hover:bg-neon-lime hover:text-black"
            style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
          >
            Regenerate
          </button>
        </div>
        <p className="font-mono text-[9px] p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
          ⚠ Changing the salt after publishing creates a new form identity. Existing responses will not be linked.
        </p>
      </SettingsCard>
    </div>
  );
}

// ── Handler Tab ──────────────────────────────────────────────────

function HandlerTab({ draft, setDraft }: { draft: FormDraft; setDraft: Dispatch<SetStateAction<FormDraft>> }) {
  const handler = draft.handler ?? { type: "built_in" as const };

  function updateHandler(patch: Partial<NonNullable<FormDraft["handler"]>>) {
    setDraft((current) => ({
      ...current,
      handler: { ...(current.handler ?? { type: "built_in" as const }), ...patch },
    }));
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Submission Handler"
        description="Controls what happens after a response is accepted on-chain. The built-in handler is the audited default. Custom handlers remain available as an experimental beta path."
      >
        <FieldLabel label="Handler Type" tip="Built-in uses the default Formrus logic. Custom handlers are available as an experimental beta path and require extra care to preserve eligibility, reward, and safety semantics." />
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "built_in" as const, label: "Built-in", desc: "Record + pay reward", icon: "⚡" },
            { value: "custom" as const, label: "Custom Beta", desc: "Experimental handler path", icon: "🔧" },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateHandler({ type: option.value, customTarget: option.value === "built_in" ? undefined : handler.customTarget })}
              className="text-left p-3 border-[3px] border-retro-border transition-all"
              style={{
                background: handler.type === option.value ? "var(--code-bg)" : "var(--bg-secondary)",
                borderColor: handler.type === option.value ? "#FF00FF" : "var(--border-color)",
                boxShadow: handler.type === option.value ? "3px 3px 0px var(--shadow-color)" : "2px 2px 0px var(--shadow-color)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 border-[2px] border-retro-border flex items-center justify-center" style={{ background: handler.type === option.value ? "#FF00FF" : "transparent" }}>
                  {handler.type === option.value ? <div className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
                </div>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text)" }}>{option.label}</span>
              </div>
              <p className="font-mono text-[9px] ml-5" style={{ color: "var(--text-muted)" }}>{option.desc}</p>
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
          Custom handlers remain available as a beta feature. They are not covered by the same audit confidence as the built-in submit/pay flow and may require package-specific review.
        </p>
      </SettingsCard>

      {handler.type === "custom" ? (
        <>
          <SettingsCard
            title="Custom Handler Target"
            description="The full Move function path for your handler module. Custom handlers are an advanced beta path and must preserve the safety rules your form depends on."
          >
            <FieldLabel label="Move Target" tip="Format: package::module::function, e.g. 0xabc123::nft_handler::submit_and_mint" />
            <RetroInput
              value={handler.customTarget ?? ""}
              onChange={(e) => updateHandler({ customTarget: e.target.value })}
              placeholder="0xabc::my_handler::submit_and_mint"
            />
            <p className="font-mono text-[9px] p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              Handler signatures may vary when eligibility proofs are involved. Your module is responsible for preserving eligibility, reward, and asset-handling semantics before and after calling into Formrus.
            </p>
          </SettingsCard>

          <SettingsCard
            title="Handler Architecture"
            description="How custom handlers work with Formrus."
          >
            <div className="space-y-2 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              <div className="p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--neon-lime)" }}>1.</span> The built-in handler remains the audited default path
              </div>
              <div className="p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--neon-lime)" }}>2.</span> A custom handler can add package-specific logic such as minting, airdrops, or voting
              </div>
              <div className="p-2 border-[2px] border-retro-border" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--neon-lime)" }}>3.</span> Custom logic must be reviewed to ensure it preserves the form policy you intend
              </div>
            </div>
          </SettingsCard>
        </>
      ) : (
        <SettingsCard title="Built-in Handler" description="The default Formrus handler.">
          <div className="p-3 border-[2px] border-retro-border font-mono text-[10px]" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
            <p className="mb-1"><span style={{ color: "var(--neon-lime)" }}>submit_and_act</span> — validates eligibility, records response on Walrus, pays SUI reward from pool.</p>
            <p>Supports: anyone, SUI gate, coin gate, NFT gate eligibility.</p>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

// ── Limits Tab ───────────────────────────────────────────────────

function LimitsTab({
  draft,
  setDraft,
  expiresAtMs,
  setExpiresAtMs,
}: {
  draft: FormDraft;
  setDraft: Dispatch<SetStateAction<FormDraft>>;
  expiresAtMs: string;
  setExpiresAtMs: (value: string) => void;
}) {
  const limits = draft.limits ?? {};

  function updateLimits(patch: Partial<NonNullable<FormDraft["limits"]>>) {
    setDraft((current) => ({
      ...current,
      limits: { ...(current.limits ?? {}), ...patch },
    }));
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Submission Limits"
        description="Control how many times each wallet or the form overall can be submitted to."
      >
        <FieldLabel label="Max Per Address" tip="How many times the same wallet can submit. Minimum is 1." />
        <RetroInput
          value={String(limits.maxPerAddress ?? "")}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            updateLimits({ maxPerAddress: Number.isFinite(val) && val > 0 ? val : undefined });
          }}
          placeholder="1"
          type="number"
        />
        <p className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          Default: 1 submission per wallet. Set higher to allow multiple responses.
        </p>

        <FieldLabel label="Max Total Submissions" tip="0 = unlimited. Set a number to cap total responses. Once reached, no more submissions accepted." />
        <RetroInput
          value={String(limits.maxTotal ?? "")}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            updateLimits({ maxTotal: Number.isFinite(val) && val >= 0 ? val : undefined });
          }}
          placeholder="0 (unlimited)"
          type="number"
        />
        <p className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          0 = unlimited. Useful for limited-quantity forms (first 100 respondents, event capacity, etc.)
        </p>
      </SettingsCard>

      <SettingsCard title="Expiration" description="Optional. Stop accepting submissions after a date.">
        <FieldLabel label="Expires At" tip="Form stops accepting submissions after this date. Enforced on-chain." />
        <RetroInput value={expiresAtMs} onChange={(e) => setExpiresAtMs(e.target.value)} type="datetime-local" />
        {expiresAtMs ? (
          <button
            type="button"
            onClick={() => setExpiresAtMs("")}
            className="font-mono text-[10px] uppercase font-bold transition-all hover:text-neon-pink"
            style={{ color: "var(--text-secondary)" }}
          >
            Clear expiry
          </button>
        ) : null}
      </SettingsCard>
    </div>
  );
}

type EligibilityMode = "none" | "sui" | "coin" | "object";
type UploadPolicyPreset = "image" | "video" | "custom";

const IMAGE_MIME_PRESET = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VIDEO_MIME_PRESET = ["video/mp4", "video/webm", "video/quicktime"];

function getEligibilityMode(draft: FormDraft): EligibilityMode {
  if (draft.eligibility.requiredObjectType?.trim()) return "object";
  if (draft.eligibility.coinType?.trim() || draft.eligibility.minCoinBalance?.trim()) return "coin";
  if (draft.eligibility.minSuiMist?.trim()) return "sui";
  return "none";
}

function applyEligibilityMode(mode: EligibilityMode, updateEligibility: (patch: Partial<FormDraft["eligibility"]>) => void) {
  if (mode === "none") updateEligibility({ minSuiMist: "", coinType: "", minCoinBalance: "", requiredObjectType: "" });
  if (mode === "sui") updateEligibility({ coinType: "", minCoinBalance: "", requiredObjectType: "" });
  if (mode === "coin") updateEligibility({ minSuiMist: "", requiredObjectType: "" });
  if (mode === "object") updateEligibility({ minSuiMist: "", coinType: "", minCoinBalance: "" });
}

function detectUploadPolicyPreset(field: FormField): UploadPolicyPreset {
  const types = field.acceptedMimeTypes ?? [];
  if (types.length === IMAGE_MIME_PRESET.length && types.every((value, i) => value === IMAGE_MIME_PRESET[i])) return "image";
  if (types.length === VIDEO_MIME_PRESET.length && types.every((value, i) => value === VIDEO_MIME_PRESET[i])) return "video";
  return "custom";
}

function FormSettings({
  draft,
  brandingUpload,
  setDraft,
  updateBranding,
  uploadBrandingAsset,
  openAdvancedSettings
}: {
  draft: FormDraft;
  brandingUpload: "idle" | "banner" | "avatar";
  setDraft: Dispatch<SetStateAction<FormDraft>>;
  updateBranding: (patch: Partial<NonNullable<FormDraft["branding"]>>) => void;
  uploadBrandingAsset: (kind: "banner" | "avatar", file: File | null) => Promise<void>;
  openAdvancedSettings: () => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Title</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          className="retro-input"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Description</span>
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          rows={4}
          className="retro-input resize-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Banner</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void uploadBrandingAsset("banner", event.target.files?.[0] ?? null)}
            className="hidden"
          />
          <span className="retro-button text-[10px] w-full justify-center cursor-pointer">
            <Upload size={12} />
            {brandingUpload === "banner" ? "Uploading" : draft.branding?.bannerUrl ? "Replace" : "Upload"}
          </span>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Avatar</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void uploadBrandingAsset("avatar", event.target.files?.[0] ?? null)}
            className="hidden"
          />
          <span className="retro-button text-[10px] w-full justify-center cursor-pointer">
            <Upload size={12} />
            {brandingUpload === "avatar" ? "Uploading" : draft.branding?.avatarUrl ? "Replace" : "Upload"}
          </span>
        </label>
      </div>
      {(safeUrl(draft.branding?.bannerUrl) || safeUrl(draft.branding?.avatarUrl)) ? (
        <button
          type="button"
          onClick={() => updateBranding({ bannerUrl: "", avatarUrl: "" })}
          className="font-mono text-[10px] uppercase font-bold transition-colors hover:text-neon-lime"
          style={{ color: "var(--text-secondary)" }}
        >
          Clear branding
        </button>
      ) : null}
      <button
        type="button"
        onClick={openAdvancedSettings}
        className="retro-button text-[10px] w-full justify-center"
      >
        <Settings2 size={13} />
        Open Advanced Form Settings <span aria-hidden="true">&gt;</span>
      </button>
    </div>
  );
}

function FieldSettings({
  field,
  index,
  fieldCount,
  updateField,
  updateOption,
  removeOption,
  addOption,
  moveField
}: {
  field: FormField;
  index: number;
  fieldCount: number;
  updateField: (fieldId: string, patch: Partial<FormField>) => void;
  updateOption: (fieldId: string, optionIndex: number, patch: Partial<FieldOption>) => void;
  removeOption: (fieldId: string, optionIndex: number) => void;
  addOption: (fieldId: string) => void;
  moveField: (fromIndex: number, toIndex: number) => void;
}) {
  const supportsPlaceholder = field.type === "short_text" || field.type === "long_text" || field.type === "rich_text" || field.type === "url";
  const isUploadField = field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload";

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Label</span>
        <input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} className="retro-input" />
      </label>
      {supportsPlaceholder ? (
        <label className="block">
          <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Placeholder</span>
          <input value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} className="retro-input" />
        </label>
      ) : null}
      {(field.type === "dropdown" || field.type === "checkboxes") && field.options ? (
        <div>
          <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Options</span>
          <div className="space-y-2">
            {field.options.map((option, optionIndex) => (
              <div key={`${field.id}-${optionIndex}`} className="flex items-center gap-2">
                <input value={option.label} onChange={(event) => updateOption(field.id, optionIndex, { label: event.target.value })} className="flex-1 retro-input" />
                <button onClick={() => removeOption(field.id, optionIndex)} className="p-1 transition-colors hover:text-red-500" style={{ color: "var(--text-muted)" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <button onClick={() => addOption(field.id)} className="font-mono text-[10px] uppercase font-bold flex items-center gap-1 transition-colors hover:text-neon-lime" style={{ color: "var(--text-secondary)" }}>
              <Plus size={12} /> Add option
            </button>
          </div>
        </div>
      ) : null}
      <label className="block">
        <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Help Text</span>
        <input value={field.helpText ?? ""} onChange={(event) => updateField(field.id, { helpText: event.target.value })} placeholder="Optional helper text" className="retro-input" />
      </label>
      {isUploadField ? (
        <>
          {field.type === "file_upload" ? (
            <label className="block">
              <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Upload Type Preset</span>
              <select
                value={detectUploadPolicyPreset(field)}
                onChange={(event) => {
                  const preset = event.target.value as UploadPolicyPreset;
                  if (preset === "image") {
                    updateField(field.id, { acceptedMimeTypes: IMAGE_MIME_PRESET });
                    return;
                  }
                  if (preset === "video") {
                    updateField(field.id, { acceptedMimeTypes: VIDEO_MIME_PRESET });
                    return;
                  }
                  updateField(field.id, { acceptedMimeTypes: [] });
                }}
                className="retro-input"
              >
                <option value="custom">Any file</option>
                <option value="image">Image only</option>
                <option value="video">Video only</option>
              </select>
            </label>
          ) : (
            <div className="border-[2px] border-retro-border px-3 py-2" style={{ background: "var(--bg-secondary)" }}>
              <span className="font-mono text-[10px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>Field Type</span>
              <span className="font-mono text-[11px]" style={{ color: "var(--text)" }}>
                {field.type === "screenshot_upload" ? "Screenshot upload" : "Video upload"}
              </span>
            </div>
          )}
          <label className="block">
            <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Allowed MIME Types</span>
            <input
              value={(field.acceptedMimeTypes ?? []).join(", ")}
              onChange={(event) =>
                updateField(field.id, {
                  acceptedMimeTypes: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                })
              }
              placeholder="image/png, image/jpeg"
              className="retro-input"
              disabled={field.type === "file_upload" && detectUploadPolicyPreset(field) !== "custom"}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Max File Size (MB)</span>
            <input
              type="number"
              min={0}
              step="1"
              value={field.maxSizeBytes ? Math.ceil(field.maxSizeBytes / (1024 * 1024)) : ""}
              onChange={(event) => {
                const mb = Number(event.target.value);
                updateField(field.id, {
                  maxSizeBytes: Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1024 * 1024) : undefined
                });
              }}
              placeholder="10"
              className="retro-input"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>Max Files</span>
            <input
              type="number"
              min={1}
              step="1"
              value={field.maxFiles && field.maxFiles > 1 ? field.maxFiles : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateField(field.id, {
                  maxFiles: Number.isFinite(value) && value > 1 ? Math.floor(value) : undefined
                });
              }}
              placeholder="1"
              className="retro-input"
            />
          </label>
        </>
      ) : null}
      <div className="flex items-center justify-between py-3 border-t-[2px] border-retro-border" style={{ borderColor: "var(--border-light)" }}>
        <span className="font-mono text-xs font-bold uppercase" style={{ color: "var(--text-secondary)" }}>Required</span>
        <button
          onClick={() => updateField(field.id, { required: !field.required })}
          className="w-10 h-5 border-[2px] border-retro-border relative transition-colors"
          style={{ background: field.required ? "var(--neon-lime)" : "var(--border-light)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
        >
          <div className="absolute top-0.5 w-3.5 h-3.5 border-[2px] border-retro-border transition-all" style={{ left: field.required ? "18px" : "2px", background: "var(--bg-card)", boxShadow: "1px 1px 0px var(--shadow-color)" }} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => moveField(index, index - 1)} disabled={index === 0} className="retro-button text-[10px] justify-center disabled:opacity-40">Move Up</button>
        <button type="button" onClick={() => moveField(index, index + 1)} disabled={index === fieldCount - 1} className="retro-button text-[10px] justify-center disabled:opacity-40">Move Down</button>
      </div>
    </div>
  );
}

function uploadHintFor(field: FormField): string {
  const typeHint = (field.acceptedMimeTypes?.length ?? 0) > 0
    ? field.acceptedMimeTypes!.join(", ")
    : field.type === "screenshot_upload"
      ? "PNG, JPG, GIF, or WebP"
      : field.type === "video_upload"
        ? "MP4, WebM, MOV, or other video"
        : "Any file type";
  const sizeHint = field.maxSizeBytes && field.maxSizeBytes > 0
    ? ` • max ${Math.ceil(field.maxSizeBytes / (1024 * 1024))}MB`
    : "";
  const countHint = field.maxFiles && field.maxFiles > 1
    ? ` • up to ${field.maxFiles} files`
    : "";
  return `${typeHint}${sizeHint}${countHint}`;
}

function FieldRenderer({ field, preview }: { field: FormField; preview: boolean }) {
  // Wrapper matches the public form's FieldShell
  const shell = (children: ReactNode) => (
    <div className="p-0">
      <label className="font-mono text-[11px] font-bold uppercase tracking-wide mb-1 block" style={{ color: "var(--text)" }}>
        {field.label}
        {field.required ? <span className="ml-1" style={{ color: "#FF00FF" }}>*</span> : null}
      </label>
      {field.helpText ? (
        <p className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>{field.helpText}</p>
      ) : (
        <div className="mb-2" />
      )}
      {children}
    </div>
  );

  const inputClasses = "w-full font-mono text-xs px-3 py-2.5 border-[3px] border-retro-border transition-all focus:outline-none focus:border-neon-lime placeholder:opacity-50";
  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" };

  if (field.type === "short_text") {
    return shell(
      <input readOnly={!preview} placeholder={field.placeholder || "Type your answer…"} className={inputClasses} style={inputStyle} />
    );
  }
  if (field.type === "long_text") {
    return shell(
      <textarea readOnly={!preview} placeholder={field.placeholder || "Type your answer…"} rows={4} className={`${inputClasses} resize-none`} style={inputStyle} />
    );
  }
  if (field.type === "rich_text") {
    return shell(
      <div>
        <div className="flex items-center gap-1 border-[3px] border-retro-border border-b-0 p-1" style={{ background: "var(--bg-secondary)" }}>
          {[Bold, Italic, List, Link2].map((Icon, index) => (
            <span key={index} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border" style={{ color: "var(--text-muted)" }}>
              <Icon size={13} />
            </span>
          ))}
        </div>
        <div className={`${inputClasses} min-h-[128px]`} style={inputStyle}>
          <p style={{ color: "var(--text-muted)", opacity: 0.5 }}>{field.placeholder || "Write formatted text..."}</p>
          <p><strong>Bold</strong>, <em>italic</em>, lists, and links are supported.</p>
        </div>
      </div>
    );
  }
  if (field.type === "dropdown") {
    return shell(
      <div className="space-y-3">
        <div className="relative">
          <select disabled={!preview} defaultValue="" className={`${inputClasses} appearance-none cursor-pointer pr-9`} style={inputStyle}>
            <option value="" disabled>Select an option…</option>
            {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
        {(field.options ?? []).some((option) => option.value === "other") ? (
          <input
            readOnly
            placeholder="If Other is selected, the submitter can type a custom answer"
            className={inputClasses}
            style={inputStyle}
          />
        ) : null}
      </div>
    );
  }
  if (field.type === "checkboxes") {
    return shell(
      <div className="space-y-2">
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="checkbox-option flex items-center gap-3 px-3 py-2 border-[2px] border-retro-border cursor-pointer transition-all hover:border-neon-lime hover:-translate-y-px" style={{ background: "var(--bg-secondary)", boxShadow: "1px 1px 0px var(--shadow-color)" }}>
            <input type="checkbox" disabled={!preview} className="sr-only" />
            <span className="checkbox-indicator w-4.5 h-4.5 border-[2px] border-retro-border flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-card)" }} />
            <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "star_rating") {
    return shell(
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={30} strokeWidth={2} fill="#FFFF00" stroke="#FFFF00" style={{ opacity: star <= 3 ? 1 : 0.3 }} />
        ))}
        <span className="font-mono text-[10px] font-bold ml-2 self-center" style={{ color: "var(--text-muted)" }}>3/5</span>
      </div>
    );
  }
  if (field.type === "confirmation") {
    return (
      <div className="p-0">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" disabled={!preview} className="sr-only" />
          <span className="w-5 h-5 border-[3px] border-retro-border flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: "var(--bg-secondary)" }} />
          <span>
            <span className="font-mono text-xs font-bold" style={{ color: "var(--text)" }}>{field.label}</span>
            {field.required ? <span className="ml-1" style={{ color: "#FF00FF" }}>*</span> : null}
            {field.helpText ? <p className="font-mono text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{field.helpText}</p> : null}
          </span>
        </label>
      </div>
    );
  }
  if (field.type === "url") {
    return shell(
      <div className="relative">
        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        <input readOnly={!preview} type="url" placeholder="https://example.com" className={`${inputClasses} pl-9`} style={inputStyle} />
      </div>
    );
  }
  if (field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload") {
    const Icon = field.type === "screenshot_upload" ? Image : field.type === "video_upload" ? Video : Upload;
    return shell(
      <div className="border-[3px] border-dashed border-retro-border p-6 text-center cursor-pointer transition-all hover:border-neon-lime hover:-translate-y-px" style={{ background: "var(--bg-secondary)" }}>
        <Icon size={24} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
        <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>Click to upload or drag and drop</p>
        <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>{uploadHintFor(field)}</p>
      </div>
    );
  }

  return null;
}
