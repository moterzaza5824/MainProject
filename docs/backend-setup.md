# ตั้งค่า Backend และฐานข้อมูล

โค้ด Backend ใช้ Supabase Auth + PostgreSQL + Row Level Security โดย migration อยู่ใน `supabase/migrations/` และข้อมูลตั้งต้นอยู่ใน `supabase/seed.sql`

## 1. สร้างและเชื่อม Supabase project

ติดตั้ง Supabase CLI แล้ว login จากนั้นรันจาก root ของโปรเจกต์:

```sh
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --linked --include-seed
```

รัน `supabase init` เฉพาะเมื่อยังไม่มี `supabase/config.toml`; ถ้า CLI แจ้งว่า initialize แล้วให้ข้ามคำสั่งนี้

สำหรับ local stack ที่มี Docker ให้ใช้ `supabase start` และ `supabase db reset --local` แทน คำสั่ง reset จะล้าง local database แล้วรัน migrations และ seed ใหม่ ห้ามใช้ `db reset --linked` กับ production โดยไม่ตั้งใจ

## 2. ตั้งค่า Authentication

ใน Supabase Dashboard:

1. เปิด Google provider และใส่ Google OAuth client ID/secret
2. ตั้ง Site URL และ Redirect URLs ให้ครอบคลุม local/production โดยปลายทางของแอปคือ `/pages/dashboard/`
3. หากต้องการ Username/Password ให้เปิด Email provider ด้วย (Username จะถูกแปลงเป็น `รหัสนิสิต@up.ac.th`)

Database trigger จะรับเฉพาะอีเมลรูปแบบ `68xxxxxx@up.ac.th` และสร้าง `public.users` ด้วย role `student` อัตโนมัติ ค่า `hd=up.ac.th` ใน OAuth เป็นเพียง hint; trigger และ constraint เป็นผู้บังคับสิทธิ์จริง

## 3. ตั้งผู้ดูแลคนแรก

ให้ผู้ดูแล login ด้วยบัญชีมหาวิทยาลัยหนึ่งครั้งก่อน แล้วรันใน SQL Editor ด้วยบัญชีเจ้าของ project:

```sql
update public.users
set role = 'admin'
where email = '68XXXXXX@up.ac.th';
```

ตรวจให้แน่ใจว่าแก้เพียงบัญชีที่ได้รับมอบหมายจริง ห้ามเปิดให้ client เลือก role เอง

## 4. เปิดโหมด Supabase ใน frontend

สร้าง `.env.local` (ไฟล์นี้ถูก ignore จาก Git):

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

ใช้ได้เฉพาะ public anon/publishable key ห้ามใส่ `service_role` หรือ secret key ในตัวแปร `VITE_*`

## 5. ตรวจสอบ

```sh
npm test
npm run typecheck
npm run build
```

ก่อน production ให้ทดสอบจริงอย่างน้อย 2 บัญชีนิสิต + 1 บัญชีผู้ดูแล: การมองเห็นข้าม Sec, pending/rejected ของคนอื่น, note ความคืบหน้าของคนอื่น, การแก้ role, rate limit และการอนุมัติประกาศ

Migration สร้าง 6 ตารางหลัก (`users`, `subjects`, `enrollments`, `posts`, `assignments`, `user_task_progress`), profile trigger, validation triggers, indexes, view ชื่อสาธารณะ และ RLS ทุกตาราง ส่วน Realtime, Storage upload, backup/restore drill และ production monitoring ยังเป็นงานเฟสถัดไป
