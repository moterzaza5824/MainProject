import type { Repository } from "../types/models";
import { e } from "../utils/html";
import { href, navigate } from "../utils/routes";
import { icon } from "../ui/icons";
import { busy } from "../ui/primitives";

export function renderAuth(root: HTMLElement, repo: Repository, denied = false) {
  const loginPanel = `
    ${repo.mode === "demo" ? '<div class="info-box"><b>บัญชีทดลอง</b><br>นิสิต: 68020001 / se68student<br>ผู้ดูแล: admin / se68admin</div>' : ""}
    <form id="login-form" class="login-form">
      <label class="field">Username หรืออีเมลมหาวิทยาลัย
        <input name="username" autocomplete="username" required placeholder="68020001 หรือ 68020001@up.ac.th">
      </label>
      <label class="field">Password
        <input name="password" type="password" autocomplete="current-password" required placeholder="กรอก Password">
      </label>
      <button class="button primary" type="submit">${icon("user")} เข้าสู่ระบบ</button>
    </form>
    <div class="divider">หรือ</div>
    <button class="button google-button" id="google-login" type="button"><b aria-hidden="true">G</b> เข้าสู่ระบบด้วย Google</button>
    <p class="auth-note google-requirement"><b>Google Login ใช้ได้เฉพาะอีเมล @up.ac.th</b><br>ระบบจะตรวจสอบอีเมลอีกครั้งหลัง Google ยืนยันตัวตน${repo.mode === "demo" ? " · ต้องเชื่อม Supabase ก่อนใช้งานจริง" : ""}</p>`;
  const deniedPanel = '<div class="info-box">สำหรับนิสิตรหัส 68 อีเมล @up.ac.th เท่านั้น ส่วนหน้าจัดการระบบจำกัดสิทธิ์เฉพาะ Admin</div><a class="button primary" href="' + href("dashboard") + '">กลับหน้าภาพรวม</a><button class="button" id="change-account">เปลี่ยนบัญชี</button>';

  root.innerHTML = `<div class="auth-page"><section class="auth-story"><a class="brand" href="${href("login")}"><span class="brand-symbol">S<span>68</span></span><span>SE68 <b>HUB</b></span></a><div><p class="eyebrow" style="color:#83d9a6">YOUR CAMPUS. CONNECTED.</p><h1>ทุกข่าวสาร<br>ทุกงานของรุ่น<br><span>อยู่ที่เดียวกัน</span></h1><p>พื้นที่สำหรับนิสิตวิศวกรรมซอฟต์แวร์ รุ่น 68 ติดตามเรื่องสำคัญและจัดการงานของคุณได้อย่างเป็นระเบียบ</p><div class="auth-features"><div class="auth-feature">${icon("news")} ไม่พลาดประกาศสำคัญ</div><div class="auth-feature">${icon("calendar")} กำหนดส่งแยกตาม Section</div><div class="auth-feature">${icon("check")} เห็นความคืบหน้าของตัวเอง</div></div></div><footer>UNIVERSITY OF PHAYAO · SOFTWARE ENGINEERING</footer></section>
  <section class="auth-content"><div class="auth-box"><div class="auth-icon">${icon(denied ? "shield" : "book")}</div><p class="eyebrow">SE68 INFORMATION HUB</p><h2>${denied ? "ไม่สามารถเข้าใช้งานหน้านี้" : "ยินดีต้อนรับกลับ"}</h2><p class="subtitle">${denied ? "หน้านี้ต้องใช้บัญชีที่มีสิทธิ์เหมาะสม กรุณาตรวจสอบบัญชีและบทบาทผู้ใช้" : "เข้าสู่ระบบเพื่อเริ่มต้นวันเรียนของคุณ"}</p>
  ${denied ? deniedPanel : loginPanel}
  <p class="auth-note">SE68 Hub · มหาวิทยาลัยพะเยา</p><div id="auth-error" role="alert" aria-live="polite"></div></div></section></div>`;

  const error = root.querySelector<HTMLElement>("#auth-error");
  const showError = (value: unknown) => { if (error) error.textContent = value instanceof Error ? value.message : "เข้าสู่ระบบไม่สำเร็จ"; };
  const form = root.querySelector<HTMLFormElement>("#login-form");
  if (form) form.onsubmit = event => {
    event.preventDefault();
    if (error) error.textContent = "";
    const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
    void busy(button, async () => {
      try {
        const data = new FormData(form);
        await repo.signInWithPassword(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
        const user = await repo.currentUser();
        navigate(user?.role === "admin" ? "admin" : "dashboard");
      } catch (value) { showError(value); }
    });
  };
  const google = root.querySelector<HTMLButtonElement>("#google-login");
  if (google) google.onclick = () => {
    if (error) error.textContent = "";
    void busy(google, async () => {
      try { await repo.signInWithGoogle(); }
      catch (value) { showError(value); }
    });
  };
  const change = root.querySelector<HTMLButtonElement>("#change-account");
  if (change) change.onclick = () => void busy(change, async () => { await repo.signOut(); navigate("login"); });
}

export function renderFailure(root: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  root.innerHTML = `<section class="empty" style="max-width:680px;margin:80px auto"><div class="empty-symbol">${icon("alert")}</div><h1>ไม่สามารถโหลดข้อมูลได้</h1><p>${e(message)}</p><div class="actions"><button class="button primary" id="retry-page">ลองอีกครั้ง</button><a class="button" href="${href("login")}">กลับหน้าเข้าสู่ระบบ</a></div></section>`;
  root.querySelector<HTMLButtonElement>("#retry-page")!.onclick = () => location.reload();
}
