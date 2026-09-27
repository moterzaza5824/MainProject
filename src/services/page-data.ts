import type { EnrollmentRow, MasterCatalog, Repository, Snapshot, UserRow } from "../types/models";
import type { RouteName } from "../utils/routes";
import { applyStudentVisibility, canViewPostForEnrollments } from "./enrollment";

export interface PageData {
  data: Snapshot;
  catalog?: MasterCatalog;
  enrollments?: EnrollmentRow[];
  reviewerName?: string | null;
}

const snapshotRoutes = new Set<RouteName>([
  "dashboard",
  "admin",
  "assignments",
  "calendar",
  "assignmentDetail",
  "assignmentForm",
  "adminAssignments"
]);

const catalogRoutes = new Set<RouteName>([
  "dashboard",
  "assignments",
  "calendar",
  "assignmentDetail",
  "enrollment",
  "postForm",
  "adminPostForm",
  "assignmentForm",
  "adminCatalog"
]);

const enrollmentRoutes = new Set<RouteName>([
  "dashboard",
  "assignments",
  "calendar",
  "assignmentDetail",
  "enrollment",
  "official",
  "general",
  "requests",
  "postDetail",
  "postForm"
]);

export function pageDataRequirements(route: RouteName, role: UserRow["role"], mode: Repository["mode"]) {
  return {
    snapshot: snapshotRoutes.has(route) || (route === "adminCatalog" && mode === "demo"),
    catalog: catalogRoutes.has(route) && (role === "student" || ["adminPostForm", "assignmentForm", "adminCatalog"].includes(route)),
    enrollments: role === "student" && enrollmentRoutes.has(route),
    post: ["postDetail", "postForm", "adminPostForm"].includes(route),
    ownPosts: route === "profile"
  };
}

const emptySnapshot = (user: UserRow): Snapshot => ({
  users: [user],
  posts: [],
  assignments: [],
  progress: [],
  post_counts: { pending: 0, published: 0 }
});

export async function loadPageData(repo: Repository, user: UserRow, route: RouteName): Promise<PageData> {
  const requirements = pageDataRequirements(route, user.role, repo.mode);
  const postId = new URLSearchParams(location.search).get("id");
  const [rawData, subjects, enrollments, selectedPost, ownPosts] = await Promise.all([
    requirements.snapshot ? repo.snapshot() : Promise.resolve(emptySnapshot(user)),
    requirements.catalog ? repo.getSubjects() : Promise.resolve(undefined),
    requirements.enrollments ? repo.getEnrollments() : Promise.resolve(undefined),
    requirements.post && postId ? repo.getPost(postId) : Promise.resolve(null),
    requirements.ownPosts ? repo.listPosts({ own: true, pageSize: 10 }) : Promise.resolve(undefined)
  ]);

  const catalog = subjects ? { subjects, channels: [] } : undefined;
  let data = rawData;
  if (user.role === "student" && enrollments && catalog && requirements.snapshot) {
    data = applyStudentVisibility(data, user, enrollments, catalog);
  }

  if (route === "dashboard" && user.role === "student" && enrollments) {
    const feed = await repo.listPosts({ status: "published", pageSize: 3, enrollments });
    data.posts = [...new Map([...data.posts, ...feed.rows].map(post => [post.post_id, post])).values()];
  }

  if (ownPosts) data.posts = ownPosts.rows;
  if (selectedPost && (!enrollments || canViewPostForEnrollments(selectedPost, enrollments, user.uid))) {
    data.posts = [selectedPost];
  }

  const visiblePost = data.posts.find(post => post.post_id === postId);
  const reviewerName = route === "postDetail" && visiblePost?.approved_by
    ? await repo.getReviewerName(visiblePost.approved_by)
    : null;
  return { data, catalog, enrollments, reviewerName };
}
