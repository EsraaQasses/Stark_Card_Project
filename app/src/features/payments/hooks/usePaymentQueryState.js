import { useMemo } from "react";
import { isFinalQueryStatus, normalizeQueryDisplay } from "../model/paymentQuery";

// Derived query state only. Does not perform query API calls or mutate UI state.
export function usePaymentQueryState({ queryLoading, queryStatus, queryResult }) {
  return useMemo(
    () => ({
      isQueryPending: queryLoading || (!!queryStatus && !isFinalQueryStatus(queryStatus)),
      queryDisplay: queryResult ? normalizeQueryDisplay(queryResult) : null,
    }),
    [queryLoading, queryResult, queryStatus]
  );
}
