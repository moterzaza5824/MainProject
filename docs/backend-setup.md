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

1. เปิด Google provider และใส่ Google OAuth client ID/secret สำหรับนิสิต
2. ตั้ง Site URL และ Redirect URLs ให้ครอบคลุม local/production โดยปลายทางของแอปคือ `/pages/dashboard/`
3. เปิด Email provider สำหรับผู้ดูแล (Username จะถูกแปลงเป็น `รหัสนิสิต@up.ac.th`)

Database trigger จะรับเฉพาะอีเมลรูปแบบ `6802xxxx@up.ac.th` และสร้าง `public.users` ด้วย role `student` อัตโนมัติ ค่า `hd=up.ac.th` ใน OAuth เป็นเพียง hint; trigger, constraint และ restrictive RLS เป็นผู้บังคับสิทธิ์จริง จึงไม่ต้องมี allowlist แยกตามข้อกำหนดปัจจุบัน

Google/OAuth ให้สิทธิ์ระดับนิสิตเสมอ แม้ profile ของบัญชีนั้นมี role `admin` ก็ตาม การใช้สิทธิ์ Admin ต้องเข้าใหม่ด้วย Username/Password เท่านั้น ฐานข้อมูลตรวจ `amr.method = password` จาก Supabase JWT ซ้ำใน `private.is_admin()` จึงไม่สามารถข้ามข้อกำหนดนี้ด้วยการแก้หน้าเว็บ

## 3. ตั้งผู้ดูแลคนแรก

1. สร้างหรือเพิ่ม Password identity ให้บัญชี `6802xxxx@up.ac.th` ผ่าน Supabase Auth จากฝั่ง server ที่เชื่อถือได้ ห้ามใช้ `service_role`/secret key ใน browser หรือไฟล์ `VITE_*` หากบัญชีเดิมสร้างผ่าน Google ให้ใช้ Auth Admin API `updateUserById()` จาก server เพื่อกำหนดรหัสผ่าน
2. เปิด Supabase Dashboard → SQL Editor แล้วตรวจ profile ที่ Auth trigger สร้างให้บัญชีเป้าหมายก่อน:

```sql
select uid, email, student_id, full_name, role
from public.users
where email = lower('6802XXXX@up.ac.th');
```

3. เมื่อยืนยันชื่อและรหัสถูกต้องแล้ว จึงเลื่อนสิทธิ์ด้วยบัญชีเจ้าของ project:

```sql
update public.users
set role = 'admin'
where email = lower('6802XXXX@up.ac.th')
  and student_id ~ '^6802[0-9]{4}$'
returning uid, email, full_name, role;
```

ผลลัพธ์ต้องคืนเพียง 1 แถวและ role เป็น `admin` ถ้าไม่คืนแถวให้หยุดและตรวจอีเมล ห้ามแก้เงื่อนไขให้กว้างหรือเปิดให้ client เลือก role เอง แนะนำให้มีผู้ดูแลจริงอย่างน้อย 2 คนและแต่ละคนใช้บัญชีของตัวเอง

เมื่อต้องการถอนสิทธิ์ ใช้คำสั่งต่อไปนี้และตรวจผลลัพธ์เช่นเดียวกัน:

```sql
update public.users
set role = 'student'
where email = lower('6802XXXX@up.ac.th')
returning uid, email, full_name, role;
```

หลังเพิ่มหรือถอนสิทธิ์ ให้บัญชีนั้น logout แล้ว login ใหม่ด้วย Username/Password เพื่อเข้า Admin การ login ด้วย Google ของบัญชีเดียวกันต้องเห็นเฉพาะสิทธิ์นิสิต

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
