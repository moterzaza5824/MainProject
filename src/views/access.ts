import type { AccessRequestStatus, Repository, UserRow } from "../types/models";
import type { Context } from "../ui/context";
import { heading } from "../ui/shell";
import { badge, busy, confirmAction, empty, toast } from "../ui/primitives";
import { icon } from "../ui/icons";
import { e } from "../utils/html";
import { href, navigate } from "../utils/routes";
import { formatDate } from "../utils/tasks";

export async function renderAccessRequest(root: HTMLElement, repo: Repository, user: UserRow): Promise<void> {
  root.innerHTML = `<main class="access-page"><section class="access-card panel"><div class="auth-icon">${icon("shield")}</div><p class="eyebrow">SE68 HUB</p><h1>ขอสิทธิ์เข้าใช้งาน</h1><p>บัญชีนี้ต้องได้รับอนุมัติจากผู้ดูแลก่อนเข้าใช้งาน</p><div class="access-identity"><strong>${e(user.full_name)}</strong><span>${e(user.email)}</span></div><div id="access-status" role="status" aria-live="polite">กำลังตรวจสอบสถานะ…</div><div class="access-actions"><button class="button primary" id="request-access" hidden>ขอเข้าใช้งาน (Request)</button><button class="button" id="check-access">ตรวจสอบสถานะ</button><button class="button subtle" id="change-account">เปลี่ยนบัญชี</button></div><div id="access-error" role="alert"></div></section></main>`;
  const status = root.querySelector<HTMLElement>("#access-status")!;
  const request = root.querySelector<HTMLButtonElement>("#request-access")!;
  const error = root.querySelector<HTMLElement>("#access-error")!;
  async function refresh() {
    error.textContent = "";
    const latest = await repo.currentUser();
    if (!latest) { navigate("login"); return; }
    if (latest.role !== "pending_member") { navigate("dashboard"); return; }
    const row = await repo.getOwnAccessRequest();
    request.hidden = !!row;
    status.textContent = row?.status === "pending"
      ? "ส่งคำขอแล้ว · รอแอดมินอนุมัติ"
      : row?.status === "rejected"
        ? "คำขอไม่ได้รับอนุมัติ กรุณาติดต่อผู้ดูแลหากต้องการให้ตรวจสอบอีกครั้ง"
        : "กดปุ่มด้านล่างเพื่อส่งชื่อและอีเมลนี้ให้แอดมินตรวจสอบ";
  }
  const run = async (action: () => Promise<void>) => {
    try { await action(); } catch (value) { error.textContent = value instanceof Error ? value.message : "ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่"; }
  };
  request.onclick = () => void busy(request, () => run(async () => { await repo.requestAccess(); await refresh(); }));
  root.querySelector<HTMLButtonElement>("#check-access")!.onclick = event => void busy(event.currentTarget as HTMLButtonElement, () => run(refresh));
  root.querySelector<HTMLButtonElement>("#change-account")!.onclick = event => void busy(event.currentTarget as HTMLButtonElement, () => run(async () => { await repo.signOut(); navigate("login"); }));
  await run(refresh);
}

export async function renderAdminAccessRequests(ctx: Context): Promise<void> {
  ctx.root.innerHTML = heading("คำขอเข้าใช้งาน", "ตรวจสอบบัญชี Google ที่ไม่ใช่อีเมล 6802 ก่อนให้สิทธิ์ใช้งานเหมือนนิสิต", "ACCESS REQUESTS") +
    '<section class="panel"><div class="results-toolbar"><label class="field">สถานะคำขอ<select id="access-filter"><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option></select></label><button class="button" id="reload-access">รีเฟรช</button></div><div id="access-list" aria-live="polite"></div></section>';
  const list = ctx.root.querySelector<HTMLElement>("#access-list")!;
  const filter = ctx.root.querySelector<HTMLSelectElement>("#access-filter")!;
  let page = 1, generation = 0;
  const labels: Record<AccessRequestStatus,string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
  async function load() {
    const version = ++generation;
    list.innerHTML = '<p role="status">กำลังโหลดคำขอ…</p>';
    try {
      const result = await ctx.repo.listAccessRequests(filter.value as AccessRequestStatus, page);
      if (version !== generation) return;
      if (!result.rows.length && page > 1) { page--; await load(); return; }
      list.innerHTML = result.rows.length ? '<div class="access-request-list">' + result.rows.map(row =>
        `<article class="access-request-row"><div><strong>${e(row.full_name)}</strong><p>${e(row.email)}</p><small>ส่งคำขอ ${e(formatDate(row.created_at))}${row.reviewed_at ? " · ตรวจสอบ " + e(formatDate(row.reviewed_at)) : ""}</small></div><div class="actions">${badge(labels[row.status],row.status === "approved" ? "done" : row.status)}${row.status === "pending" ? `<button class="button primary small" data-access-approve="${e(row.uid)}">อนุมัติ</button><button class="button danger small" data-access-reject="${e(row.uid)}">ปฏิเสธ</button>` : ""}</div></article>`
      ).join("") + '</div>' : empty("ไม่มีคำขอในสถานะนี้", "บัญชีที่ส่งคำขอเข้าใช้งานจะแสดงที่นี่");
      const pages = Math.max(1, Math.ceil(result.total / 10));
      list.innerHTML += `<div class="actions access-pagination"><button class="button small" id="access-prev" ${page === 1 ? "disabled" : ""}>ก่อนหน้า</button><span>หน้า ${page} / ${pages} · ${result.total} รายการ</span><button class="button small" id="access-next" ${page >= pages ? "disabled" : ""}>ถัดไป</button></div>`;
      list.querySelector<HTMLButtonElement>("#access-prev")!.onclick = () => { page--; void load(); };
      list.querySelector<HTMLButtonElement>("#access-next")!.onclick = () => { page++; void load(); };
      list.querySelectorAll<HTMLButtonElement>("[data-access-approve],[data-access-reject]").forEach(button => {
        button.onclick = () => void busy(button, async () => {
          const approving = !!button.dataset.accessApprove;
          const uid = button.dataset.accessApprove ?? button.dataset.accessReject!;
          const row = result.rows.find(value => value.uid === uid)!;
          if (!await confirmAction(approving ? "อนุมัติเข้าใช้งาน" : "ปฏิเสธคำขอ", `${row.email}${approving ? " จะใช้งานได้เหมือนนิสิต รวมถึงเลือกวิชา/Sec และสร้างประกาศ" : " จะยังเข้าใช้งานระบบไม่ได้"}`, approving ? "อนุมัติ" : "ปฏิเสธ")) return;
          try { await ctx.repo.reviewAccessRequest(uid, approving ? "approve" : "reject"); toast(approving ? "อนุมัติสิทธิ์เข้าใช้งานแล้ว" : "ปฏิเสธคำขอแล้ว"); }
          finally { await load(); }
        });
      });
    } catch (value) {
      if (version !== generation) return;
      list.innerHTML = `<p role="alert">${e(value instanceof Error ? value.message : "โหลดคำขอไม่สำเร็จ")}</p><button class="button" id="retry-access">ลองอีกครั้ง</button>`;
      list.querySelector<HTMLButtonElement>("#retry-access")!.onclick = () => void load();
    }
  }
  filter.onchange = () => { page = 1; void load(); };
  ctx.root.querySelector<HTMLButtonElement>("#reload-access")!.onclick = () => void load();
  await load();
}
