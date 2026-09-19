import { mountNavbar } from "../components/navbar";
import { mountSidebar } from "../components/sidebar";

export function mountAppLayout(): void {
  mountNavbar();
  mountSidebar();
}
