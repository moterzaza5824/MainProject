export function asPlainText(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
