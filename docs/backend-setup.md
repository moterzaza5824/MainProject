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
3. เปิด Email provider สำหรับผู้ดูแล ซึ่งใช้อีเมลทั่วไปและ Password

หลังใช้ migration 014: Google บัญชี `6802xxxx@up.ac.th` ได้ role `student` อัตโนมัติ ส่วน Google อีเมลอื่นเริ่มเป็น `pending_member` และเปิดได้เฉพาะหน้าขอสิทธิ์ `/pages/auth/request-access/` ผู้ใช้กด Request แล้วแอดมินตรวจที่ `/pages/admin/access-requests/` เมื่ออนุมัติจึงใช้งานเหมือนนิสิตได้ โดยไม่ต้องมีรหัสนิสิต ส่วน Email/Password ภายนอกยังเริ่มเป็น `pending_admin` ตามเดิม

ระบบไม่ส่งอีเมลแจ้งเตือน: คำขออยู่ในหน้าแอดมิน หลังส่งแล้วผู้ใช้เห็นสถานะรออนุมัติและกด “ตรวจสอบสถานะ” เพื่อเข้าแอปเมื่อได้รับอนุมัติ คำขอไม่ซ้ำต่อบัญชี; คำขอที่ปฏิเสธแล้วไม่ถูกส่งซ้ำอัตโนมัติ

Google OAuth ไม่ส่ง `hd` เพื่อบังคับเลือกโดเมนแล้ว แต่ Google Cloud → Audience ต้องอนุญาตบัญชีภายนอกด้วย หากแอปยังอยู่ใน Testing ให้เพิ่มบัญชีที่จะทดสอบใน Test users ตาม [คู่มือ Google OAuth ของ Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)

Google/OAuth ให้สิทธิ์ระดับนิสิตเสมอ แม้ profile ของบัญชีนั้นมี role `admin` ก็ตาม การใช้สิทธิ์ Admin ต้องเข้าใหม่ด้วย Username/Password เท่านั้น ฐานข้อมูลตรวจ `amr.method = password` จาก Supabase JWT ซ้ำใน `private.is_admin()` จึงไม่สามารถข้ามข้อกำหนดนี้ด้วยการแก้หน้าเว็บ

## 3. เพิ่มผู้ดูแลด้วยอีเมลทั่วไป

1. เปิด Supabase Dashboard → Authentication → Users → Add user → Create new user กรอกอีเมลทั่วไปและ Password ที่แข็งแรง พร้อม Auto confirm user ห้ามใช้รหัสผ่านร่วมกันหลายคน
2. เปิด Supabase Dashboard → SQL Editor แล้วตรวจ profile ที่ Auth trigger สร้างให้บัญชีเป้าหมายก่อน:

```sql
select uid, email, student_id, full_name, role
from public.users
where email = lower('admin@example.com');
```

3. เมื่อยืนยันชื่อและรหัสถูกต้องแล้ว จึงเลื่อนสิทธิ์ด้วยบัญชีเจ้าของ project:

```sql
update public.users
set role = 'admin'
where email = lower('admin@example.com')
  and role = 'pending_admin'
  and student_id is null
returning uid, email, full_name, role;
```

ผลลัพธ์ต้องคืนเพียง 1 แถวและ role เป็น `admin` ถ้าไม่คืนแถวให้หยุดและตรวจอีเมล ห้ามแก้เงื่อนไขให้กว้างหรือเปิดให้ client เลือก role เอง แนะนำให้มีผู้ดูแลจริงอย่างน้อย 2 คนและแต่ละคนใช้บัญชีของตัวเอง

เมื่อต้องการถอนสิทธิ์ ใช้คำสั่งต่อไปนี้และตรวจผลลัพธ์เช่นเดียวกัน:

```sql
update public.users
set role = 'pending_admin'
where email = lower('admin@example.com')
  and student_id is null
returning uid, email, full_name, role;
```

หลังเพิ่มหรือถอนสิทธิ์ ให้บัญชีนั้น logout แล้ว login ใหม่ด้วย Email/Password เพื่อเข้า Admin บัญชีผู้ดูแลภายนอกที่เข้า Google ต้องผ่านคำขอสมาชิกเช่นเดียวกับอีเมลภายนอกอื่น และได้เฉพาะสิทธิ์นิสิตหลังอนุมัติ

## ใช้งานคำขอ Google ภายนอก (migration 014)

โค้ดใหม่ต้องใช้ migration 014 ในฐานข้อมูลก่อน deploy frontend:

```sh
supabase db push --linked
npx supabase db query --linked --file tests/e2e/access-requests-rls-smoke.sql
```

`access_requests` เก็บ uid, สถานะ, เวลาส่ง, ผู้ตรวจ และเวลาตรวจ ชื่อ/อีเมลอ่านจาก profile ที่สร้างจาก Auth ไม่รับอีเมลจากแบบฟอร์ม การส่งคำขอและตรวจใช้ RPC `request_app_access()` / `review_app_access()` เท่านั้น ผู้ใช้ที่รอ/ถูกปฏิเสธอ่านได้เฉพาะ profile และคำขอของตนเอง ไม่มีสิทธิ์ในตารางแอป ส่วนผู้ตรวจต้องเป็น Admin ที่เข้าสู่ระบบด้วย Password

migration 014 ใช้กับ Supabase ที่เชื่อมอยู่แล้วเมื่อ 10 ตุลาคม 2026 และผ่าน `access-requests-rls-smoke.sql` พร้อม `supabase-rls-smoke.sql` บนฐานข้อมูลจริง ทั้งสองชุด rollback ข้อมูลทดสอบทั้งหมด ยังต้องตรวจ Google OAuth ด้วยบัญชีภายนอกจริงผ่านเบราว์เซอร์

Production บน `se68-hub.vercel.app` deploy ฟีเจอร์นี้แล้ว หลังปลด resource `supabase-fuchsia-diamond` ที่สถานะ Suspended ออกจากโปรเจกต์ Vercel (ไม่ได้ลบ resource) เว็บใช้ฐานข้อมูลเดิมผ่าน `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ที่ตั้งแยกไว้ การเชื่อม resource ที่ถูกระงับกลับอาจทำให้ deployment ล้มเหลวด้วย `Resource provisioning failed`

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
