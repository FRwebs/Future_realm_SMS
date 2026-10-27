/**
 * Moves focus to an element the moment it appears. For a field that arrives because the person just asked for it — a sign-in code after
 * the password, a new sub-topic row — not for anything present when the page loads, which is what the `autoFocus` attribute is for and
 * what screen-reader users are right to be wary of. Used as `ref={focusOnMount}`.
 */
export function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}
