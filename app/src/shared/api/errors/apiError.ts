export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
};

function pickMessage(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const value = record.message ?? record.error ?? record.detail;

  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");

  return null;
}

function pickCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const code = (data as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}

export function normalizeApiError(error: unknown): ApiError {
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
      message: pickMessage(responseData) || maybeAxios.message || "Request failed",
      status: maybeAxios.response?.status,
      code: pickCode(responseData) || maybeAxios.code,
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
      pickMessage(responseData) ||
      (typeof maybeAxios.message === "string" ? maybeAxios.message : null) ||
      "Request failed";

    return {
      message,
      status: maybeAxios.response?.status,
      code:
        pickCode(responseData) ||
        (typeof maybeAxios.code === "string" ? maybeAxios.code : undefined),
      details: responseData ?? error,
    };
  }

  return { message: "Request failed" };
}

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}
