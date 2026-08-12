export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  fields?: Record<string, unknown>;
  details?: unknown;
};

function pickLocalizedMessage(value: unknown, locale: "en" | "ar"): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (value && typeof value === "object") {
    const messages = value as Record<string, unknown>;
    const localized = messages[locale] ?? messages.en ?? messages.ar;
    return typeof localized === "string" ? localized : null;
  }
  return null;
}

function pickMessage(data: unknown, locale: "en" | "ar"): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object") {
    const normalized = nestedError as Record<string, unknown>;
    const details = normalized.details;
    if (details && typeof details === "object") {
      const legacy = (details as Record<string, unknown>).legacy_error;
      const legacyMessage = pickLocalizedMessage(legacy, locale);
      if (legacyMessage) return legacyMessage;
    }
    const normalizedMessage = pickLocalizedMessage(normalized.message, locale);
    if (normalizedMessage) return normalizedMessage;
  }

  const value = record.message ?? record.error ?? record.detail;
  return pickLocalizedMessage(value, locale);
}

function pickFields(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object") {
    const fields = (nestedError as Record<string, unknown>).fields;
    if (fields && typeof fields === "object") return fields as Record<string, unknown>;
  }
  const fields = record.fields ?? record.errors;
  return fields && typeof fields === "object" ? fields as Record<string, unknown> : undefined;
}

function pickCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const nestedError = record.error;
  const code = nestedError && typeof nestedError === "object"
    ? (nestedError as Record<string, unknown>).code
    : record.code;
  return typeof code === "string" ? code : undefined;
}

export function normalizeApiError(error: unknown, locale: "en" | "ar" = "en"): ApiError {
  if (typeof error === "string") {
    return { message: error };
  }

  if (error instanceof Error) {
    const maybeAxios = error as Error & {
      response?: { status?: number; data?: unknown };
      code?: string;
    };

    const responseData = maybeAxios.response?.data;
    return {
      message: pickMessage(responseData, locale) || maybeAxios.message || "Request failed",
      status: maybeAxios.response?.status,
      code: pickCode(responseData) || maybeAxios.code,
      fields: pickFields(responseData),
      details: responseData,
    };
  }

  if (error && typeof error === "object") {
    const maybeAxios = error as {
      message?: unknown;
      response?: { status?: number; data?: unknown };
      code?: unknown;
    };
    const responseData = maybeAxios.response?.data;
    const message =
      pickMessage(responseData, locale) ||
      (typeof maybeAxios.message === "string" ? maybeAxios.message : null) ||
      "Request failed";

    return {
      message,
      status: maybeAxios.response?.status,
      code:
        pickCode(responseData) ||
        (typeof maybeAxios.code === "string" ? maybeAxios.code : undefined),
      fields: pickFields(responseData),
      details: responseData ?? error,
    };
  }

  return { message: "Request failed" };
}

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}
