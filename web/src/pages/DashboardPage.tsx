import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import TopNav from "../components/TopNav";
import SiteFooter from "../components/SiteFooter";
import { formrusPackageIds } from "../lib/config";
import { SkeletonCard } from "../components/Skeleton";
import {
  CheckCircle2,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Send,
  Wallet,
  X,
} from "lucide-react";
import { asRecord, formatTime, mistToSui, parseFormFields, normalizeSuiAddress, readAddressSet, shorten } from "../lib/utils";
import { normalizeDna } from "../lib/crypto";
import { cacheGet, cacheSet, formEventsCacheKey, blobCacheKey, TTL_EVENTS, TTL_BLOB } from "../lib/cache";
import { fetchWalrusJson } from "../lib/walrusRead";
import type { FormDraft } from "../types/form";
import { translateError } from "../lib/errors";

interface FormEventRow {
  formId: string;
  creator: string;
  schemaBlobId: string;
  actionType: number;
  rewardAmount: string;
  createdAtMs: string;
  txDigest: string;
  role: "owner" | "admin" | "viewer";
  active: boolean;
  packageId: string;
  isLegacy: boolean;
}

type FormTypeFilter = "all" | "reward" | "basic";
type PackageFilter = "all" | "current" | "legacy";
type AccessFilter = "all" | "owner" | "admin" | "viewer";
type StatusFilter = "all" | "active" | "paused";
type GuidePlacement = "top" | "right" | "bottom" | "left" | "center";
type SchemaBlobState = "ok" | "missing";

const EVENT_PAGE_LIMIT = 50;
const EVENT_PAGE_CAP = 20;
const DASHBOARD_GUIDE_DISMISSED_KEY = "dashboard_guide_dismissed_v2";

function packageIdFromType(type: unknown): string {
  const raw = typeof type === "string" ? type : "";
  const [pkg] = raw.split("::");
  return pkg ?? "";
}

export function DashboardPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const searchControlsRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const managedFormsRef = useRef<HTMLDivElement | null>(null);

  const [filter, setFilter] = useState<FormTypeFilter>("all");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draftFilter, setDraftFilter] = useState<FormTypeFilter>("all");
  const [draftPackageFilter, setDraftPackageFilter] = useState<PackageFilter>("all");
  const [draftAccessFilter, setDraftAccessFilter] = useState<AccessFilter>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forms, setForms] = useState<FormEventRow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingForms, setLoadingForms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTitles, setFormTitles] = useState<Record<string, string>>({});
  const [schemaBlobState, setSchemaBlobState] = useState<Record<string, SchemaBlobState>>({});
  const [visibleCount, setVisibleCount] = useState(12);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideDismissForever, setGuideDismissForever] = useState(false);

  const queryAllEvents = useCallback(async (query: { Sender: string } | { MoveEventType: string }) => {
    const events: any[] = [];
    let cursor: any = null;

    for (let i = 0; i < EVENT_PAGE_CAP; i += 1) {
      const page = await client.queryEvents({
        query,
        cursor,
        limit: EVENT_PAGE_LIMIT,
        order: "descending"
      });
      events.push(...page.data);
      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    return events;
  }, [client]);

  const loadForms = useCallback(async (force = false) => {
    if (!account?.address) return;

    const cacheKey = formEventsCacheKey(account.address);

    if (!force) {
      const cached = cacheGet<FormEventRow[]>(cacheKey);
      if (cached) {
        setForms(cached);
        setLoadingForms(false);
        void fetchFormTitles(cached);
        return;
      }
    }

    setLoadingForms(true);
    setError(null);

    try {
      const connected = normalizeSuiAddress(account.address);
      const formIds = new Set<string>();
      const formPackages = new Map<string, string>();

      const bySender = await queryAllEvents({ Sender: connected });
      bySender.forEach((event) => {
        if (!event.type.endsWith("::FormRegistered")) return;
        const id = String(asRecord(event.parsedJson).form_id || "");
        if (!id) return;
        formIds.add(id);
        formPackages.set(id, packageIdFromType(event.type));
      });

      await Promise.all(formrusPackageIds.map(async (pkgId) => {
        const typePrefix = `${pkgId}::registry::`;
        const [latest, roles, transfers] = await Promise.all([
          queryAllEvents({ MoveEventType: `${typePrefix}FormRegistered` }),
          queryAllEvents({ MoveEventType: `${typePrefix}FormRoleChanged` }),
          queryAllEvents({ MoveEventType: `${typePrefix}CreatorTransferred` }),
        ]);

        latest.forEach((event) => {
          const parsed = asRecord(event.parsedJson);
          const creator = normalizeSuiAddress(String(parsed.creator || ""));
          const admins = readAddressSet(parsed.admins);
          const viewers = readAddressSet(parsed.viewers);
          if (creator !== connected && !admins.includes(connected) && !viewers.includes(connected)) return;
          const id = String(parsed.form_id || "");
          if (!id) return;
          formIds.add(id);
          formPackages.set(id, pkgId);
        });

        roles.forEach((event) => {
          const parsed = asRecord(event.parsedJson);
          const wallet = normalizeSuiAddress(String(parsed.wallet || ""));
          if (wallet !== connected) return;
          const id = String(parsed.form_id || "");
          if (!id) return;
          formIds.add(id);
          formPackages.set(id, pkgId);
        });

        transfers.forEach((event) => {
          const parsed = asRecord(event.parsedJson);
          const newCreator = normalizeSuiAddress(String(parsed.new_creator || ""));
          if (newCreator !== connected) return;
          const id = String(parsed.form_id || "");
          if (!id) return;
          formIds.add(id);
          formPackages.set(id, pkgId);
        });
      }));

      if (formIds.size === 0) {
        setForms([]);
        setLoadingForms(false);
        return;
      }

      const objects = await client.multiGetObjects({
        ids: Array.from(formIds),
        options: { showContent: true }
      });

      const collected: FormEventRow[] = [];
      for (const obj of objects) {
        if (!obj.data?.content || obj.data.content.dataType !== "moveObject") continue;
        try {
          const state = parseFormFields(obj.data.content, normalizeDna);
          const role = state.creator.toLowerCase() === connected
            ? "owner"
            : state.admins.some((a) => a.toLowerCase() === connected)
              ? "admin"
              : state.viewers.some((v) => v.toLowerCase() === connected)
                ? "viewer"
                : null;

          if (!role) continue;

          const packageId =
            formPackages.get(obj.data.objectId) ||
            packageIdFromType(obj.data.type) ||
            packageIdFromType((obj.data.content as { type?: string } | null)?.type);

          collected.push({
            formId: obj.data.objectId,
            creator: state.creator,
            schemaBlobId: state.schemaBlobId,
            actionType: state.actionType,
            rewardAmount: String(state.rewardAmountMist),
            createdAtMs: state.createdAtMs,
            txDigest: obj.data.digest,
            role,
            active: state.active,
            packageId,
            isLegacy: Boolean(packageId && formrusPackageIds[0] && packageId !== formrusPackageIds[0])
          });
        } catch {
          // Skip invalid objects
        }
      }

      collected.sort((a, b) => Number(b.createdAtMs) - Number(a.createdAtMs));
      setForms(collected);
      cacheSet(cacheKey, collected, TTL_EVENTS);
      void fetchFormTitles(collected);
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setLoadingForms(false);
    }
  }, [account?.address, queryAllEvents]);

  useEffect(() => {
    if (!account?.address || formrusPackageIds.length === 0) return;
    void loadForms();
  }, [account?.address, loadForms]);

  useEffect(() => {
    setDraftFilter(filter);
    setDraftPackageFilter(packageFilter);
    setDraftAccessFilter(accessFilter);
    setDraftStatusFilter(statusFilter);
  }, [filter, packageFilter, accessFilter, statusFilter]);

  useEffect(() => {
    if (!account?.address) {
      setShowGuide(false);
      return;
    }

    try {
      const dismissed = localStorage.getItem(DASHBOARD_GUIDE_DISMISSED_KEY);
      if (!dismissed) {
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

  async function fetchFormTitles(formList: FormEventRow[]) {
    const titles: Record<string, string> = {};
    const blobState: Record<string, SchemaBlobState> = {};
    await Promise.allSettled(
      formList.map(async (form) => {
        try {
          const cached = cacheGet<string>(blobCacheKey(`title_${form.schemaBlobId}`));
          if (cached) {
            titles[form.formId] = cached;
            blobState[form.formId] = "ok";
            return;
          }
          const schema = await fetchWalrusJson<FormDraft>(form.schemaBlobId);
          if (!schema.title) return;
          titles[form.formId] = schema.title;
          blobState[form.formId] = "ok";
          cacheSet(blobCacheKey(`title_${form.schemaBlobId}`), schema.title, TTL_BLOB);
        } catch {
          blobState[form.formId] = "missing";
        }
      })
    );

    if (Object.keys(titles).length > 0) {
      setFormTitles((prev) => ({ ...prev, ...titles }));
    }
    if (Object.keys(blobState).length > 0) {
      setSchemaBlobState((prev) => ({ ...prev, ...blobState }));
    }
  }

  const filteredForms = forms.filter((form) => {
    if (filter === "reward" && form.actionType !== 1) return false;
    if (filter === "basic" && form.actionType === 1) return false;
    if (packageFilter === "legacy" && !form.isLegacy) return false;
    if (packageFilter === "current" && form.isLegacy) return false;
    if (accessFilter !== "all" && form.role !== accessFilter) return false;
    if (statusFilter === "active" && !form.active) return false;
    if (statusFilter === "paused" && form.active) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      form.formId.toLowerCase().includes(q) ||
      form.schemaBlobId.toLowerCase().includes(q) ||
      form.creator.toLowerCase().includes(q) ||
      (formTitles[form.formId] ?? "").toLowerCase().includes(q)
    );
  });

  const rewardForms = forms.filter((form) => form.actionType === 1);
  const totalRewardMist = rewardForms.reduce((sum, form) => sum + Number(form.rewardAmount || 0), 0);
  const ownedCount = forms.filter((form) => form.role === "owner").length;
  const legacyCount = forms.filter((form) => form.isLegacy).length;

  const metrics = [
    { label: "Total Forms", value: String(forms.length), icon: FileText, color: "#39FF14" },
    { label: "Reward Forms", value: String(rewardForms.length), icon: CheckCircle2, color: "#00FFFF" },
    { label: "You Own", value: String(ownedCount), icon: Wallet, color: "#FF00FF" },
    { label: "Legacy Forms", value: String(legacyCount), icon: Send, color: "#FFFF00" },
  ];

  const hasActiveFilters = filter !== "all" || packageFilter !== "all" || accessFilter !== "all" || statusFilter !== "all";
  const guideSteps: GuideStep[] = [
    {
      title: "Workspace Snapshot",
      body: "This is the operating summary for your workspace: total forms, reward exposure, ownership count, and current versus legacy deployments.",
      target: workspaceRef.current,
      placement: "bottom",
    },
    {
      title: "Create Entry Point",
      body: "Use Create Form to start from blank or open a template. This is the cleanest path into the builder.",
      target: createButtonRef.current,
      placement: "left",
    },
    {
      title: "Search And Filter",
      body: "Search matches title, object id, blob id, and creator. Use this before opening individual form workspaces.",
      target: searchControlsRef.current,
      placement: "bottom",
    },
    {
      title: "Filter Toggles",
      body: "Slice the workspace by reward/basic, current/legacy package, or your role on the form without leaving the page.",
      target: filterButtonRef.current,
      placement: "left",
    },
    {
      title: "Managed Forms",
      body: "Every card is a jump into a live manage workspace where you review responses, links, permissions, and form controls.",
      target: managedFormsRef.current,
      placement: "right",
    },
  ];

  useEffect(() => {
    if (!showGuide) {
      setShowFilterMenu(false);
      return;
    }
    setShowFilterMenu(guideStep === 3);
  }, [guideStep, showGuide]);

  function closeGuide(remember: boolean) {
    if (remember) {
      try {
        localStorage.setItem(DASHBOARD_GUIDE_DISMISSED_KEY, "1");
      } catch {
        // Ignore storage failures
      }
    }
    setShowGuide(false);
    setGuideStep(0);
    setGuideDismissForever(false);
    setShowFilterMenu(false);
  }

  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      <TopNav />

      <div className="pt-24 pb-12 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto">
        {error ? (
          <div className="border-[3px] border-retro-border p-4 mb-6 font-mono text-xs" style={{ background: "var(--bg-card)", color: "#FF69B4", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline hover:text-neon-lime">dismiss</button>
          </div>
        ) : null}

        {!account?.address ? (
          <div className="border-[3px] border-retro-border p-5 mb-8" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
            <div className="flex items-center gap-3">
              <Wallet size={20} style={{ color: "var(--neon-lime)" }} />
              <p className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>Connect your wallet to load forms.</p>
            </div>
          </div>
        ) : null}

        {account?.address ? (
          <section ref={workspaceRef} className="border-[3px] border-retro-border p-5 md:p-6 mb-6" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}>
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 border-[2px] border-retro-border px-2.5 py-1 mb-4" style={{ background: "var(--bg-secondary)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: loadingForms ? "#FFFF00" : "var(--neon-lime)" }} />
                  <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>
                    {loadingForms ? "Refreshing workspace" : "Operations workspace"}
                  </span>
                </div>
                <h1 className="font-mono font-bold text-2xl md:text-4xl uppercase tracking-tight mb-3" style={{ color: "var(--text)" }}>
                  Form Operations Dashboard
                </h1>
                <p className="font-mono text-xs md:text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Review every form you own or operate, separate current deployments from legacy ones, and move directly into response management without burying the important chain state.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void loadForms(true)} disabled={!account?.address || loadingForms} className="retro-button text-xs disabled:opacity-50">
                  <RefreshCw size={16} strokeWidth={2.5} />
                  Refresh
                </button>
                <button ref={createButtonRef} onClick={() => setShowCreateModal(true)} className="retro-button-neon text-xs" style={{ backgroundColor: "#39FF14", color: "#000" }}>
                  <Plus size={16} strokeWidth={2.5} />
                  Create Form
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_20rem] gap-4 mt-6">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className="border-[3px] border-retro-border p-4" style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{metric.label}</span>
                        <span className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border" style={{ backgroundColor: metric.color }}>
                          <Icon size={14} color="#000" strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="font-mono font-bold text-xl" style={{ color: "var(--text)" }}>{metric.value}</div>
                    </div>
                  );
                })}
              </div>

              <div className="border-[3px] border-retro-border p-4" style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
                <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Configured Rewards</div>
                <div className="font-mono font-bold text-2xl mb-2" style={{ color: "var(--text)" }}>
                  {forms.length > 0 ? `${mistToSui(totalRewardMist)} SUI` : "—"}
                </div>
                <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Total configured reward amount across visible reward forms. Use the legacy tag to distinguish newer deployments from historical ones.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {account?.address ? (
          <section className="grid xl:grid-cols-[minmax(0,1fr)_19rem] gap-6">
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h2 className="font-mono font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text)" }}>Managed Forms</h2>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {filteredForms.length} result{filteredForms.length === 1 ? "" : "s"} in the current view.
                  </p>
                </div>
                <div ref={searchControlsRef} className="w-full lg:w-[34rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search title, object, blob, creator..."
                        className="retro-input text-[10px] pl-8 w-full"
                        style={{ padding: "8px 10px 8px 28px", boxShadow: "4px 4px 0px var(--shadow-color)" }}
                      />
                    </div>
                    <div className="relative">
                      <button
                        ref={filterButtonRef}
                        type="button"
                        onClick={() => setShowFilterMenu((prev) => !prev)}
                        className="w-11 h-11 border-[3px] border-retro-border flex items-center justify-center"
                        style={{
                          background: showFilterMenu ? "var(--code-bg)" : "var(--bg-card)",
                          borderColor: showFilterMenu ? "var(--neon-lime)" : "var(--border-color)",
                          boxShadow: showFilterMenu ? "6px 6px 0px var(--shadow-color)" : "4px 4px 0px var(--shadow-color)"
                        }}
                        aria-label="Open filters"
                        aria-expanded={showFilterMenu}
                      >
                        <Filter size={15} style={{ color: showFilterMenu ? "var(--neon-lime)" : "var(--text-secondary)" }} />
                      </button>
                      {showFilterMenu ? (
                        <div
                          className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(20rem,calc(100vw-2rem))] sm:w-80 border-[3px] border-retro-border p-3 z-20"
                          style={{ background: "var(--bg-card)", boxShadow: "8px 8px 0px var(--shadow-color)" }}
                        >
                          <div className="absolute -top-3 right-4 w-5 h-5 border-l-[3px] border-t-[3px] border-retro-border rotate-45" style={{ background: "var(--bg-card)" }} />
                          <div className="relative flex items-center justify-between gap-3 mb-3">
                            <div>
                              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--neon-lime)" }}>
                                Filters Open
                              </div>
                              <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                                Narrow the workspace before opening forms.
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowFilterMenu(false)}
                              className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border"
                              style={{ background: "var(--bg-secondary)", boxShadow: "1px 1px 0px var(--shadow-color)" }}
                              aria-label="Close filters"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <FilterChoiceGroup
                            label="Form Type"
                            value={draftFilter}
                            onChange={(value) => setDraftFilter(value as FormTypeFilter)}
                            options={[
                              { value: "all", label: "All forms" },
                              { value: "reward", label: "Reward only" },
                              { value: "basic", label: "Basic only" },
                            ]}
                          />
                          <FilterChoiceGroup
                            label="Package"
                            value={draftPackageFilter}
                            onChange={(value) => setDraftPackageFilter(value as PackageFilter)}
                            options={[
                              { value: "all", label: "All packages" },
                              { value: "current", label: "Current" },
                              { value: "legacy", label: "Legacy" },
                            ]}
                          />
                          <FilterChoiceGroup
                            label="Access"
                            value={draftAccessFilter}
                            onChange={(value) => setDraftAccessFilter(value as AccessFilter)}
                            options={[
                              { value: "all", label: "All access" },
                              { value: "owner", label: "Owner" },
                              { value: "admin", label: "Admin" },
                              { value: "viewer", label: "Viewer" },
                            ]}
                          />
                          <FilterChoiceGroup
                            label="Status"
                            value={draftStatusFilter}
                            onChange={(value) => setDraftStatusFilter(value as StatusFilter)}
                            options={[
                              { value: "all", label: "All status" },
                              { value: "active", label: "Active" },
                              { value: "paused", label: "Paused" },
                            ]}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFilter(draftFilter);
                                setPackageFilter(draftPackageFilter);
                                setAccessFilter(draftAccessFilter);
                                setStatusFilter(draftStatusFilter);
                                setShowFilterMenu(false);
                              }}
                              className="retro-button text-[10px] flex-1 justify-center"
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraftFilter("all");
                                setDraftPackageFilter("all");
                                setDraftAccessFilter("all");
                                setDraftStatusFilter("all");
                                setFilter("all");
                                setPackageFilter("all");
                                setAccessFilter("all");
                                setStatusFilter("all");
                                setShowFilterMenu(false);
                              }}
                              className="retro-button text-[10px] flex-1 justify-center"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => void loadForms(true)} disabled={!account?.address || loadingForms} className="retro-button text-[10px] disabled:opacity-50">
                      <RefreshCw size={14} strokeWidth={2.5} />
                      Refresh
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="retro-button-neon text-[10px]" style={{ backgroundColor: "#39FF14", color: "#000" }}>
                      <Plus size={14} strokeWidth={2.5} />
                      Create
                    </button>
                  </div>
                  {hasActiveFilters ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {filter !== "all" ? <ActiveFilterTag label={`Type: ${filter}`} /> : null}
                      {packageFilter !== "all" ? <ActiveFilterTag label={`Package: ${packageFilter}`} /> : null}
                      {accessFilter !== "all" ? <ActiveFilterTag label={`Access: ${accessFilter}`} /> : null}
                      {statusFilter !== "all" ? <ActiveFilterTag label={`Status: ${statusFilter}`} /> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {loadingForms ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : null}

              {!loadingForms && filteredForms.length === 0 ? (
                <div className="border-[3px] border-retro-border p-6 text-center font-mono text-xs" style={{ background: "var(--bg-card)", color: "var(--text-muted)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                  {forms.length === 0
                    ? "No forms found for this wallet. Create one to get started."
                    : "No forms match your filter."}
                </div>
              ) : null}

              <div ref={managedFormsRef} className="space-y-3">
              {filteredForms.slice(0, visibleCount).map((form) => (
                <div
                  key={`${form.txDigest}-${form.formId}`}
                  className="block border-[3px] border-retro-border p-4 md:p-5"
                  style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="w-9 h-9 flex items-center justify-center border-[3px] border-retro-border" style={{ backgroundColor: form.actionType === 1 ? "#39FF14" : "#00FFFF", boxShadow: "2px 2px 0px var(--shadow-color)" }}>
                          <FileText size={15} color="#000" strokeWidth={2.5} />
                        </span>
                        <h3 className="font-mono font-bold text-sm uppercase tracking-wide truncate" style={{ color: "var(--text)" }}>
                          {formTitles[form.formId] ?? "Untitled Form"}
                        </h3>
                        <span className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border" style={{ background: form.actionType === 1 ? "var(--neon-lime)" : "var(--bg-secondary)", color: form.actionType === 1 ? "#000" : "var(--text-muted)" }}>
                          {form.actionType === 1 ? "reward" : "basic"}
                        </span>
                        <span className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border" style={{ background: form.role === "owner" ? "var(--neon-cyan)" : "var(--bg-secondary)", color: form.role === "owner" ? "#000" : "var(--text-muted)" }}>
                          {form.role}
                        </span>
                        <span className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border" style={{ background: form.active ? "var(--neon-lime)" : "#FF69B4", color: "#000" }}>
                          {form.active ? "active" : "paused"}
                        </span>
                        <span
                          className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border"
                          style={{ background: schemaBlobState[form.formId] === "missing" ? "#FF69B4" : "var(--bg-secondary)", color: schemaBlobState[form.formId] === "missing" ? "#000" : "var(--text-muted)" }}
                        >
                          {schemaBlobState[form.formId] === "missing" ? "schema missing/expired" : "schema ok"}
                        </span>
                        {form.isLegacy ? (
                          <span className="font-mono text-[10px] uppercase px-2 py-1 border-[2px] border-retro-border" style={{ background: "#FF69B4", color: "#000" }}>
                            legacy
                          </span>
                        ) : null}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 font-mono text-[10px]">
                        <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                          <div style={{ color: "var(--text-muted)" }}>Form Object</div>
                          <div className="mt-1 break-all" style={{ color: "var(--text)" }}>{form.formId}</div>
                        </div>
                        <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                          <div style={{ color: "var(--text-muted)" }}>Schema Blob</div>
                          <div className="mt-1 break-all" style={{ color: "var(--text)" }}>{form.schemaBlobId}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap mt-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                        <span>Created {formatTime(form.createdAtMs)}</span>
                        {form.actionType === 1 ? <span style={{ color: "var(--neon-lime)" }}>Reward {mistToSui(form.rewardAmount)} SUI</span> : null}
                        <span>Creator {shorten(form.creator, 10, 8)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 flex-shrink-0">
                      <Link
                        to={`/view/${form.formId}`}
                        target="_blank"
                        rel="noopener"
                        className="retro-button-neon text-[10px] justify-center sm:min-w-[9rem]"
                        style={{ backgroundColor: "#39FF14", color: "#000" }}
                      >
                        Open Form
                      </Link>
                      <Link
                        to={`/dashboard/forms/${form.formId}`}
                        className="retro-button text-[10px] justify-center sm:min-w-[9rem]"
                      >
                        Manage Form
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {!loadingForms && filteredForms.length > visibleCount ? (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="w-full py-3 border-[3px] border-dashed border-retro-border font-mono text-xs uppercase transition-colors hover:border-neon-lime flex items-center justify-center gap-2"
                  style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
                >
                  Show more ({filteredForms.length - visibleCount} remaining)
                </button>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="border-[3px] border-retro-border p-4" style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}>
                <h3 className="font-mono font-bold text-xs uppercase mb-3" style={{ color: "var(--text)" }}>Workspace Notes</h3>
                <div className="space-y-3 font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                    Current package deployments appear without the legacy tag.
                  </div>
                  <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                    Legacy tags mark forms discovered through older package ids configured in the client.
                  </div>
                  <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                    Open a form to review response history, export records, and perform administrative actions.
                  </div>
                </div>
              </div>
            </aside>
          </section>
        ) : null}

        <SiteFooter />
      </div>

      {showCreateModal ? <CreateFormModal onClose={() => setShowCreateModal(false)} /> : null}
      {showGuide ? (
        <DashboardGuideOverlay
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
    </div>
  );
}

interface GuideStep {
  title: string;
  body: string;
  target: HTMLElement | null;
  placement: GuidePlacement;
}

function DashboardGuideOverlay({
  steps,
  stepIndex,
  dismissForever,
  onDismissForeverChange,
  onClose,
  onNext,
  onBack,
}: {
  steps: GuideStep[];
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
              Dashboard Guide {stepIndex + 1}/{steps.length}
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

function computeGuideCardStyle(targetRect: DOMRect | null, placement: GuidePlacement): React.CSSProperties {
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

  if (placement === "right") {
    return { top: clampTop(targetRect.top), left: clampLeft(targetRect.right + gutter) };
  }
  if (placement === "left") {
    return { top: clampTop(targetRect.top), left: clampLeft(targetRect.left - cardWidth - gutter) };
  }
  if (placement === "top") {
    return { top: clampTop(targetRect.top - cardHeight - gutter), left: clampLeft(targetRect.left) };
  }

  return { top: clampTop(targetRect.bottom + gutter), left: clampLeft(targetRect.left) };
}

function FilterChoiceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="mb-3">
      <span className="font-mono text-[10px] uppercase mb-1.5 block" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className="inline-flex items-center gap-2 px-2.5 py-2 border-[2px] border-retro-border text-left transition-all duration-150 hover:border-neon-lime"
              style={{
                background: active ? "var(--code-bg)" : "var(--bg-secondary)",
                boxShadow: active ? "2px 2px 0px var(--shadow-color)" : "1px 1px 0px var(--shadow-color)",
                borderColor: active ? "var(--neon-lime)" : "var(--border-color)",
              }}
            >
              <span
                className="w-3.5 h-3.5 border-[2px] border-retro-border flex items-center justify-center flex-shrink-0"
                style={{ background: active ? "var(--neon-lime)" : "transparent" }}
              >
                {active ? <span className="w-1.5 h-1.5" style={{ background: "#000" }} /> : null}
              </span>
              <span className="font-mono text-[10px] uppercase font-bold whitespace-nowrap" style={{ color: "var(--text)" }}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveFilterTag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 border-[2px] border-retro-border px-2 py-1 font-mono text-[10px] uppercase"
      style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
    >
      <span className="w-2 h-2" style={{ background: "var(--neon-lime)" }} />
      {label}
    </span>
  );
}

function CreateFormModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const templates = [
    { id: "feedback", title: "Feedback Form", description: "Product feedback, roles, and short answers." },
    { id: "event", title: "Event Registration", description: "Attendee details and ticket type collection." },
    { id: "grant", title: "Grant Application", description: "Project summary, repo, and budget review." },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl border-[3px] border-retro-border p-4 md:p-5" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }} role="dialog" aria-modal="true" aria-label="Create Form">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-mono font-bold text-lg uppercase" style={{ color: "var(--text)" }}>Create Form</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>Start blank or use a template.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border-[2px] border-retro-border hover:border-neon-lime" style={{ boxShadow: "1px 1px 0px var(--shadow-color)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Link to="/builder" className="border-[3px] border-retro-border p-4 hover:border-neon-lime" style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
            <div className="w-9 h-9 flex items-center justify-center border-[3px] border-retro-border mb-3" style={{ backgroundColor: "#39FF14" }}>
              <Plus size={16} color="#000" />
            </div>
            <h3 className="font-mono font-bold text-xs uppercase mb-2" style={{ color: "var(--text)" }}>Start Blank</h3>
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Build your own programmable form from scratch.</p>
          </Link>

          {templates.map((template) => (
            <Link key={template.id} to={`/builder?template=${template.id}`} className="border-[3px] border-retro-border p-4 hover:border-neon-lime" style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
              <div className="w-9 h-9 flex items-center justify-center border-[3px] border-retro-border mb-3" style={{ backgroundColor: "#00FFFF" }}>
                <FileText size={16} color="#000" />
              </div>
              <h3 className="font-mono font-bold text-xs uppercase mb-2" style={{ color: "var(--text)" }}>{template.title}</h3>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{template.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
