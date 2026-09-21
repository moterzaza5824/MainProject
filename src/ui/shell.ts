import type { Repository, UserRow } from "../types/models";
import { href, type RouteName } from "../utils/routes";
import { e } from "../utils/html";
import { icon } from "./icons";
import { confirmAction, toast } from "./primitives";

export async function signOut(repo: Repository): Promise<void> {
  if (await confirmAction("ออกจากระบบ", "ต้องการออกจากบัญชีที่กำลังใช้งานอยู่ใช่ไหม", "ออกจากระบบ")) {
    await repo.signOut(); location.assign(href("login"));
  }
}
export function mountShell(user: UserRow, active: RouteName, repo: Repository): HTMLElement {
  const nav = (route: RouteName, name: string, glyph: string) => `<a href="${href(route)}" title="${name}" ${active === route ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${name}</span></a>`;
  const root = document.querySelector<HTMLElement>("#app")!;
  root.innerHTML = `<a class="skip-link" href="#content">ข้ามไปเนื้อหา</a>
  <header class="topbar"><button type="button" class="icon-button menu-toggle" id="mobile-menu" aria-controls="sidebar" aria-expanded="false" aria-label="เปิดเมนู">${icon("menu")}</button>
    <a class="brand" href="${href("dashboard")}"><span class="brand-symbol">S<span>68</span></span><span>SE68 <b>HUB</b></span></a>
    <div class="top-context">Software Engineering <span>/</span> University of Phayao</div>
    <a class="profile-link" href="${href("profile")}"><span class="profile-label"><strong>${e(user.full_name)}</strong><small>${e(user.role === "admin" ? "ผู้ดูแลระบบ" : "นิสิต • รุ่น 68")}</small></span><span class="avatar">${e(user.full_name.slice(0,1))}</span></a>
  </header>
  <aside class="sidebar" id="sidebar" aria-label="เมนูหลัก"><div class="sidebar-heading"><span>พื้นที่ของฉัน</span><button class="icon-button" id="collapse-menu" type="button" aria-label="พับเมนู" aria-expanded="true" aria-controls="sidebar-nav">${icon("left")}</button></div>
    <nav id="sidebar-nav">${nav("dashboard","ภาพรวม","grid")}${nav("official","ประกาศทางการ","news")}${nav("general","ประกาศทั่วไป","general")}${user.role === "student" ? nav("requests","คำขอประกาศของฉัน","check") : ""}${nav("assignments","งานและการบ้าน","tasks")}${nav("calendar","ปฏิทิน","calendar")}
    ${user.role === "admin" ? `<div class="nav-caption">จัดการระบบ</div>${nav("admin","ภาพรวมผู้ดูแล","shield")}${nav("approvals","อนุมัติประกาศ","check")}${nav("adminPosts","จัดการประกาศ","news")}${nav("adminAssignments","จัดการงาน","tasks")}` : ""}
    <div class="nav-caption">บัญชี</div>${nav("profile","โปรไฟล์","user")}</nav>
    <div class="sidebar-bottom"><div class="cohort-label"><span class="cohort-mark">68</span><span><b>SE68 COMMUNITY</b><small>พื้นที่ของพวกเรา</small></span></div><button class="nav-signout" id="signout" type="button" title="ออกจากระบบ">${icon("out")}<span>ออกจากระบบ</span></button></div>
  </aside><button class="scrim" id="scrim" aria-label="ปิดเมนู" tabindex="-1" hidden></button>
  <div class="workspace">${repo.mode === "demo" ? '<div class="demo-strip"><span>โหมดทดลอง</span> ข้อมูลตัวอย่างบันทึกเฉพาะเบราว์เซอร์นี้ <a href="' + href("profile") + '">ดูบัญชีทดลอง ↗</a></div>' : ""}
  <main id="content" class="main" tabindex="-1"><div class="loading" role="status">กำลังโหลดข้อมูล…</div></main><footer class="page-footer">SE68 HUB <span>มหาวิทยาลัยพะเยา · วิศวกรรมซอฟต์แวร์</span></footer></div>`;
  const sidebar = document.querySelector<HTMLElement>("#sidebar")!, trigger = document.querySelector<HTMLButtonElement>("#mobile-menu")!, collapse = document.querySelector<HTMLButtonElement>("#collapse-menu")!, scrim = document.querySelector<HTMLButtonElement>("#scrim")!;
  const mobile = matchMedia("(max-width: 860px)");
  let collapsed = false;
  try { collapsed = localStorage.getItem("se68-sidebar-collapsed") === "true"; } catch { /* optional preference */ }
  function applyCollapsed() {
    document.body.classList.toggle("sidebar-collapsed", collapsed && !mobile.matches);
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.setAttribute("aria-label", collapsed ? "กางเมนูด้านข้าง" : "พับเมนูด้านข้าง");
    collapse.title = collapsed ? "กางเมนู" : "พับเมนู";
  }
  function toggleMobile(open: boolean) {
    sidebar.classList.toggle("mobile-open", open); scrim.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open)); sidebar.inert = mobile.matches && !open;
    if (open) sidebar.querySelector<HTMLAnchorElement>("a")?.focus(); else trigger.focus();
  }
  collapse.onclick = () => { collapsed = !collapsed; applyCollapsed(); try { localStorage.setItem("se68-sidebar-collapsed", String(collapsed)); } catch {} };
  trigger.onclick = () => toggleMobile(!sidebar.classList.contains("mobile-open"));
  scrim.onclick = () => toggleMobile(false);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sidebar.classList.contains("mobile-open")) toggleMobile(false);
    if (event.key === "Tab" && sidebar.classList.contains("mobile-open")) {
      const links = [...sidebar.querySelectorAll<HTMLElement>("a, button")].filter(el => el.offsetParent !== null);
      if (event.shiftKey && document.activeElement === links[0]) { event.preventDefault(); links.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === links.at(-1)) { event.preventDefault(); links[0]?.focus(); }
    }
  });
  mobile.addEventListener("change", () => { sidebar.classList.remove("mobile-open"); scrim.hidden = true; trigger.setAttribute("aria-expanded","false"); sidebar.inert = mobile.matches; applyCollapsed(); });
  sidebar.inert = mobile.matches; applyCollapsed();
  document.querySelector<HTMLButtonElement>("#signout")!.onclick = () => { void signOut(repo).catch(err => toast(err.message, true)); };
  return document.querySelector<HTMLElement>("#content")!;
}
export function heading(title: string, subtitle: string, eyebrow: string, actions = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p class="subtitle">${e(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`;
}
