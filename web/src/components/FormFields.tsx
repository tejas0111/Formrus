import { useState, useEffect, useRef, type ReactNode } from "react";
import { Bold, Check, ChevronDown, Image, Italic, Link2, List, Star, Upload, Video } from "lucide-react";
import type { FieldOption, FormField } from "../types/form";

/* ── Shared field wrapper ──────────────────────────────────────── */

function FieldShell({
  field,
  children,
  htmlFor,
  invalid = false,
}: {
  field: FormField;
  children: ReactNode;
  htmlFor?: string;
  invalid?: boolean;
}) {
  return (
    <div
      className="group border-[3px] border-retro-border p-4 md:p-5 transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: "var(--bg-card)",
        borderColor: invalid ? "#FF69B4" : undefined,
        boxShadow: invalid ? "0 0 0 2px rgba(255,105,180,0.2), 4px 4px 0px var(--shadow-color)" : "4px 4px 0px var(--shadow-color)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <label
          htmlFor={htmlFor}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] block"
          style={{ color: "var(--text)" }}
        >
          {field.label}
          {field.required ? (
            <span className="ml-1" style={{ color: "#FF00FF" }}>*</span>
          ) : null}
        </label>
        <span
          className="font-mono text-[9px] uppercase px-2 py-1 border-[2px] border-retro-border flex-shrink-0"
          style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
        >
          {field.type.replace(/_/g, " ")}
        </span>
      </div>
      {field.helpText ? (
        <p
          className="font-mono text-[10px] leading-relaxed mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          {field.helpText}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
      {invalid ? (
        <p className="font-mono text-[10px] mt-3" role="alert" style={{ color: "#FF69B4" }}>
          This field needs attention.
        </p>
      ) : null}
    </div>
  );
}

/* ── Shared input styles ───────────────────────────────────────── */

const inputClasses =
  "w-full font-mono text-xs px-3 py-2.5 border-[3px] border-retro-border transition-all duration-150 focus:outline-none focus:border-neon-lime focus:shadow-[0_0_0_1px_var(--neon-lime)] placeholder:opacity-50";

const inputStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  color: "var(--text)",
  boxShadow: "2px 2px 0px var(--shadow-color)",
};

function uploadAcceptFor(field: FormField): string | undefined {
  if ((field.acceptedMimeTypes?.length ?? 0) > 0) return field.acceptedMimeTypes?.join(",");
  if (field.type === "screenshot_upload") return "image/*";
  if (field.type === "video_upload") return "video/*";
  return undefined;
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

function normalizedOptionValue(option: FieldOption, index: number): string {
  const explicit = option.value.trim();
  if (explicit) return explicit;

  const derived = option.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return derived || `option_${index + 1}`;
}

/* ── Field Input (used in PublicViewPage & EmbedPage) ──────────── */

export function FieldInput({ field, invalid = false }: { field: FormField; invalid?: boolean }) {
  if (field.type === "rich_text") {
    return <RichTextField field={field} invalid={invalid} />;
  }

  if (field.type === "long_text") {
    return (
      <FieldShell field={field} htmlFor={`field-${field.id}`} invalid={invalid}>
        <textarea
          id={`field-${field.id}`}
          name={field.id}
          placeholder={field.placeholder || "Type your answer…"}
          required={field.required}
          rows={4}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </FieldShell>
    );
  }

  if (field.type === "dropdown") {
    return <DropdownField field={field} invalid={invalid} />;
  }

  if (field.type === "checkboxes") {
    return (
      <FieldShell field={field} invalid={invalid}>
        <div className="space-y-2">
          {(field.options ?? []).map((option) => (
            <label
              key={option.value}
              className="checkbox-option flex items-center gap-3 px-3 py-2 border-[2px] border-retro-border cursor-pointer transition-all duration-150 hover:border-neon-lime hover:-translate-y-px"
              style={{ background: "var(--bg-secondary)", boxShadow: "1px 1px 0px var(--shadow-color)" }}
            >
              <input
                name={field.id}
                value={option.value}
                type="checkbox"
                className="sr-only"
              />
              <span
                className="checkbox-indicator w-4.5 h-4.5 border-[2px] border-retro-border flex items-center justify-center flex-shrink-0 transition-all duration-150"
                style={{ background: "var(--bg-card)" }}
                aria-hidden="true"
              >
                <Check
                  size={10}
                  strokeWidth={3}
                  className="checkbox-check opacity-0 transition-opacity"
                  style={{ color: "#000" }}
                />
              </span>
              <span
                className="font-mono text-xs transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </FieldShell>
    );
  }

  if (field.type === "star_rating") {
    return <StarRating field={field} invalid={invalid} />;
  }

  if (field.type === "file_upload" || field.type === "screenshot_upload" || field.type === "video_upload") {
    return <FileUploadField field={field} invalid={invalid} />;
  }

  if (field.type === "url") {
    return (
      <FieldShell field={field} htmlFor={`field-${field.id}`} invalid={invalid}>
        <div className="relative">
          <Link2
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            id={`field-${field.id}`}
            name={field.id}
            type="url"
            placeholder={field.placeholder ?? "https://example.com"}
            required={field.required}
            className={`${inputClasses} pl-9`}
            style={inputStyle}
          />
        </div>
      </FieldShell>
    );
  }

  if (field.type === "confirmation") {
    return (
      <div
        className="confirmation-option group border-[3px] border-retro-border p-4 transition-all duration-150 hover:-translate-y-0.5"
        style={{
          background: "var(--bg-card)",
          borderColor: invalid ? "#FF69B4" : undefined,
          boxShadow: invalid ? "0 0 0 2px rgba(255,105,180,0.2), 3px 3px 0px var(--shadow-color)" : "3px 3px 0px var(--shadow-color)"
        }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            name={field.id}
            type="checkbox"
            required={field.required}
            className="sr-only"
          />
          <span
            className="confirmation-indicator w-5 h-5 border-[3px] border-retro-border flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-150"
            style={{ background: "var(--bg-secondary)" }}
            aria-hidden="true"
          >
            <Check
              size={12}
              strokeWidth={3}
              className="confirmation-check opacity-0 transition-opacity"
              style={{ color: "#000" }}
            />
          </span>
          <span>
            <span className="font-mono text-xs font-bold" style={{ color: "var(--text)" }}>
              {field.label}
              {field.required ? (
                <span className="ml-1" style={{ color: "#FF00FF" }}>
                  *
                </span>
              ) : null}
            </span>
            {field.helpText ? (
              <p
                className="font-mono text-[10px] mt-1 leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {field.helpText}
              </p>
            ) : null}
          </span>
        </label>
        {invalid ? (
          <p className="font-mono text-[10px] mt-3" role="alert" style={{ color: "#FF69B4" }}>
            This field needs attention.
          </p>
        ) : null}
      </div>
    );
  }

  // short_text (default)
  return (
    <FieldShell field={field} htmlFor={`field-${field.id}`} invalid={invalid}>
      <input
        id={`field-${field.id}`}
        name={field.id}
        placeholder={field.placeholder || "Type your answer…"}
        required={field.required}
        className={inputClasses}
        style={inputStyle}
      />
    </FieldShell>
  );
}

function DropdownField({ field, invalid = false }: { field: FormField; invalid?: boolean }) {
  const [selectedValue, setSelectedValue] = useState("");
  const options = (field.options ?? []).map((option, index) => ({
    ...option,
    value: normalizedOptionValue(option, index),
  }));
  const hasOtherOption = options.some((option) => option.value === "other");
  const showOtherInput = hasOtherOption && selectedValue === "other";

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement> | React.FormEvent<HTMLSelectElement>) {
    setSelectedValue(event.currentTarget.value);
  }

  useEffect(() => {
    const select = document.getElementById(`field-${field.id}`);
    const form = select?.closest("form");
    if (!form) return;
    const handleReset = () => setSelectedValue("");
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [field.id]);

  return (
    <FieldShell field={field} htmlFor={`field-${field.id}`} invalid={invalid}>
      <div className="space-y-3">
        <div className="relative">
          <select
            id={`field-${field.id}`}
            name={field.id}
            required={field.required}
            value={selectedValue}
            onChange={handleSelectChange}
            onInput={handleSelectChange}
            className="w-full font-mono text-xs md:text-sm px-3 py-3 pr-9 border-[3px] border-retro-border appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-neon-cyan"
            style={{
              background: "var(--bg-secondary)",
              color: selectedValue ? "var(--text)" : "var(--text-muted)",
              boxShadow: "2px 2px 0px var(--shadow-color)",
            }}
          >
            <option value="" disabled>
              Choose one...
            </option>
            {options.map((option, index) => (
              <option key={`${option.value}-${index}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronDown size={12} />
          </div>
        </div>
        {showOtherInput ? (
          <div className="border-[2px] border-dashed border-retro-border p-2.5" style={{ background: "var(--bg-secondary)" }}>
            <input
              name={`${field.id}__other`}
              placeholder="Type your custom answer..."
              required={field.required}
              className={inputClasses}
              style={inputStyle}
            />
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}

/* ── Rich Text ─────────────────────────────────────────────────── */

function RichTextField({ field, invalid = false }: { field: FormField; invalid?: boolean }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    const editor = document.getElementById(`field-${field.id}`);
    const form = editor?.closest("form");
    if (!form || !editor) return;
    const handleReset = () => {
      editor.innerHTML = "";
      setHtml("");
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [field.id]);

  function runCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    const editor = document.getElementById(`field-${field.id}`);
    setHtml(editor?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    runCommand("createLink", url);
  }

  return (
    <FieldShell field={field} htmlFor={`field-${field.id}`} invalid={invalid}>
      <input type="hidden" name={field.id} value={html} />
      <div className="flex items-center gap-1 border-[3px] border-retro-border border-b-0 p-1" style={{ background: "var(--bg-secondary)" }}>
        <button type="button" onClick={() => runCommand("bold")} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border hover:border-neon-lime" title="Bold">
          <Bold size={13} />
        </button>
        <button type="button" onClick={() => runCommand("italic")} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border hover:border-neon-lime" title="Italic">
          <Italic size={13} />
        </button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border hover:border-neon-lime" title="Bulleted list">
          <List size={13} />
        </button>
        <button type="button" onClick={addLink} className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border hover:border-neon-lime" title="Link">
          <Link2 size={13} />
        </button>
      </div>
      <div
        id={`field-${field.id}`}
        role="textbox"
        aria-multiline="true"
        aria-required={field.required}
        contentEditable
        data-placeholder={field.placeholder || "Write formatted text..."}
        onInput={(event) => setHtml(event.currentTarget.innerHTML)}
        onBlur={(event) => setHtml(event.currentTarget.innerHTML)}
        className={`${inputClasses} min-h-[128px] rich-text-editor`}
        style={inputStyle}
      />
    </FieldShell>
  );
}

/* ── Star Rating ───────────────────────────────────────────────── */

function StarRating({ field, invalid = false }: { field: FormField; invalid?: boolean }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const [touched, setTouched] = useState(false);
  const showError = field.required && touched && value === 0;

  useEffect(() => {
    const form = document
      .querySelector(`input[name="${field.id}"]`)
      ?.closest("form");
    if (!form) return;
    const handleReset = () => {
      setValue(0);
      setHover(0);
      setTouched(false);
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [field.id]);

  useEffect(() => {
    const form = document
      .querySelector(`input[name="${field.id}"]`)
      ?.closest("form");
    if (!form) return;
    const handleSubmit = () => setTouched(true);
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [field.id]);

  const displayValue = hover || value;

  return (
    <div
      className="group border-[3px] border-retro-border p-4 transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: "var(--bg-card)",
        borderColor: invalid ? "#FF69B4" : undefined,
        boxShadow: invalid ? "0 0 0 2px rgba(255,105,180,0.2), 3px 3px 0px var(--shadow-color)" : "3px 3px 0px var(--shadow-color)"
      }}
    >
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-wide mb-1 block"
        id={`${field.id}-label`}
        style={{ color: "var(--text)" }}
      >
        {field.label}
        {field.required ? (
          <span className="ml-1" style={{ color: "#FF00FF" }}>
            *
          </span>
        ) : null}
      </span>
      {field.helpText ? (
        <p
          className="font-mono text-[10px] leading-relaxed mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          {field.helpText}
        </p>
      ) : (
        <div className="mb-2" />
      )}
      <input
        type="hidden"
        name={field.id}
        value={value}
        data-required={field.required ? "true" : undefined}
      />
      <div
        className="flex gap-1.5"
        role="slider"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value || undefined}
        aria-labelledby={`${field.id}-label`}
        aria-required={field.required}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            setValue(Math.min(5, (value || 0) + 1));
            setTouched(true);
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            setValue(Math.max(1, (value || 1) - 1));
            setTouched(true);
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => {
              setValue(star);
              setTouched(true);
            }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            className="transition-all duration-150 hover:scale-125 active:scale-90"
          >
            <Star
              size={30}
              strokeWidth={2}
              fill={displayValue >= star ? "#FFFF00" : "transparent"}
              stroke={displayValue >= star ? "#FFFF00" : "var(--text-muted)"}
              style={{
                filter:
                  displayValue >= star
                    ? "drop-shadow(0 0 4px rgba(255,255,0,0.4))"
                    : "none",
              }}
            />
          </button>
        ))}
        {value > 0 ? (
          <span
            className="font-mono text-[10px] font-bold ml-2 self-center"
            style={{ color: "var(--text-muted)" }}
          >
            {value}/5
          </span>
        ) : null}
      </div>
      {showError || invalid ? (
        <p
          className="font-mono text-[10px] mt-2"
          role="alert"
          style={{ color: "#FF69B4" }}
        >
          Rating is required.
        </p>
      ) : null}
    </div>
  );
}

/* ── File Upload ───────────────────────────────────────────────── */

function FileUploadField({ field, invalid = false }: { field: FormField; invalid?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const Icon = field.type === "screenshot_upload" ? Image : field.type === "video_upload" ? Video : Upload;
  const maxFiles = field.maxFiles ?? 1;

  return (
    <FieldShell field={field} invalid={invalid}>
      <label
        className="block border-[3px] border-dashed border-retro-border p-6 text-center cursor-pointer transition-all duration-150 hover:border-neon-lime hover:-translate-y-px"
        style={{ background: "var(--bg-secondary)" }}
      >
        <input
          ref={inputRef}
          name={field.id}
          type="file"
          accept={uploadAcceptFor(field)}
          multiple={maxFiles > 1}
          required={field.required}
          className="sr-only"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            const existing = Array.from(inputRef.current?.files ?? []);
            const deduped = new Map<string, File>();
            for (const file of [...existing, ...picked]) {
              const key = `${file.name}:${file.size}:${file.lastModified}`;
              deduped.set(key, file);
            }
            const nextFiles = Array.from(deduped.values()).slice(0, maxFiles);
            const transfer = new DataTransfer();
            for (const file of nextFiles) transfer.items.add(file);
            if (inputRef.current) inputRef.current.files = transfer.files;
            setFileNames(nextFiles.map((file) => file.name));
          }}
        />
        <Icon
          size={24}
          style={{ color: "var(--text-muted)", margin: "0 auto 8px" }}
        />
        {fileNames.length > 0 ? (
          <p className="font-mono text-[10px] font-bold" style={{ color: "var(--neon-lime)" }}>
            {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files selected`}
          </p>
        ) : (
          <>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              Click to upload or drag and drop
            </p>
            <p
              className="font-mono text-[9px] mt-1"
              style={{ color: "var(--text-muted)", opacity: 0.6 }}
            >
              {uploadHintFor(field)}
            </p>
            {maxFiles > 1 ? (
              <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                You can pick files multiple times. Selection is kept up to {maxFiles}.
              </p>
            ) : null}
          </>
        )}
      </label>
    </FieldShell>
  );
}
