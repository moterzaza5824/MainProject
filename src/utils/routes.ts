export const routes = {
  login: "/pages/auth/login/", denied: "/pages/auth/access-denied/", dashboard: "/pages/dashboard/",
  official: "/pages/posts/official/", general: "/pages/posts/general/", requests: "/pages/posts/requests/", postForm: "/pages/posts/create/",
  postDetail: "/pages/posts/detail/", assignments: "/pages/assignments/", assignmentDetail: "/pages/assignments/detail/",
  calendar: "/pages/calendar/", profile: "/pages/profile/", admin: "/pages/admin/dashboard/",
  approvals: "/pages/admin/approvals/", adminPosts: "/pages/admin/posts/", adminPostForm: "/pages/admin/posts/form/",
  adminAssignments: "/pages/admin/assignments/", assignmentForm: "/pages/admin/assignments/form/"
} as const;
export type RouteName = keyof typeof routes;
export function href(route: RouteName, id?: string): string {
  return import.meta.env.BASE_URL + routes[route].slice(1) + (id ? "?id=" + encodeURIComponent(id) : "");
}
export function navigate(route: RouteName, id?: string): void { location.assign(href(route, id)); }
