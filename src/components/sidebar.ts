const STORAGE_KEY = "se68-sidebar-collapsed";

export function mountSidebar(): void {
  // TODO: สร้าง Sidebar ส่วนกลาง เมนู active และปุ่มพับ/กาง
  const collapsed = localStorage.getItem(STORAGE_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
}
