# สัญญาเชื่อม Backend / Database

นี่คือ checklist ขั้นถัดไป ไม่ได้สร้างตารางหรือ deploy policies แล้ว

## เปิดโหมดจริงเมื่อ backend พร้อม

คัดลอก .env.example เป็น .env.local:

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

VITE_* จะอยู่ใน JavaScript ฝั่งผู้ใช้ ใส่เฉพาะ public URL/key **ห้าม service_role หรือ secret key** ต้อง restart dev server หรือ build ใหม่เมื่อเปลี่ยนค่า ข้อมูล demo ไม่ถูกย้ายเข้า DB อัตโนมัติ

## ตารางที่ adapter ใช้

อ้างอิง src/types/models.ts; ชื่อ field ต้องตรงกัน

| ตาราง | fields | constraint/default |
|---|---|---|
| users | uid, email, student_id, full_name, role, created_at, updated_at | uid UUID = auth.users.id; student/admin; unique email |
| posts | post_id, author_id, author_name, title, content, category, status, is_pinned, image_url, subject_id, subject_name, target_scope, target_sections, attachments, approved_by, created_at, updated_at | UUID PK; author/reviewer FK users; official/general; published/pending/rejected |
| assignments | assignment_id, created_by, subject_name, title, description, submission_channel, schedule_mode, due_dates, resources, created_at, updated_at | UUID PK; creator FK; UNIFIED/SPLIT |
| user_task_progress | id, uid, assignment_id, status, note, updated_at | id text uid_assignmentId; UNIQUE(uid,assignment_id); FK; TODO/DOING/DONE |

- post_id/assignment_id default gen_random_uuid(); timestamps เป็น timestamptz default now(); server ควรเป็นผู้กำหนด updated_at
- target_sections ใช้ integer[] เช่น {1,2}; ALL เป็น array ว่าง, SPECIFIC มี 1/2 ไม่ซ้ำ
- image_url, subject_id และ subject_name เป็น nullable สำหรับข่าวทั่วไป; ข่าวทางการต้องมี subject_id/subject_name และกำหนดผู้รับเป็นทุก Sec หรือ Sec ที่อยู่ในรายวิชานั้น
- attachments เป็น jsonb array ของ {name,url}; resources เป็น text[]; default []
- due_dates เป็น jsonb: UNIFIED มี all เท่านั้น; SPLIT มี sec_1/sec_2 อย่างน้อยหนึ่งค่า เป็น ISO timestamp
- approved_by nullable; client ไม่ควรเลือก role/owner/reviewer เอง
- title ≤160, content/description ≤10000, subject/channel ≤120, note ≤2000; validate ที่ server ซ้ำ
- กำหนด ON DELETE CASCADE assignments → progress ให้ตรงคำเตือน UI หรือเปลี่ยน flow ก่อนใช้ soft delete
- สร้าง index สำหรับ author_id, status/category/is_pinned/updated_at และ unique progress

## ชื่อผู้อนุมัติ

adapter อ่าน public_profiles เฉพาะ uid/full_name สร้าง view/endpoint ที่เปิดเฉพาะชื่อที่จำเป็นให้บัญชีที่ผ่านเกณฑ์ ห้ามเปิด users ทั้งตารางเพื่อแก้ปัญหานี้ อย่าเปิด email/student_id/role โดยไม่จำเป็น ต้องตรวจสิทธิ์ view/RPC แยกจาก RLS ของตารางด้วย

## Authentication

1. ตั้ง Google provider และ redirect allowlist ให้ตรง /pages/dashboard/ ทั้ง localhost/เว็บจริง
   สำหรับ Password Login ให้เปิด Email provider ใน Supabase ด้วย Username ที่กรอกเป็นรหัสนิสิตจะถูกแปลงเป็น `รหัสนิสิต@up.ac.th`
2. สร้าง users profile ฝั่ง server หลัง login แรก ใช้ auth.users.id ไม่ใช่ email หรือ Google sub
3. ตรวจ verified email ด้วย ^68[0-9]{6}@up\.ac\.th$ ที่ server; OAuth hd เป็น hint ไม่ใช่สิทธิ์
4. role เริ่มต้น student; ตั้ง admin ผ่านผู้ดูแลที่เชื่อถือได้ ห้าม client เลือก role จริง
5. ป้องกัน client เปลี่ยน uid/email/student_id/role
6. ตรวจ session หมดอายุ บัญชีไม่ผ่านเกณฑ์ และถอนสิทธิ์ทุก API

## RLS / state validation

| ข้อมูล | Student | Admin |
|---|---|---|
| users | อ่านบัญชีตนเอง | UI นี้ไม่จำเป็นต้องอ่านทุกบัญชี |
| published posts | อ่าน | อ่าน/จัดการ |
| pending/rejected | เฉพาะของตน | อ่าน/ตรวจสอบทั้งหมด |
| post insert | general → published; official → pending; author เป็นตนเอง | ตามกติกาผู้ดูแล |
| post update/delete | ของตน; official แก้แล้ว pending ใหม่ | จัดการทุกโพสต์; แก้คำผิดไม่ใช่อนุมัติ |
| assignments | อ่าน | เพิ่ม/แก้/ลบ |
| progress | เฉพาะ uid ตนเอง | เฉพาะตนเอง ไม่อ่าน note นิสิต |

Ownership RLS อย่างเดียวไม่พอ ต้องมี trigger/RPC ตรวจ state transition และ field ที่แก้ได้ โดยเฉพาะ is_pinned, approved_by, author_id, status

General ที่ downgrade/ปักหมุดแล้วต้องคง reviewer/pin เมื่อเจ้าของแก้ข้อความ ส่วน official ที่นิสิตแก้ต้อง reset pending/reviewer/pin

review ใช้ conditional update เฉพาะ pending; savePost มี updated_at check ระหว่างอ่าน/เขียน แต่ควรเพิ่ม optimistic concurrency ตั้งแต่เปิด editor หรือ transaction ที่ server เพื่อป้องกันเขียนทับงานเก่า

ต้องมี rate limit ฝั่ง server (demo จำกัดสร้าง 3 ครั้ง/นาที) และ validate links/content ซ้ำ Client guards ไม่ใช่มาตรการรักษาความปลอดภัย

## ยังต้องทำ

- migrations, indexes, triggers, public_profiles, RLS, rate limits
- Google OAuth/redirects และ profile provisioning
- Realtime/subscriptions และสิทธิ์เมื่อ session/role เปลี่ยน; ปัจจุบันโหลดเมื่อเข้าหน้าและหลัง mutation ของตนเอง
- ทดสอบกับ 2 students + 1 admin: อ่าน note คนอื่น, เปลี่ยน role, เผยแพร่ official เอง, อ่าน pending คนอื่น, เขียนพร้อมกัน
- ตรวจ network errors, duplicate writes, backup และ production logging

เอกสารทางการ: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Upsert](https://supabase.com/docs/reference/javascript/upsert)
