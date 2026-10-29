# Evaluation — Attempt 1 (source preflight)

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The matrix follows the established Admin design system instead of rebuilding the product page. The inline layout, contained horizontal table, sticky product column, dynamic category headers, explicit configuration-only notice, and dirty-cell highlighting fit the brief. A required navigation path still loses unsaved changes, so the feature is not ready for approval.

This is a source preflight. The local app was not reachable on port 5179 during this inspection, so desktop, tablet, and mobile screenshots have not yet been reviewed. No screenshot-based visual score is claimed.

## Scores

| Criterion | Score | Status | Weight | Notes |
|---|---|---|---|---|
| Design Quality | Pending | Pending visual review | HIGH | Source uses the existing slate/cyan cards, typography, dark mode and RTL direction. |
| Originality | Pending | Pending visual review | HIGH | Product-first sticky rows and independently labeled dynamic category columns are task-specific choices. |
| Craft | Pending | Pending visual review | MEDIUM | Table scroll region is constrained and focusable; 375/768/1440 viewport behavior still needs browser inspection. |
| Functionality | 1/3 | NEEDS REVISION | MEDIUM | Dirty drafts survive paging/filtering and use optimistic revisions, but one real SPA navigation path bypasses the guard. |

## What's Working Well

- Category columns use backend IDs and names, with no invented category list or example percentages saved as defaults.
- Blank and zero remain distinct, and percentage strings are transported without a frontend pricing formula.
- Single-row and global saves send only changed cells; off-page edits remain present in the draft map.
- Conflict and uncertain-save responses retain drafts and require deliberate reload/discard before retrying.
- The policy notice clearly states that configuration does not yet affect selling prices. General product profit is read-only context; missing cost is not fabricated.
- No provider synchronization is called by the matrix.
- Table headers and cell input labels are explicit, and sticky positioning uses logical start/end properties for RTL.

## Issues Found

### Issue 1: Programmatic profile navigation bypasses unsaved-change protection

- **What:** The matrix guards anchors, browser popstate, beforeunload, and the parent Add Product action. It does not guard all programmatic router pushes.
- **Where:** `src/components/ProductProfitMatrix.jsx` navigation effect; existing `src/components/UserProfile.jsx` invokes `navigate('/profile')` from a clickable div.
- **Why it matters:** After editing a rate, opening the user menu and choosing My Profile can unmount the matrix and lose drafts without the required warning.
- **Suggested fix:** Guard the router navigator/history push and replace boundary while the matrix is dirty or saving, or use a shared navigation blocker that covers programmatic paths. Avoid introducing a second prompt after an anchor navigation has already been approved. Test decline and acceptance through the existing profile menu, ordinary sidebar links, parent Add Product, and browser Back/Forward.

### Issue 2: Visual evidence remains unverified

- **What:** The live app was unavailable to this evaluator, so responsive overflow and actual contrast have not been observed.
- **Where:** Whole matrix at 1440, 768, and 375 pixels, in Arabic RTL and preferably dark mode.
- **Why it matters:** Source-level containment does not prove that the full Admin flex/grid shell permits the table to shrink without widening the viewport.
- **Suggested fix:** Review actual screenshots and compare `document.documentElement.scrollWidth` with viewport width, while confirming that the table region itself scrolls horizontally.

## Priority Fixes for Next Attempt

1. Cover the existing programmatic My Profile navigation and test unsaved-draft refusal.
2. Complete live desktop/tablet/mobile visual checks, including Arabic RTL.

## Should the next attempt REFINE or PIVOT?

REFINE. The existing page integration and table direction are appropriate. The navigation guard needs broader coverage, followed by real viewport verification.
