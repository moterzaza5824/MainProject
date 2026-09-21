export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
export const e = escapeHtml;
export function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function externalLink(url: string, label: string): string {
  const safe = safeUrl(url);
  return safe ? `<a class="resource-link" href="${e(safe)}" target="_blank" rel="noopener noreferrer">${e(label)} <span aria-hidden="true">↗</span></a>` : "";
}
// Intentional safe Markdown subset. Raw HTML is displayed as text.
export function markdown(text: string): string {
  const inline = (value: string) => e(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return text.split("\n").map(line => {
    if (line.startsWith("### ")) return "<h3>" + inline(line.slice(4)) + "</h3>";
    if (line.startsWith("## ")) return "<h2>" + inline(line.slice(3)) + "</h2>";
    if (line.startsWith("- ")) return '<p class="bullet-line">• ' + inline(line.slice(2)) + "</p>";
    return line.trim() ? "<p>" + inline(line) + "</p>" : "<br>";
  }).join("");
}

