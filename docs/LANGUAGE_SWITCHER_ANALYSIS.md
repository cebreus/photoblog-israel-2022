# Critical Analysis of Language Switcher Behavior

## 1. UX & Visual Feedback

**Current State:** The language switcher trigger uses a generic "Globe" icon with no visible indication of the currently active language.
**Critique:**

- Users cannot verify the current language setting without opening the dropdown.
- This creates friction, especially if the content language is ambiguous or if the user is looking for a specific language toggle.
  **Recommendation:** Display the current language code (e.g., "CS", "EN") next to the icon.

## 2. Routing & URL Handling

**Current State:** The component manually parses `page.url.pathname` to strip language prefixes (e.g., `/en/about` -> `/about`) using string manipulation.
**Critique:**

- **Fragility:** This manual "de-localization" replicates logic that effectively belongs to the routing/i18n library. It relies on the assumption that the language prefix matches the `availableLanguageTags` exactly and is always at the start.
- **Maintenance:** If the routing strategy changes (e.g., to domain-based routing `en.example.com`), this logic will silently break.
  **Recommendation:** While a dedicated `deLocalize` function from the i18n library is ideal, the current robust manual stripping is acceptable _only_ for prefix-based routing. It must be strictly typed and unit-tested.

## 3. State Synchronization

**Current State:** The component uses a combination of local state (`value`) and side-effects (`goto` with `invalidateAll`).
**Critique:**

- **Double Binding:** The UI component uses `bind:value`, but the parent component inevitably forces the value back to `languageTag()` via an `$effect`. This fights against the browser's navigation latency.
- **Heavy Reloads:** `invalidateAll: true` forces a re-run of all `load` functions. While this ensures data freshness, it can be slower than necessary.
  **Recommendation:** Accept the `invalidateAll` cost for correctness (ensuring translated content loads), but remove `bind:value` in favor of a one-way data flow to prevent UI jitter during navigation.

## 4. Accessibility

**Current State:** The dropdown items use standard labels.
**Critique:** Good. The use of standard, full-word labels ("English", "Čeština") in the menu is cleaner than codes.
