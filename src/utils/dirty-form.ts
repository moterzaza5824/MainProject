/** Returns a reset function. Keep the guard active for further edits after saving. */
export function guardDirty(form: HTMLFormElement) {
  let dirty = false;
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("change", () => { dirty = true; });
  window.addEventListener("beforeunload", event => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  return () => { dirty = false; };
}
