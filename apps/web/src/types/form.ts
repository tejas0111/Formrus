export type FieldType =
  | "short_text"
  | "long_text"
  | "rich_text"
  | "dropdown"
  | "checkboxes"
  | "star_rating"
  | "file_upload"
  | "screenshot_upload"
  | "video_upload"
  | "url"
  | "confirmation";

export type ResponsePrivacy = "private" | "public";

/** Handler type — determines what happens after submission */
export type HandlerType = "built_in" | "custom";

export interface SubmissionEligibility {
  minSuiMist?: string;
  coinType?: string;
  minCoinBalance?: string;
  requiredObjectType?: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  /** Allowed MIME types for upload fields, e.g. ["image/png", "image/jpeg"] */
  acceptedMimeTypes?: string[];
  /** Maximum upload size for this field, in bytes */
  maxSizeBytes?: number;
  /** Maximum files allowed for this field. Omit or 1 for single upload. */
  maxFiles?: number;
}

export interface FormBranding {
  bannerUrl?: string;
  avatarUrl?: string;
}

export interface FormHandler {
  /** "built_in" uses the default submit_and_act. "custom" calls an external Move module. */
  type: HandlerType;
  /** For custom handlers: full target path e.g. "0xabc::my_handler::submit_and_mint" */
  customTarget?: string;
  /** For custom handlers: type arguments (comma-separated) if the handler is generic */
  typeArguments?: string[];
}

export interface SubmissionLimits {
  /** Max submissions per wallet address. 0 or undefined = 1 (contract default) */
  maxPerAddress?: number;
  /** Max total submissions across all wallets. 0 = unlimited (contract default) */
  maxTotal?: number;
}

export interface FormDraft {
  title: string;
  description: string;
  branding?: FormBranding;
  responsePrivacy: ResponsePrivacy;
  eligibility: SubmissionEligibility;
  access?: {
    admins?: string[];
    viewers?: string[];
  };
  handler?: FormHandler;
  limits?: SubmissionLimits;
  fields: FormField[];
  createdAt: string;
}

export interface ResponseEnvelope {
  kind: "formrus_response_v1";
  dna: string;
  response: Record<string, unknown>;
  submitter: string;
  createdAtMs: number;
}

export interface StoredResponseBlob {
  kind: "formrus_response_v1";
  privacy: ResponsePrivacy;
  dna: string;
  submitter: string;
  createdAtMs: number;
  response?: Record<string, unknown>;
  ciphertext?: string;
  encoding?: "hex";
}
