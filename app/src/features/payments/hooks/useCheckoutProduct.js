import { useCallback, useEffect, useState } from "react";
import { loadCheckoutProduct } from "../../../api/store";
import { getApiErrorMessage } from "../../../shared/api/errors/apiError";

export function useCheckoutProduct(productId, revision = 0) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ id: null, status: "loading", product: null, requirements: [], error: "" });
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setState({ id: productId, status: "loading", product: null, requirements: [], error: "" });
    loadCheckoutProduct(productId, { signal: controller.signal }).then(result => {
      if (alive) setState({ id: productId, status: "ready", ...result, error: "" });
    }).catch(error => {
      if (alive) setState({ id: productId, status: "error", product: null, requirements: [], error: getApiErrorMessage(error) });
    });
    return () => { alive = false; controller.abort(); };
  }, [productId, revision, attempt]);
  const current = state.id === productId ? state : { status: "loading", product: null, requirements: [], error: "" };
  return { ...current, loading: current.status === "loading", retry };
}
