// App imports this module eagerly, before BrowserRouter installs its POP listener.
// A listener installed by the lazy Products page is too late to prevent unmounts.
const stateKey = Symbol.for('stark.admin.profitMatrixNavigationGuard');
const snapshot = () => ({
  url: window.location.href,
  state: window.history.state,
  index: window.history.state?.idx,
});

const guardState = typeof window === 'undefined' ? {} : (
  window[stateKey] || (window[stateKey] = { active: null, restoring: null, installed: false })
);

const handlePop = (event) => {
  const guard = guardState.active;
  if (!guard) return;
  if (guardState.restoring) {
    event.stopImmediatePropagation();
    guard.current = guardState.restoring;
    guardState.restoring = null;
    return;
  }
  if (!guard.shouldBlock() || guard.confirmLeave()) {
    guard.current = snapshot();
    return;
  }

  // Stop React Router from observing the rejected destination. Restoring only
  // the URL after the router sees it would already have discarded React state.
  event.stopImmediatePropagation();
  const destinationIndex = event.state?.idx;
  const { current } = guard;
  const difference = Number.isInteger(current.index) && Number.isInteger(destinationIndex)
    ? current.index - destinationIndex : 0;
  if (difference !== 0) {
    guardState.restoring = current;
    window.history.go(difference);
  } else {
    // Older same-document entries may not carry React Router's history index.
    window.history.replaceState(current.state, '', current.url);
  }
};

if (typeof window !== 'undefined' && !guardState.installed) {
  window.addEventListener('popstate', handlePop, true);
  guardState.installed = true;
}

export const registerProfitMatrixNavigationGuard = ({ shouldBlock, confirmLeave }) => {
  const guard = { shouldBlock, confirmLeave, current: snapshot() };
  guardState.active = guard;
  return {
    sync: () => {
      if (guardState.active === guard && !guardState.restoring) guard.current = snapshot();
    },
    unregister: () => {
      if (guardState.active === guard) {
        guardState.active = null;
        guardState.restoring = null;
      }
    },
  };
};
