import type { ApiError } from "./errors/apiError";
import { normalizeApiError } from "./errors/apiError";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiFailure(error: unknown): ApiFailure {
  return { ok: false, error: normalizeApiError(error) };
}
