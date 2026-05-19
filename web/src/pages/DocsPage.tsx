import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import SiteFooter from "../components/SiteFooter";

function DocCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-[2px] border-retro-border p-4 md:p-5" style={{ background: "var(--bg-secondary)" }}>
      <h3 className="font-mono font-bold text-xs uppercase mb-3" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      <div className="space-y-3 font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

function DocList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span style={{ color: "var(--text)" }}>[+]</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const sections = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "What Formrus Is",
    title: "Overview",
    summary: "High-level product model, main surfaces, and why the stack is split across Sui, Walrus, and Seal.",
    content: (
      <div className="space-y-4">
        <DocCard title="Platform Purpose">
          <p>Formrus is an on-chain form platform for teams that want form ownership, submission gating, and reward logic enforced by contracts instead of a backend database they fully trust by convention.</p>
          <p>The product combines three responsibilities: Sui stores state and role permissions, Walrus stores large JSON and file payloads, and Seal handles encrypted response storage for private workflows.</p>
        </DocCard>
        <DocCard title="Core User Flows">
          <DocList
            items={[
              "Builders define a schema, response policy, reward rules, eligibility rules, and visibility model in the browser.",
              "Publishing uploads the schema to Walrus and registers an on-chain Form object that becomes the canonical runtime configuration.",
              "Respondents submit through a public page or an embeddable runtime without a mandatory centralized app server.",
              "Operators manage forms, review responses, decrypt private submissions, top up reward pools, and rotate settings from the dashboard.",
            ]}
          />
        </DocCard>
        <DocCard title="Application Surfaces">
          <DocList
            items={[
              "`/builder` is the authoring tool for schema, privacy, branding, limits, access lists, and publish actions.",
              "`/view/:formId` is the standalone public responder experience.",
              "`/embed/:formId` is the host-safe runtime for third-party embedding.",
              "`/dashboard` and `/dashboard/forms/:formId` are the operator consoles for form lifecycle, responses, and permissions.",
              "`/docs` is the internal product and implementation reference you are reading now.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "features",
    label: "Features",
    eyebrow: "Product Capability Map",
    title: "Features",
    summary: "Complete feature inventory across authoring, submissions, access control, payouts, privacy, and operations.",
    content: (
      <div className="space-y-4">
        <DocCard title="Builder Features">
          <DocList
            items={[
              "Field composer for text, rich text, dropdown, checkbox, rating, confirmation, URL, and multiple upload field variants.",
              "Branding controls for form presentation so public runtimes do not all look identical.",
              "Privacy mode selection for public versus encrypted response payloads.",
              "Eligibility configuration for controlling who can submit and under what rules.",
              "Reward and limit settings that map directly to contract-enforced behavior.",
            ]}
          />
        </DocCard>
        <DocCard title="Submission Features">
          <DocList
            items={[
              "Direct browser submission flow without an always-on application backend.",
              "Walrus-backed uploads for screenshots, files, and video attachments.",
              "Structured response envelopes so the dashboard can reconstruct answers consistently by schema version.",
              "Public runtime and embed runtime using the same underlying response pipeline.",
            ]}
          />
        </DocCard>
        <DocCard title="Operator Features">
          <DocList
            items={[
              "Dashboard visibility based on creator, admin, and viewer roles.",
              "Private response decryption for authorized wallets only.",
              "Schema blob replacement for updated forms while preserving version traceability.",
              "Pause, resume, reward updates, expiry extension, pool top-up, and drain controls.",
              "CSV/export-friendly response access for downstream analysis.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "architecture",
    label: "Architecture",
    eyebrow: "System Design",
    title: "Architecture",
    summary: "How UI, storage, contract state, encryption, and events fit together.",
    content: (
      <div className="space-y-4">
        <DocCard title="Responsibility Split">
          <DocList
            items={[
              "The web app is a static client responsible for form authoring, wallet interaction, upload orchestration, and response presentation.",
              "Sui holds the authoritative Form object and enforces mutation, submission, role, and reward logic.",
              "Walrus stores large artifacts that do not belong inside contract state, including schema JSON and submitted payload blobs.",
              "Seal is used only when a form runs in private mode and response payloads must remain unreadable without authorization.",
            ]}
          />
        </DocCard>
        <DocCard title="State Model">
          <p>The contract-level Form object acts as the control plane. It contains the form identity, creator and delegated roles, policy flags, action mode, reward details, submission caps, expiry, and the schema blob pointer that tells the UI what to render.</p>
          <p>Responses do not live directly on the Form object. Instead, accepted submissions emit response metadata and store the response payload in Walrus, which avoids putting large content directly on-chain.</p>
        </DocCard>
        <DocCard title="Operational Model">
          <p>This architecture keeps the default workflow backendless from the product point of view, but production deployments can still introduce optional infrastructure such as token-signing endpoints for authenticated Walrus publishing.</p>
          <p>The result is a thinner trust surface: the app can be hosted statically while the contract remains the source of truth for authority and acceptance logic.</p>
        </DocCard>
      </div>
    ),
  },
  {
    id: "routes",
    label: "Routes",
    eyebrow: "UI Entry Points",
    title: "Routes",
    summary: "All major routes and what responsibility each one owns.",
    content: (
      <div className="space-y-4">
        <DocCard title="Public Routes">
          <DocList
            items={[
              "`/` introduces the product and is optimized for discovery and onboarding.",
              "`/docs` is the human-readable technical and operational reference.",
              "`/view/:formId` renders a standalone public responder experience using the on-chain schema pointer.",
              "`/embed/:formId` renders an embed-safe variant for external sites or host applications.",
            ]}
          />
        </DocCard>
        <DocCard title="Authenticated and Operator Routes">
          <DocList
            items={[
              "`/builder` is where authors prepare draft configuration and publish a new form.",
              "`/dashboard` lists forms that the connected wallet can see through creator, admin, or viewer membership.",
              "`/dashboard/forms/:formId` handles per-form actions including response inspection, decryption, configuration updates, and economic operations.",
              "`/host-embed-test` exists to validate embedding behavior during development and integration testing.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "embed",
    label: "Embed Runtime",
    eyebrow: "Host Distribution",
    title: "Embed Runtime",
    summary: "How embedded form delivery works, what route it uses, and how it stays aligned with the public runtime.",
    content: (
      <div className="space-y-4">
        <DocCard title="Purpose">
          <p>The embed runtime exists for teams that want to distribute a form inside another product, landing page, campaign site, or partner application without rebuilding the submission flow from scratch.</p>
          <p>It uses `/embed/:formId` and reads the same on-chain Form object plus Walrus schema blob as the public `/view/:formId` route, so embedded and standalone distribution stay aligned by default.</p>
        </DocCard>
        <DocCard title="Behavioral Alignment">
          <DocList
            items={[
              "The same schema drives both public and embedded rendering, so field changes do not drift between channels.",
              "Eligibility checks and submission limits still come from the contract-backed form state rather than from the host page.",
              "Uploads, encryption behavior, and Walrus response storage follow the same submission pipeline used by the public runtime.",
              "Reward and active/paused checks remain contract-enforced regardless of whether the form was opened directly or inside an embed.",
            ]}
          />
        </DocCard>
        <DocCard title="Integration Notes">
          <DocList
            items={[
              "Use `/embed/:formId` when the host page needs a cleaner surface than the full public route.",
              "The project also exposes a widget script path for distribution flows that want script-based mounting rather than a raw iframe.",
              "Host wallet integration can be layered in where the embedding surface controls wallet context for the user.",
              "If the host environment restricts wallet interaction inside frames, opening the full public route remains the fallback submission path.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "schema",
    label: "Schema Model",
    eyebrow: "Form Draft Structure",
    title: "Schema Model",
    summary: "Field model, schema envelope, upload policies, and what gets stored on-chain versus in Walrus.",
    content: (
      <div className="space-y-4">
        <DocCard title="Top-Level Draft Shape">
          <p>The schema draft contains the human-facing title and description, a typed list of fields, privacy configuration, eligibility rules, reward and submission constraints, optional handler configuration, branding, and seeded access data.</p>
          <p>Once finalized, that structure is serialized to JSON and uploaded to Walrus. The resulting blob ID becomes the canonical `schema_blob_id` referenced by the contract.</p>
        </DocCard>
        <DocCard title="Supported Field Types">
          <DocList
            items={[
              "`short_text`, `long_text`, and `rich_text` for standard text capture with different display expectations.",
              "`dropdown` and `checkboxes` for constrained choices, including optional `other` capture behavior.",
              "`star_rating` and `confirmation` for lightweight structured feedback.",
              "`url` for link capture with URL-specific intent.",
              "`file_upload`, `screenshot_upload`, and `video_upload` for Walrus-backed asset submission.",
            ]}
          />
        </DocCard>
        <DocCard title="Upload Policy Details">
          <DocList
            items={[
              "Upload fields support accepted MIME types so forms can constrain what users attach.",
              "Per-field size limits control single-file payload risk before upload begins.",
              "Multi-file fields use `maxFiles` to limit count and keep downstream parsing predictable.",
              "Uploaded files are normalized into metadata objects containing filename, size, MIME type, and Walrus blob ID.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    eyebrow: "From Draft To Operations",
    title: "Lifecycle",
    summary: "End-to-end lifecycle from form creation to response handling and retirement.",
    content: (
      <div className="space-y-4">
        <DocCard title="Publish Lifecycle">
          <DocList
            items={[
              "A builder prepares the form draft locally in the browser, including schema, economics, access model, and privacy settings.",
              "Publishing uploads the schema blob to Walrus and then registers the corresponding Form object on-chain.",
              "The resulting form becomes live for responders through public and embed routes once active and not expired.",
            ]}
          />
        </DocCard>
        <DocCard title="Runtime Lifecycle">
          <DocList
            items={[
              "Responders load the schema from the blob pointer referenced by the Form object.",
              "Submissions are validated against activity status, expiry, eligibility, and any contract-side constraints before acceptance.",
              "Accepted responses emit events and store payload references so operators can retrieve them later.",
            ]}
          />
        </DocCard>
        <DocCard title="Maintenance Lifecycle">
          <DocList
            items={[
              "Operators can update roles, top up rewards, pause or resume collection, and rotate the schema blob pointer.",
              "Schema changes are versioned so old responses remain attributable to the form definition used at submission time.",
              "At end of life, creators can drain pools and deactivate forms according to the contract rules.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "pipeline",
    label: "Response Pipeline",
    eyebrow: "Submission Internals",
    title: "Response Pipeline",
    summary: "What happens from browser input through upload, encryption, contract call, and dashboard retrieval.",
    content: (
      <div className="space-y-4">
        <DocCard title="Client-Side Capture">
          <p>The public and embed runtimes gather values from browser form inputs and normalize them into a structured response object that matches the current schema version.</p>
          <p>This normalization step is important because rich input types such as multi-selects and uploads cannot be forwarded as raw DOM values if operators need consistent downstream decoding.</p>
        </DocCard>
        <DocCard title="Upload and Encryption Path">
          <DocList
            items={[
              "When a field contains file inputs, those files are uploaded to Walrus before the final response payload is assembled.",
              "The final payload references uploaded assets using metadata objects rather than embedded binary data.",
              "If the form is private, the payload is encrypted through Seal before it is uploaded to Walrus.",
              "If the form is public, the payload is stored as readable JSON without Seal encryption.",
            ]}
          />
        </DocCard>
        <DocCard title="Contract Submission Path">
          <DocList
            items={[
              "After payload upload, the client calls the relevant `submit_and_act*` entrypoint with the response blob ID.",
              "The contract performs acceptance checks and emits the response event on success.",
              "The dashboard later reads response events, fetches the corresponding blobs, and decrypts them when the connected role is allowed to do so.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "permissions",
    label: "Permissions",
    eyebrow: "Role Behavior",
    title: "Permissions",
    summary: "Who can see forms, mutate settings, decrypt responses, and manage treasury-related operations.",
    content: (
      <div className="space-y-4">
        <DocCard title="Creator Role">
          <p>The creator is the highest-authority wallet for a form. This role owns privileged lifecycle actions such as assigning delegated roles, draining funds, and performing ownership-level operations that should not be granted broadly.</p>
        </DocCard>
        <DocCard title="Admin And Viewer Roles">
          <DocList
            items={[
              "Admins can operate the form day to day, including many configuration and response-management actions.",
              "Admins can access private response decryption flows when the contract and Seal authorization allow it.",
              "Viewers can access visibility and reporting workflows without receiving mutation authority.",
              "Viewer access is useful for internal stakeholders who need read access but should not touch economics or permissions.",
            ]}
          />
        </DocCard>
        <DocCard title="Public Submitters">
          <p>Submitters do not receive a privileged role on the form. Their ability to interact is derived from the current form policy, which may consider active status, expiry, eligibility, reward conditions, and submission caps.</p>
        </DocCard>
      </div>
    ),
  },
  {
    id: "contract",
    label: "Contract Mapping",
    eyebrow: "Move API Reference",
    title: "Contract Mapping",
    summary: "Primary contract entrypoints, their intent, and how the frontend maps product actions to them.",
    content: (
      <div className="space-y-4">
        <DocCard title="Registration">
          <p>Form creation maps to `register_form`. That call binds the identity DNA, schema blob ID, policy configuration, role assignments, reward and limit rules, expiry, and any initial reward pool contribution into the on-chain Form object.</p>
        </DocCard>
        <DocCard title="Submission Entry Points">
          <DocList
            items={[
              "`submit_and_act` is the base submission path when no extra coin or object handling is required.",
              "`submit_and_act_with_sui` supports flows where the submission logic includes SUI-based interaction.",
              "`submit_and_act_with_coin` supports custom coin-driven submission behavior.",
              "`submit_and_act_with_object` supports object-based submission requirements in advanced workflows.",
            ]}
          />
        </DocCard>
        <DocCard title="Operational Entry Points">
          <DocList
            items={[
              "`set_admin` and `set_viewer` update delegated access.",
              "`top_up_pool` adds funds for reward-backed forms.",
              "`set_form_active` pauses or resumes the public submission path.",
              "`update_schema_blob_id` rotates the active schema reference after a schema change.",
              "`update_reward_amount`, `set_max_submissions`, and `extend_expiry` maintain the economics and availability window.",
              "`drain_and_deactivate` retires a form and reclaims remaining funds according to creator authority.",
            ]}
          />
        </DocCard>
        <DocCard title="Private Data Authorization">
          <p>Private response access uses `seal_approve` to bind on-chain authorization to the decryption workflow. That matters because encrypted payloads should never be readable merely because a blob URL is known.</p>
        </DocCard>
      </div>
    ),
  },
  {
    id: "env",
    label: "Environment",
    eyebrow: "Deployment Variables",
    title: "Environment",
    summary: "Required configuration for chain selection, contract addresses, Walrus endpoints, and Seal behavior.",
    content: (
      <div className="space-y-4">
        <DocCard title="Network And Contract Variables">
          <DocList
            items={[
              "`VITE_SUI_NETWORK` selects the network target used for wallet transactions and reads.",
              "`VITE_FORMRUS_PACKAGE_ID` identifies the deployed Move package the frontend should call.",
              "`VITE_FORMRUS_REGISTRY_ID` identifies the registry or shared object required for registration and lookup operations.",
            ]}
          />
        </DocCard>
        <DocCard title="Walrus Variables">
          <DocList
            items={[
              "`VITE_WALRUS_PUBLISHER_URL` points at the write endpoint used for schema and response uploads.",
              "`VITE_WALRUS_AGGREGATOR_URL` points at the read endpoint used to fetch stored blobs.",
              "`VITE_WALRUS_EPOCHS` controls intended retention horizon and should match product expectations around data availability.",
              "`VITE_WALRUS_TOKEN_ENDPOINT` is optional but useful when upload authorization should be signed server-side instead of exposed in the client.",
            ]}
          />
        </DocCard>
        <DocCard title="Seal Variables">
          <DocList
            items={[
              "`VITE_SEAL_KEY_SERVER_IDS` identifies the key server set participating in encryption and decryption.",
              "`VITE_SEAL_THRESHOLD` controls how many key servers are required for successful access.",
              "`VITE_SEAL_SESSION_TTL_MIN` controls session lifetime and affects how often operators need to re-authorize private access.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "security",
    label: "Security",
    eyebrow: "Risk Boundaries",
    title: "Security",
    summary: "Key invariants that protect identity, privacy, rewards, and auditability.",
    content: (
      <div className="space-y-4">
        <DocCard title="Core Invariants">
          <DocList
            items={[
              "DNA uniqueness prevents two forms from colliding on the same registry identity.",
              "Shared submission handlers centralize acceptance checks so public and embed paths do not drift behaviorally.",
              "Reward amount locking after the first accepted response prevents retroactive payout manipulation mid-campaign.",
              "Schema version recording preserves an audit trail between accepted responses and the schema definition active at submission time.",
            ]}
          />
        </DocCard>
        <DocCard title="Privacy Boundary">
          <p>Private forms should be treated as ciphertext-at-rest workflows. Walrus stores the encrypted response blob, while Seal plus contract authorization determine who can turn that blob back into readable data.</p>
        </DocCard>
        <DocCard title="Operational Caution">
          <p>If production deployments introduce token-signing endpoints or infrastructure around Walrus publishing, those components become part of the trust and secret-management boundary and should be hardened separately from the static frontend.</p>
        </DocCard>
      </div>
    ),
  },
  {
    id: "operations",
    label: "Operations",
    eyebrow: "Production Runbook",
    title: "Operations",
    summary: "Practical deployment notes, runtime expectations, and environment decisions for production use.",
    content: (
      <div className="space-y-4">
        <DocCard title="Recommended Production Posture">
          <DocList
            items={[
              "Use stable publisher infrastructure rather than temporary or tunnel-based endpoints whenever the form must stay reliably available.",
              "Keep contract IDs and Seal settings environment-specific so staging and production do not cross-wire data or permissions.",
              "Treat upload authorization and token-signing flows as operational secrets, not as static client constants.",
            ]}
          />
        </DocCard>
        <DocCard title="Data Retention And Cost">
          <p>`VITE_WALRUS_EPOCHS` should be chosen deliberately. A short retention window may be acceptable for test forms but is a poor default for production response data that teams expect to revisit later.</p>
        </DocCard>
        <DocCard title="Mode Selection">
          <DocList
            items={[
              "Public mode is simpler to operate and better suited to non-sensitive feedback collection.",
              "Private mode is appropriate when responses contain sensitive content and the operator team is prepared to handle decryption workflows and role management correctly.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    eyebrow: "Common Failure Modes",
    title: "Troubleshooting",
    summary: "Expected breakpoints in upload, decryption, schema updates, and multi-file response handling.",
    content: (
      <div className="space-y-4">
        <DocCard title="Upload Failures">
          <DocList
            items={[
              "Verify the publisher endpoint is reachable from the browser and not hidden behind a dead tunnel.",
              "If a token endpoint is used, confirm it returns a successful response and the browser origin is allowed.",
              "Check that field MIME type restrictions, maximum size, and file count are not rejecting the user input before upload.",
              "Confirm the configured Walrus epoch setting is valid for the target deployment.",
            ]}
          />
        </DocCard>
        <DocCard title="Private Decryption Failures">
          <DocList
            items={[
              "Verify the connected wallet actually holds creator or admin authority for the form.",
              "Check that Seal environment variables match the deployed environment rather than a different network or package.",
              "Confirm any decryption session renewal prompt was accepted and has not expired.",
            ]}
          />
        </DocCard>
        <DocCard title="Schema And Runtime Drift">
          <DocList
            items={[
              "If the public runtime shows stale fields, confirm the schema blob was updated on-chain and not just locally.",
              "Hard refresh the client after a schema rotation because cached assets or previous route state may still point at old data.",
              "If multi-file behavior looks inconsistent, inspect `maxFiles`, upload policy caps, and how the response payload is being normalized.",
            ]}
          />
        </DocCard>
      </div>
    ),
  },
  {
    id: "video",
    label: "Video",
    eyebrow: "Walkthrough Slot",
    title: "Video",
    summary: "Reserved area for a guided walkthrough once a hosted demo or onboarding recording is available.",
    content: (
      <div className="space-y-4">
        <DocCard title="Suggested Walkthrough Scope">
          <DocList
            items={[
              "Create a form in the builder and explain privacy, eligibility, and reward settings.",
              "Publish the form and show the Walrus plus contract registration sequence.",
              "Submit a response from the public page, including at least one upload field.",
              "Open the dashboard, review the response, decrypt a private submission, and run an operational action such as top-up or pause.",
            ]}
          />
        </DocCard>
        <DocCard title="Placeholder">
          <div className="space-y-3">
            <video
              className="w-full border-[2px] border-retro-border"
              controls
              preload="metadata"
              src="/videos/untitled.mp4"
            />
            <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              Direct link: <a className="underline" href="/videos/untitled.mp4" target="_blank" rel="noreferrer">/videos/untitled.mp4</a>
            </p>
          </div>
        </DocCard>
      </div>
    ),
  },
] as const;

export function DocsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0].id);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      const matchedSection = sections.find((section) => section.id === hash);
      if (matchedSection) {
        setActiveSectionId(matchedSection.id);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const activeIndex = sections.findIndex((section) => section.id === activeSection.id);

  const selectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
  };

  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      <TopNav />
      <main className="pt-24 pb-12 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto">
        <div className="mb-4 border-[3px] border-retro-border p-4 md:p-5" style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}>
          <div className="inline-flex items-center border-[2px] border-retro-border px-3 py-1.5 mb-3" style={{ background: "#00FFFF" }}>
            <h1 className="font-mono font-bold text-xs uppercase" style={{ color: "#000" }}>Formrus Docs</h1>
          </div>
          <div className="space-y-2">
            <h2 className="font-mono font-bold text-xl md:text-2xl uppercase" style={{ color: "var(--text)" }}>
              Product, contract, feature, and operations reference
            </h2>
            <p className="font-mono text-[11px] md:text-xs max-w-4xl" style={{ color: "var(--text-secondary)" }}>
              Detailed reference for product behavior, schema design, submission flow, contract operations, deployment settings, and troubleshooting.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] gap-4 md:gap-6 items-start">
          <aside
            className="hidden sm:block sm:sticky sm:top-24 h-fit border-[3px] border-retro-border p-3 md:p-4"
            style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
          >
            <p className="font-mono text-[10px] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
              Sections
            </p>
            <nav className="space-y-1.5">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section.id)}
                  className="block w-full text-left border-[2px] border-retro-border px-2.5 py-2 font-mono text-[10px] uppercase transition-colors"
                  style={{
                    background: activeSectionId === section.id ? "var(--neon-cyan)" : "var(--bg-secondary)",
                    color: activeSectionId === section.id ? "#000" : "var(--text-muted)",
                  }}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t-[2px] border-retro-border space-y-2">
              <a
                href="https://formrus.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="block border-[2px] border-retro-border px-2.5 py-2 font-mono text-[10px] uppercase"
                style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
              >
                Website
              </a>
              <a
                href="https://github.com/tejas0111/Formrus"
                target="_blank"
                rel="noopener noreferrer"
                className="block border-[2px] border-retro-border px-2.5 py-2 font-mono text-[10px] uppercase"
                style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
              >
                Repository
              </a>
            </div>
          </aside>

          <section
            className="border-[3px] border-retro-border p-4 md:p-6 space-y-4"
            style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
          >
            <div className="sm:hidden border-[2px] border-retro-border p-3 space-y-3" style={{ background: "var(--bg-secondary)" }}>
              <label htmlFor="docs-section-select" className="block font-mono text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Jump to section
              </label>
              <select
                id="docs-section-select"
                value={activeSectionId}
                onChange={(event) => selectSection(event.target.value)}
                className="retro-select text-[11px]"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-[2px] border-retro-border p-3 md:p-4" style={{ background: "var(--bg-secondary)" }}>
              <p className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                {activeSection.eyebrow}
              </p>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                  <h2 className="font-mono font-bold text-lg md:text-xl uppercase" style={{ color: "var(--text)" }}>
                    {activeSection.title}
                  </h2>
                  <p className="font-mono text-[11px] md:text-xs max-w-3xl" style={{ color: "var(--text-secondary)" }}>
                    {activeSection.summary}
                  </p>
                </div>
                <p className="font-mono text-[10px] uppercase shrink-0" style={{ color: "var(--text-muted)" }}>
                  {activeIndex + 1} / {sections.length}
                </p>
              </div>
            </div>

            <div className="sm:hidden grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectSection(sections[Math.max(0, activeIndex - 1)].id)}
                disabled={activeIndex === 0}
                className="border-[2px] border-retro-border px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-50"
                style={{ background: "var(--bg-secondary)", color: "var(--text)" }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => selectSection(sections[Math.min(sections.length - 1, activeIndex + 1)].id)}
                disabled={activeIndex === sections.length - 1}
                className="border-[2px] border-retro-border px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-50"
                style={{ background: "var(--neon-lime)", color: "#000" }}
              >
                Next
              </button>
            </div>

            {activeSection.content}
          </section>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
