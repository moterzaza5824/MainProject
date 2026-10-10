# End-to-end tests

เก็บ flow การเข้าสู่ระบบ งาน ประกาศ และการอนุมัติของ Admin

## Supabase integration checks

`supabase-rls-smoke.sql` จำลอง 2 students และ 1 admin บนฐานข้อมูลที่ link อยู่
ภายใน transaction เดียว โดยตรวจ assignment/post/progress isolation, การป้องกัน role
และ audit owner แล้ว `ROLLBACK` ข้อมูลทดสอบทั้งหมดเสมอเมื่อสคริปต์ทำงานถึงท้ายไฟล์

รันจาก root ของ repository ด้วย Supabase CLI ที่ login และ link project แล้ว:

```sh
npx supabase db query --linked --file tests/e2e/supabase-rls-smoke.sql
npx supabase db query --linked --file tests/e2e/access-requests-rls-smoke.sql
```

อย่าลบ `ROLLBACK` หรือเปลี่ยนเป็น `COMMIT` เมื่อรันกับ project ที่มีข้อมูลจริง

ชุด `access-requests-rls-smoke.sql` ต้องใช้ migration 014 ตรวจบัญชี Google ภายนอกตั้งแต่ pending → ส่งคำขอ → อนุมัติ/ปฏิเสธ รวมการป้องกันอ่านข้อมูลแอปก่อนอนุมัติ อ่านคำขอคนอื่น อนุมัติตัวเอง เขียนตารางคำขอตรง ๆ คำขอซ้ำ ตรวจซ้ำ และบัญชีอีเมลไม่ยืนยัน หลังอนุมัติทดสอบลงทะเบียน งาน progress และ moderation ด้วยสิทธิ์นิสิต
