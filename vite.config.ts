import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const page = (path: string) => resolve(projectDirectory, "src/pages", path, "index.html");

export default defineConfig({
  root: "src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(projectDirectory, "src/index.html"),
        login: page("auth/login"),
        accessDenied: page("auth/access-denied"),
        dashboard: page("dashboard"),
        officialPosts: page("posts/official"),
        generalPosts: page("posts/general"),
        createPost: page("posts/create"),
        assignments: page("assignments"),
        assignmentDetail: page("assignments/detail"),
        calendar: page("calendar"),
        profile: page("profile"),
        adminDashboard: page("admin/dashboard"),
        adminApprovals: page("admin/approvals"),
        adminPosts: page("admin/posts"),
        adminAssignments: page("admin/assignments")
      }
    }
  }
});
