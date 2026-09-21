# โครงสร้าง Frontend

ใช้ SRS เป็นขอบเขตระบบ และเอกสาร UI/UX เป็นแนวทางออกแบบ ไม่ได้รันคำสั่งหรือเพิ่ม framework ตามข้อความ prompt ตัวอย่างในเอกสาร

```text
Project2026_1/
├─ src/
│  ├─ index.html / entry.ts   จุดเริ่มต้น → Login/Dashboard
│  ├─ bootstrap.ts           โหลด session, ตรวจ route/สิทธิ์, สร้าง Context
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
│  ├─ services/              Repository, demo seed, Supabase adapter
│  ├─ guards/                ตัวช่วยตรวจบัญชี/บทบาท
│  ├─ layouts/               ตัวเรียก shell ร่วมกัน
│  └─ utils/                 เวลาไทย, HTML/URL safety, dirty-form guard
├─ tests/                    Logic และ DOM integration tests
├─ scripts/test.mjs          ตัวรันทดสอบ
├─ docs/                     คู่มือและข้อเสนอที่ยังไม่ได้เพิ่ม
├─ supabase/                 ช่องสำหรับ backend; SQL ยังเป็น TODO
├─ public/                   static assets
├─ .env.example              ตัวอย่าง data mode
└─ vite.config.ts            HTML entry และ output dist
```

## การไหลของข้อมูล

`page.ts → bootstrap → Context/Repository → view → mutation → refresh`

หน้าจอไม่เรียก Supabase SDK โดยตรง เลือกผู้ให้ข้อมูลที่ getRepository():

- demo: จำลอง CRUD/บทบาทด้วย localStorage และแสดงป้ายทดลองชัดเจน
- supabase: Google OAuth และ query ตารางผ่าน SDK; ต้องมี backend ที่ตรวจสิทธิ์จริงก่อน

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

นำ scaffold ที่ไม่มีผู้เรียกใช้ 20 ไฟล์ออก (components, types, styles, utils ที่ซ้ำ) เพื่อไม่ให้มีโมเดลสองชุด เรียกคืนเวอร์ชันเดิมได้จากประวัติ Git ไม่ได้ลบ .git หรือเอกสาร SRS
