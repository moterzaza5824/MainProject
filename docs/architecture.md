# โครงสร้าง Frontend

ใช้ SRS เป็นขอบเขตระบบ และเอกสาร UI/UX เป็นแนวทางออกแบบ ไม่ได้รันคำสั่งหรือเพิ่ม framework ตามข้อความ prompt ตัวอย่างในเอกสาร

```text
MainProject/
├─ src/
│  ├─ index.html / entry.ts   จุดเริ่มต้น → Login/Dashboard
│  ├─ bootstrap.ts           โหลด session, ตรวจ route/สิทธิ์ และส่งต่อให้ view
│  ├─ pages/                 HTML entry และ page.ts แยกแต่ละ URL
│  │  ├─ auth/               login, access-denied
│  │  ├─ dashboard/
│  │  ├─ posts/              official, general, create, detail
│  │  ├─ assignments/        รายการและ detail
│  │  ├─ calendar/
│  │  ├─ profile/
│  │  └─ admin/              dashboard, approvals, posts/form, assignments/form
│  ├─ views/                 เนื้อหาและ event ของหน้าจอ
│  ├─ ui/                    shell, icons, dialog, toast, badge, Context
│  ├─ styles/                tokens.css และ app.css
│  ├─ types/models.ts        โมเดลกลาง + Repository interface
│  ├─ services/
│  │  ├─ repository.ts       เลือก adapter ตาม VITE_DATA_MODE
│  │  ├─ page-data.ts        โหลดข้อมูลเท่าที่ route นั้นใช้งาน
│  │  ├─ supabase-repository.ts / demo-repository.ts
│  │  ├─ validation.ts       กฎตรวจข้อมูลก่อนบันทึก
│  │  └─ catalog.ts / enrollment.ts / seed.ts
│  └─ utils/                 เวลาไทย, HTML/URL safety, dirty-form guard
├─ tests/                    Logic และ DOM integration tests
├─ scripts/                  ตัวรันทดสอบ, ตรวจโครงสร้าง และตรวจ build
├─ docs/                     คู่มือระบบ
├─ supabase/migrations/      Schema, function, trigger และ RLS
├─ public/                   static assets
├─ .env.example              ตัวอย่าง data mode
└─ vite.config.ts            HTML entry และ output dist
```

## การไหลของข้อมูล

`page.ts → bootstrap → page-data → Repository → Context/view → mutation → refresh`

หน้าจอไม่เรียก Supabase SDK โดยตรง เลือกผู้ให้ข้อมูลที่ getRepository():

- demo: จำลอง CRUD/บทบาทด้วย localStorage และแสดงป้ายทดลองชัดเจน
- supabase: นิสิตใช้ Google OAuth ของมหาวิทยาลัย, Admin ใช้อีเมลทั่วไป/Password และ query ตารางผ่าน SDK โดยฐานข้อมูลตรวจวิธี login จาก JWT พร้อมบังคับสิทธิ์ด้วย RLS

`page-data.ts` กำหนดความต้องการราย route หน้ารายการประกาศจึงไม่โหลด snapshot ของงานและความคืบหน้า ส่วนหน้ารายละเอียดโหลดเฉพาะ record ที่เปิดอยู่ การ refresh ใช้กติกาเดียวกันเพื่อลด query ที่ไม่เกี่ยวข้อง

Snapshot.posts เป็นข้อมูลย่อ Dashboard ไม่ใช่รายการประกาศทั้งหมด บอร์ดใช้ listPosts({page,pageSize,category,status,own,section}) คืน {rows,total} แสดง 10 รายการต่อหน้า (adapter จำกัดสูงสุด 15)

หน้ารายละเอียด/แก้ประกาศใช้ getPost(id) โดยตรง ชื่อผู้อนุมัติอ่านเฉพาะชื่อผ่าน public_profiles ไม่โหลดอีเมลของผู้ใช้ทุกคน

งานและ progress เป็น snapshot ของรุ่น; Supabase ดึงเป็นชุดละ 500 เพื่อไม่ติดเพดาน 1,000 แถว เมื่อข้อมูลโตควรเปลี่ยนเป็น server query ตามเดือน/ตัวกรอง

## แนวทางแก้ต่อ

- เพิ่ม field ที่ models.ts แล้วแก้ validator, adapter และฟอร์มทั้งสองโหมดให้ตรงกัน
- ใช้ snake_case ตาม schema เช่น assignment_id, due_dates, target_sections
- เก็บ ISO UTC; แสดง/กรอกเวลาไทย Asia/Bangkok
- Markdown subset: หัวข้อ ##/###, ตัวหนา, inline code, รายการ -; escape raw HTML
- ลิงก์ภายนอกเฉพาะ http/https พร้อม noopener/noreferrer
- DONE คือความคืบหน้าส่วนตัว ไม่ใช่ส่งงานผ่าน Teams/Classroom
- static host ต้องเสิร์ฟ index.html ภายในโฟลเดอร์ URL
- รัน `npm test` ทุกครั้ง ตัวตรวจ quality จะปฏิเสธ TypeScript ที่ไม่มี entry เรียกใช้, import วน และโมดูลที่ใหญ่เกิน 30 KB

ไฟล์ compatibility wrapper ที่ไม่มีผู้เรียกใช้ถูกนำออกเพื่อให้มีทางเข้าระบบและโมเดลข้อมูลเพียงชุดเดียว เรียกคืนเวอร์ชันเดิมได้จากประวัติ Git
