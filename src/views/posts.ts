import type { Context } from "../ui/context";
import type { PostRow } from "../types/models";
import { e, externalLink, markdown, safeUrl } from "../utils/html";
import { href, navigate } from "../utils/routes";
import { formatDate } from "../utils/tasks";
import { heading } from "../ui/shell";
import { badge, busy, confirmAction, dialog, empty, toast } from "../ui/primitives";
import { icon } from "../ui/icons";
export const postStatusLabel = (p: PostRow) => ({published:"เผยแพร่แล้ว",pending:"รออนุมัติ",rejected:"ไม่อนุมัติ"}[p.status]);
const audienceLabel=(post:PostRow)=>post.target_scope==="ALL"?"ทุก Sec":post.target_sections.map(section=>`Sec ${section}`).join(", ");
const postContext=(post:PostRow)=>post.subject_name?badge(post.subject_name,"subject")+badge(audienceLabel(post),"audience"):"";
const postImage=(post:PostRow,className:string)=>{const url=post.image_url?safeUrl(post.image_url):null;return url?`<button class="post-image-button" type="button" data-image-url="${e(url)}" data-image-title="${e(post.title)}" aria-label="เปิดดูภาพเต็มของ ${e(post.title)}"><img class="${className}" src="${e(url)}" alt="ภาพประกอบ ${e(post.title)}" loading="lazy" decoding="async"><span class="image-open-hint">กดเพื่อดูภาพเต็ม</span></button>`:"";};
const openPostImage=(url:string,title:string)=>{const safe=safeUrl(url);if(!safe)return;const viewer=dialog(title,`<img class="image-viewer-image" src="${e(safe)}" alt="ภาพประกอบ ${e(title)}">`,true);viewer.classList.add("image-viewer");};
export function postCard(post: PostRow) {
  return `<article class="post-card ${post.is_pinned?"pinned":""}"><div class="post-card-head"><span class="author"><span class="avatar">${e(post.author_name.slice(0,1))}</span><span><strong>${e(post.author_name)}</strong><small>${e(formatDate(post.created_at,false))}</small></span></span><div class="post-card-flags" aria-label="รายวิชา กลุ่มผู้รับ และสถานะ">${postContext(post)}${post.is_pinned?badge("ปักหมุด","pin"):""}</div></div><div class="post-card-kind">${badge(post.category==="official"?"ประกาศทางการ":"ข่าวทั่วไป",post.category)}${post.status!=="published"?badge(postStatusLabel(post),post.status):""}</div><h2><a href="${href("postDetail",post.post_id)}">${e(post.title)}</a></h2><p>${e(post.content.replace(/[#*]/g,"").slice(0,150))}${post.content.length>150?"…":""}</p>${postImage(post,"post-card-image")}<div class="post-card-footer"><a class="post-read-more" href="${href("postDetail",post.post_id)}" aria-label="อ่าน ${e(post.title)}">ดูรายละเอียด ${icon("arrow")}</a></div></article>`;
}
export function renderPosts(ctx: Context, initialCategory: "official" | "general" | "requests" | "admin" | "approvals") {
  const admin = initialCategory==="admin", approval=initialCategory==="approvals", requests=initialCategory==="requests";
  let boardCategory:"official"|"general"=initialCategory==="general"?"general":"official", own=false, page=1, tab="pending";
  let currentRows: PostRow[] = [], request = 0;
  const formRoute=ctx.user.role==="admin"?"adminPostForm":"postForm";
  ctx.root.innerHTML=heading(requests?"คำขอประกาศของฉัน":approval?"อนุมัติประกาศ":admin?"จัดการประกาศ":"ข่าวสาร",requests?"ติดตามคำขอประกาศทางการ โดยไม่ปะปนกับข่าวที่เผยแพร่แล้ว":approval?"ตรวจสอบคำขอ ก่อนเผยแพร่ข่าวสำคัญให้เพื่อนร่วมรุ่น":admin?"จัดการเนื้อหา สถานะ และประกาศที่ปักหมุด":"เลือกดูประกาศสำคัญและข่าวสารทั่วไปของรุ่นได้ในหน้าเดียว",requests?"MY ANNOUNCEMENT REQUESTS":approval?"APPROVAL WORKFLOW":admin?"CONTENT MANAGEMENT":"NEWS & ANNOUNCEMENTS",
  '<a class="button primary" href="'+href(formRoute)+'">'+icon("plus")+' สร้างโพสต์</a>')+
  (requests?'<div class="tabs"><button class="active" data-tab="pending">รออนุมัติ</button><button data-tab="rejected">ไม่อนุมัติ</button></div>':approval?'<div class="tabs"><button class="active" data-tab="pending">รออนุมัติ</button><button data-tab="processed">ดำเนินการแล้ว</button></div>':admin?"":'<div class="tabs"><button class="'+(boardCategory==="official"?"active":"")+'" data-category="official">ประกาศทางการ</button><button class="'+(boardCategory==="general"?"active":"")+'" data-category="general">ประกาศทั่วไป</button></div>')+
  (admin?'<div class="filter-panel"><label>แสดงรายการ<select id="post-owner"><option value="all">ทั้งหมด</option><option value="mine">ประกาศของฉัน</option></select></label></div>':"")+'<div id="posts-results"></div>';
  const results=ctx.root.querySelector<HTMLElement>("#posts-results")!;
  const ownerSelect=ctx.root.querySelector<HTMLSelectElement>("#post-owner");
  if(ownerSelect)ownerSelect.value=own?"mine":"all";
  const render=async()=>{
    const token=++request;
    results.innerHTML='<div class="loading" role="status">กำลังโหลดประกาศ…</div>';
    try {
    const result=await ctx.repo.listPosts({own:requests?true:own||undefined,page,pageSize:10,
      ...(requests?{category:"official" as const,status:tab as "pending"|"rejected"}:approval?(tab==="pending"?{status:"pending" as const}:{processed:true}):!admin?{category:boardCategory,status:"published" as const}:{})});
    if(token!==request)return;
    const pages=Math.max(1,Math.ceil(result.total/10));
    if(page>pages){page=pages;await render();return;}
    const slice=currentRows=result.rows, rows={length:result.total};
    results.innerHTML='<div class="results-toolbar"><div><h2>'+(requests?(tab==="pending"?"กำลังรอการตรวจสอบ":"คำขอที่ไม่อนุมัติ"):own?"ประกาศของฉัน":approval?"คำขอประกาศ":"รายการประกาศ")+'</h2><small>'+rows.length+' รายการ</small></div></div>'+
    (slice.length?(admin||approval?'<div class="table-wrap"><table class="table"><thead><tr><th>ประกาศ / ผู้เขียน</th><th>ประเภท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>'+slice.map(p=>`<tr><td class="title-cell"><a href="${href("postDetail",p.post_id)}"><strong>${e(p.title)}</strong></a><small>${e(p.author_name)}${p.subject_name?` · ${e(p.subject_name)} · ${e(audienceLabel(p))}`:""}</small></td><td>${badge(p.category==="official"?"ทางการ":"ทั่วไป",p.category)}</td><td>${badge(postStatusLabel(p),p.status)}</td><td><div class="actions">${approval&&p.status==="pending"?'<a class="button small" href="'+href("postDetail",p.post_id)+'">ตรวจสอบ</a><button class="button small primary" data-approve="'+e(p.post_id)+'">อนุมัติ</button>':'<a class="button small" href="'+href("adminPostForm",p.post_id)+'" aria-label="แก้ไข '+e(p.title)+'">'+icon("edit")+'</a>'+(p.status==="published"?'<button class="button small" data-pin="'+e(p.post_id)+'" aria-label="'+(p.is_pinned?"เลิกปักหมุด":"ปักหมุด")+' '+e(p.title)+'">'+icon("pin")+(p.is_pinned?" เลิกปักหมุด":"")+'</button>':"")+'<button class="button small danger" data-delete="'+e(p.post_id)+'" aria-label="ลบ '+e(p.title)+'">'+icon("trash")+'</button>'}</div></td></tr>`).join("")+'</tbody></table></div>':'<div class="post-grid">'+slice.map(postCard).join("")+"</div>"):empty(approval?"ไม่มีคำขอในรายการนี้":"ยังไม่มีประกาศที่ตรงกับตัวกรอง","ยังไม่มีข่าวสารในหมวดนี้ กรุณากลับมาตรวจสอบใหม่"))+
    `<div class="pagination"><span>หน้า ${page} จาก ${pages} · หน้าละ 10 รายการ</span><div class="actions"><button class="button small" data-page="-1" ${page===1?"disabled":""}>${icon("left")} ก่อนหน้า</button><button class="button small" data-page="1" ${page===pages?"disabled":""}>ถัดไป ${icon("right")}</button></div></div>`;
    } catch(error) {
      if(token!==request)return;
      results.innerHTML=empty("โหลดประกาศไม่สำเร็จ",error instanceof Error?error.message:"กรุณาลองใหม่",'<button class="button" data-retry>ลองอีกครั้ง</button>');
    }
  };
  ctx.root.querySelector<HTMLSelectElement>("#post-owner")?.addEventListener("change",event=>{own=(event.target as HTMLSelectElement).value==="mine";page=1;render();});
  ctx.root.addEventListener("click",event=>{
    const b=(event.target as Element).closest<HTMLButtonElement>("button");if(!b)return;
    if(b.dataset.imageUrl){openPostImage(b.dataset.imageUrl,b.dataset.imageTitle??"ภาพประกอบข่าวสาร");return;}
    if(b.dataset.category){boardCategory=b.dataset.category as "official"|"general";page=1;ctx.root.querySelectorAll("[data-category]").forEach(el=>el.classList.toggle("active",el===b));render();}
    if(b.dataset.tab){tab=b.dataset.tab;page=1;ctx.root.querySelectorAll("[data-tab]").forEach(el=>el.classList.toggle("active",el===b));render();}
    if(b.dataset.page){page+=Number(b.dataset.page);render();}
    if(b.hasAttribute("data-retry"))void render();
    if(b.dataset.pin)void busy(b,async()=>{const p=currentRows.find(p=>p.post_id===b.dataset.pin);if(!p)return;await ctx.repo.pinPost(p.post_id,!p.is_pinned);await ctx.refresh();await render();toast(p.is_pinned?"ยกเลิกปักหมุดแล้ว":"ปักหมุดแล้ว");});
    if(b.dataset.approve)void busy(b,async()=>{if(await confirmAction("อนุมัติประกาศ","ประกาศนี้จะเผยแพร่บนบอร์ดทางการทันที","อนุมัติ")){await ctx.repo.reviewPost(b.dataset.approve!,"approve");await ctx.refresh();render();toast("อนุมัติและเผยแพร่แล้ว");}});
    if(b.dataset.delete)void busy(b,async()=>{if(await confirmAction("ลบประกาศ","ประกาศที่ลบจะไม่สามารถเรียกคืนผ่านหน้าจอนี้ได้","ลบประกาศ")){await ctx.repo.deletePost(b.dataset.delete!);await ctx.refresh();render();toast("ลบประกาศแล้ว");}});
  });render();
}
export function renderPostDetail(ctx:Context){
  const id=new URLSearchParams(location.search).get("id"),post=ctx.data.posts.find(p=>p.post_id===id);
  if(!post){ctx.root.innerHTML=empty("ไม่พบประกาศนี้","ประกาศอาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง",'<a class="button" href="'+href("official")+'">กลับไปบอร์ดประกาศ</a>');return;}
  const editable=post.author_id===ctx.user.uid||ctx.user.role==="admin";
  const reviewer={full_name:ctx.reviewerName ?? ctx.data.users.find(u=>u.uid===post.approved_by)?.full_name};
  const backRoute=post.status!=="published"&&ctx.user.role==="student"?"requests":post.category==="official"?"official":"general";
  ctx.root.innerHTML=heading("รายละเอียดประกาศ","ข่าวสารสำหรับนิสิต SE68","ANNOUNCEMENT",'<a class="button" href="'+href(backRoute)+'">'+icon("left")+' กลับไปบอร์ด</a>')+
  `<div class="detail-grid"><article class="panel"><div class="post-detail-head"><span class="author"><span class="avatar">${e(post.author_name.slice(0,1))}</span><span><strong>${e(post.author_name)}</strong><small>${e(formatDate(post.created_at))}</small></span></span><div class="task-top">${badge(post.category==="official"?"ประกาศทางการ":"ข่าวทั่วไป",post.category)}${badge(postStatusLabel(post),post.status)}${postContext(post)}${post.is_pinned?badge("ปักหมุด","pin"):""}</div></div><h2 class="detail-title">${e(post.title)}</h2><div class="prose">${markdown(post.content)}</div>${postImage(post,"post-detail-image")}<section class="detail-section"><h3>ลิงก์เอกสารแนบ</h3>${post.attachments.length?post.attachments.map(a=>externalLink(a.url,a.name)).join(""):'<p class="note-hint">ไม่มีเอกสารแนบ</p>'}</section></article>
  <aside class="stack"><div class="panel"><h2>ข้อมูลประกาศ</h2><dl class="profile-fields" style="display:block">${post.subject_name?`<dt>รายวิชา</dt><dd>${e(post.subject_name)}</dd><dt style="margin-top:16px">กลุ่มผู้รับ</dt><dd>${e(audienceLabel(post))}</dd>`:""}<dt${post.subject_name?' style="margin-top:16px"':""}>อัปเดตล่าสุด</dt><dd>${e(formatDate(post.updated_at))}</dd>${post.approved_by?'<dt style="margin-top:16px">ผู้ดำเนินการ</dt><dd>'+e(reviewer?.full_name??"ผู้ดูแลระบบ")+"</dd>":""}</dl>${editable?'<div class="stack"><a class="button" href="'+href(ctx.user.role==="admin"?"adminPostForm":"postForm",post.post_id)+'">'+icon("edit")+' แก้ไขประกาศ</a><button type="button" class="button danger" id="delete-post">'+icon("trash")+' ลบประกาศ</button></div>':""}</div>
  ${ctx.user.role==="admin"&&post.status==="pending"?'<div class="panel"><h2>ตรวจสอบคำขอ</h2><p class="note-hint">เลือกผลการตรวจสอบหลังอ่านเนื้อหาและลิงก์แนบแล้ว</p><div class="stack" style="margin-top:18px"><button class="button primary" data-review="approve">อนุมัติเป็นข่าวทางการ</button><button class="button" data-review="general">เผยแพร่เป็นข่าวทั่วไป</button><button class="button danger" data-review="reject">ไม่อนุมัติ</button></div></div>':""}
  ${post.status==="pending"&&ctx.user.role!=="admin"?'<div class="info-box">ประกาศกำลังรอการตรวจสอบจากผู้ดูแล และยังไม่แสดงบนบอร์ดทางการ</div>':""}</aside></div>`;
  ctx.root.querySelector<HTMLButtonElement>("[data-image-url]")?.addEventListener("click",event=>{const button=event.currentTarget as HTMLButtonElement;openPostImage(button.dataset.imageUrl!,button.dataset.imageTitle??post.title);});
  ctx.root.querySelector<HTMLButtonElement>("#delete-post")?.addEventListener("click",event=>void busy(event.currentTarget as HTMLButtonElement,async()=>{if(await confirmAction("ลบประกาศ","ยืนยันการลบประกาศนี้","ลบ")){await ctx.repo.deletePost(post.post_id);navigate(backRoute);}}));
  ctx.root.querySelectorAll<HTMLButtonElement>("[data-review]").forEach(button=>button.onclick=()=>void busy(button,async()=>{
    const action=button.dataset.review as "approve"|"reject"|"general";
    const message=action==="approve"?"เผยแพร่ประกาศนี้บนบอร์ดทางการ":action==="general"?"เปลี่ยนหมวดหมู่และเผยแพร่บนบอร์ดทั่วไป":"ไม่เผยแพร่ประกาศนี้ และแจ้งสถานะไม่อนุมัติให้เจ้าของเห็น";
    if(await confirmAction("ยืนยันผลการตรวจสอบ",message,"ยืนยัน")){await ctx.repo.reviewPost(post.post_id,action);navigate("approvals");}
  }));
}
