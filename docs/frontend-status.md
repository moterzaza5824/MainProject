# สถานะ Frontend

## หน้าที่พร้อมทดลอง

ครบ 20 route การใช้งาน + หน้าเริ่มต้น 1 หน้า:

| กลุ่ม | URL ภายใต้ /pages/ | การทำงาน |
|---|---|---|
| บัญชี | auth/login/, auth/access-denied/ | Username/Password, Google @up.ac.th, แจ้งสิทธิ์, เปลี่ยนบัญชี |
| ภาพรวม | dashboard/, admin/dashboard/ | สรุปงาน/ประกาศ/คำขอ |
| ประกาศ | posts/official/, posts/general/ | ข่าวที่เผยแพร่แล้ว กรองตามรายวิชาที่ลงทะเบียนและแบ่งหน้า |
| คำขอของฉัน | posts/requests/ | คำขอประกาศทางการที่รออนุมัติ/ไม่อนุมัติ แยกจากหน้าข่าว |
| เขียน/อ่าน | posts/create/, posts/detail/?id=... | CRUD ของตน, preview, ลิงก์, ผลอนุมัติ |
| งาน | assignments/, assignments/detail/?id=... | ตัวกรอง, list/calendar, สถานะยังไม่เสร็จ/เสร็จแล้ว, note |
| ปฏิทิน | calendar/ | เปลี่ยนเดือน, เส้นตาย Section, mobile agenda |
| รายวิชาของฉัน | enrollment/ | ลงทะเบียนรายวิชาและ Sec แบบรายวิชาหรือบันทึกรวม |
| โปรไฟล์ | profile/ | บัญชี, ประกาศของฉัน, ออกจากระบบ |
| อนุมัติ | admin/approvals/ | อนุมัติ/ปฏิเสธ/เผยแพร่เป็นทั่วไป |
| จัดการประกาศ | admin/posts/, admin/posts/form/?id=... | CRUD, pin, ตรวจคำขอ |
| จัดการงาน | admin/assignments/, admin/assignments/form/?id=... | CRUD, UNIFIED/SPLIT, เอกสารแบบชื่อพร้อม URL |
| ข้อมูลพื้นฐาน | admin/catalog/ | เพิ่ม/แก้ไข/ลบรายวิชา พร้อมตรวจการอ้างอิง |

ฟอร์มเพิ่มกับแก้ใช้หน้าเดียวกัน; ไม่มี id คือเพิ่มใหม่

## ตรวจสอบแล้ว

- TypeScript strict และ production build
- ทดสอบอัตโนมัติ 29 รายการ: สิทธิ์, migration สถานะและลิงก์เอกสารเดิม, private progress/upsert, moderation, optimistic concurrency, pagination, error retry, Section/urgency, HTML/URL safety, calendar, form mode, enrollment, master data, page render, sidebar preference
- DOM tests ใช้ happy-dom ไม่ใช่ภาพจริงหรือ E2E บน Chrome
- ทดสอบ hidden/disabled ของฟอร์มด้วย DOM; การแสดงผล responsive/CSS ยังต้องตรวจบนอุปกรณ์จริงก่อน production
- Supabase DB/RLS ที่ deploy จริงผ่าน migration sync, lint และ contract checks แล้ว; Google OAuth ทดสอบบน local/Vercel แล้ว แต่ยังไม่ได้ทดสอบหลายบัญชีจริง, Realtime หรือโหลดพร้อมกัน

## ข้อจำกัด

- repository รองรับ demo เมื่อกำหนด `VITE_DATA_MODE=demo` อย่างชัดเจนเท่านั้น ส่วนเครื่องพัฒนานี้ตั้ง `.env.local` เป็น `VITE_DATA_MODE=supabase` แล้ว รายวิชา/การลงทะเบียน/ประกาศ/งาน/ความคืบหน้าจึงอ่านเขียนฐานข้อมูลจริง
- migrations, trigger, seed และ RLS ถูก deploy ไปยัง Supabase project แล้ว และ migration 001–007 ตรงกันทั้ง local/remote
- ไม่มี chat, grades, upload, SMS หรือฟีเจอร์ใหม่จากข้อเสนอแนะ
- DONE ไม่นับเป็นงานด่วน; เลยกำหนดแยกจากงานที่จะถึงกำหนดใน 48 ชั่วโมง
