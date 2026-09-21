import { e } from "../utils/html";
import { icon } from "./icons";
export function empty(title = "ยังไม่มีรายการ", message = "เมื่อมีข้อมูล รายการจะแสดงที่นี่", action = "") {
  return `<div class="empty"><div class="empty-symbol">${icon("tasks")}</div><h3>${e(title)}</h3><p>${e(message)}</p>${action}</div>`;
}
export function toast(message: string, error = false): void {
  let region = document.querySelector<HTMLElement>("#toast");
  if (!region) { region = document.createElement("div"); region.id = "toast"; region.setAttribute("role","status"); document.body.append(region); }
  region.textContent = message; region.className = "toast visible" + (error ? " toast-error" : "");
  const current = region;
  window.clearTimeout(Number(current.dataset.timer));
  current.dataset.timer = String(window.setTimeout(() => current.classList.remove("visible"), 4000));
}
export function dialog(title: string, body: string, wide = false): HTMLDialogElement {
  const origin = document.activeElement as HTMLElement | null;
  const element = document.createElement("dialog");
  element.className = "dialog" + (wide ? " dialog-wide" : "");
  element.innerHTML = `<div class="dialog-header"><h2>${e(title)}</h2><button class="icon-button" type="button" data-close aria-label="ปิด">${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
  document.body.append(element);
  element.querySelector("[data-close]")!.addEventListener("click", () => element.close());
  element.addEventListener("click", event => { if (event.target === element) { const r = element.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) element.close(); } });
  element.addEventListener("close", () => { element.remove(); origin?.focus(); }, {once:true});
  element.showModal();
  return element;
}
export function confirmAction(title: string, message: string, label = "ยืนยัน"): Promise<boolean> {
  return new Promise(resolve => {
    const modal = dialog(title, `<p>${e(message)}</p><div class="dialog-footer"><button type="button" class="button" data-cancel>ยกเลิก</button><button type="button" class="button danger" data-confirm>${e(label)}</button></div>`);
    let accepted = false;
    modal.querySelector("[data-confirm]")!.addEventListener("click", () => { accepted = true; modal.close(); });
    modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
    modal.addEventListener("close", () => resolve(accepted), {once:true});
  });
}
export async function busy(button: HTMLButtonElement, work: () => Promise<void>): Promise<void> {
  if (button.disabled) return;
  const content = button.innerHTML; button.disabled = true; button.setAttribute("aria-busy", "true");
  try { await work(); } catch (error) { toast(error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่", true); }
  finally { button.disabled = false; button.removeAttribute("aria-busy"); button.innerHTML = content; }
}
export function badge(label: string, kind = "") { return `<span class="badge ${kind}">${e(label)}</span>`; }
export function statusBadge(status: string) { return badge(({ TODO: "ยังไม่เริ่ม", DOING: "กำลังทำ", DONE: "ทำเสร็จแล้ว" } as Record<string,string>)[status] ?? status, status.toLowerCase()); }

