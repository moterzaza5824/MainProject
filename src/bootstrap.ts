import "./styles/app.css";
import { AccessDeniedError } from "./utils/errors";
import { getRepository } from "./services/repository";
import { href, type RouteName, routes } from "./utils/routes";
import { mountShell } from "./ui/shell";
import type { Context } from "./ui/context";
import { renderAuth, renderFailure } from "./views/auth";
import { renderDashboard, renderAdminTasks, renderProfile } from "./views/overview";
import { renderTasks, renderTaskDetail } from "./views/tasks";
import { renderPostDetail, renderPosts } from "./views/posts";
import { renderAssignmentForm, renderPostForm } from "./views/forms";
import { renderCatalog } from "./views/catalog";
import { renderEnrollment } from "./views/enrollment";
import { loadCatalog } from "./services/catalog";
import { applyStudentVisibility, canViewPostForEnrollments, loadEnrollments } from "./services/enrollment";
async function bootstrap() {
  const root=document.querySelector<HTMLElement>("#app")!;
  root.innerHTML='<div class="loading" role="status">กำลังเตรียมพื้นที่ของคุณ…</div>';
  try {
    const repo=await getRepository();
    const path=location.pathname.replace(/index\.html$/,"").replace(/\/?$/,"/");
    const route=(Object.keys(routes) as RouteName[]).find(name=>path===href(name))??"login";
    if(route==="denied"){renderAuth(root,repo,true);return;}
    const user=await repo.currentUser();
    if(route==="login"){
      if(user){location.replace(href("dashboard"));return;}
      renderAuth(root,repo);return;
    }
    if(!user){location.replace(href("login"));return;}
    if(route==="enrollment"&&user.role!=="student"){location.replace(href("dashboard"));return;}
    const isAdmin=["admin","approvals","adminPosts","adminPostForm","adminAssignments","assignmentForm","adminCatalog"].includes(route);
    if(isAdmin&&user.role!=="admin"){location.replace(href("denied"));return;}
    let active=route==="assignmentDetail"?"assignments":route==="postDetail"||route==="postForm"||route==="general"?"official":route==="adminPostForm"?"adminPosts":route==="assignmentForm"?"adminAssignments":route;
    const content=mountShell(user,active,repo);
    try {
      const enrollments=user.role==="student"?loadEnrollments(user.uid):undefined;
      const loadData=async()=>{
        const raw=await repo.snapshot();
        if(user.role!=="student"||!enrollments)return raw;
        const feed=await repo.listPosts({status:"published",pageSize:15,enrollments});
        raw.posts=[...new Map([...raw.posts,...feed.rows].map(post=>[post.post_id,post])).values()];
        return applyStudentVisibility(raw,user,enrollments,loadCatalog(raw.assignments));
      };
      let data=await loadData();
      const postId = new URLSearchParams(location.search).get("id");
      if (postId && ["postDetail","postForm","adminPostForm"].includes(route)) {
        const post = await repo.getPost(postId);
        if (post&&(user.role!=="student"||!enrollments||canViewPostForEnrollments(post,enrollments,user.uid))) data.posts = [...data.posts.filter(p => p.post_id !== postId), post];
      }
      const selectedPost=data.posts.find(p=>p.post_id===postId);
      const reviewerName=selectedPost?.approved_by ? await repo.getReviewerName(selectedPost.approved_by) : null;
      if(route==="postDetail" && selectedPost) {
        active=selectedPost.status!=="published"&&selectedPost.author_id===user.uid&&user.role==="student"?"requests":"official";
        document.querySelectorAll("#sidebar-nav a").forEach(link=>{
          if(link.getAttribute("href")===href(active))link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
        });
      }
      const ctx:Context={root:content,repo,user,data,enrollments,reviewerName,async refresh(){ctx.data=await loadData();}};
      switch(route){
        case "dashboard":renderDashboard(ctx);break;
        case "admin":renderDashboard(ctx,true);break;
        case "assignments":renderTasks(ctx);break;
        case "calendar":renderTasks(ctx,true);break;
        case "enrollment":renderEnrollment(ctx);break;
        case "assignmentDetail":renderTaskDetail(ctx);break;
        case "official":renderPosts(ctx,"official");break;
        case "general":renderPosts(ctx,"general");break;
        case "requests":renderPosts(ctx,"requests");break;
        case "adminPosts":renderPosts(ctx,"admin");break;
        case "approvals":renderPosts(ctx,"approvals");break;
        case "postDetail":renderPostDetail(ctx);break;
        case "postForm":case "adminPostForm":renderPostForm(ctx);break;
        case "assignmentForm":renderAssignmentForm(ctx);break;
        case "adminAssignments":renderAdminTasks(ctx);break;
        case "adminCatalog":renderCatalog(ctx);break;
        case "profile":renderProfile(ctx);break;
      }
    } catch(error){renderFailure(content,error);}
  } catch(error){if(error instanceof AccessDeniedError){location.replace(href("denied"));return;}renderFailure(root,error);}
}
void bootstrap();
