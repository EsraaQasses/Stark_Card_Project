// Only a confirmed authentication rejection may invalidate stored credentials.
export function isDefinitiveAuthFailure(error: {status?: number; response?: {status?: number}} | null | undefined): boolean {
 const status = error?.response?.status ?? error?.status;
 return status === 401 || status === 403;
}
