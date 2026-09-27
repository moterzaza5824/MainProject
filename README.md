# SE68 Hub

Frontend ศูนย์กลางประกาศและติดตามงานสำหรับนิสิตวิศวกรรมซอฟต์แวร์ รุ่น 68 ธีมดำ เขียว ขาว

HTML + CSS + TypeScript + Vite แบบหลายหน้า แยก UI ออกจาก Repository เพื่อเปลี่ยนจากข้อมูลทดลองเป็น Supabase โดยไม่ต้องเขียนหน้าจอใหม่

## เปิดใน VS Code

เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรัน:

```sh
npm install
npm run dev
```

เปิด URL Local ที่ Terminal แสดง ไม่ต้องเปิด HTML ด้วยการดับเบิลคลิก และไม่ใช้ Live Server กับ source TypeScript

- คัดลอก `.env.example` เป็น `.env.local` แล้วตั้ง `VITE_DATA_MODE=demo` สำหรับ **โหมดทดลอง**; ระบบจะไม่เลือก demo ให้อัตโนมัติเมื่อค่าหาย เพื่อป้องกัน production ใช้ข้อมูลตัวอย่างโดยไม่ตั้งใจ
- หน้าเข้าสู่ระบบใช้บัญชีทดลอง: นิสิต `68020001 / se68student` หรือผู้ดูแล `admin / se68admin`
- ออกจากระบบแล้วสลับบทบาทเพื่อทดสอบส่งคำขอ → อนุมัติ → กลับไปดูผล
- ข้อมูลทดลองเก็บเฉพาะเบราว์เซอร์/ต้นทาง URL นั้น ไม่ซิงก์ข้ามเครื่องและไม่ใช่ฐานข้อมูลจริง
- เมนูด้านข้างพับเป็นแถบไอคอนและจำตัวเลือก บนมือถือเป็นเมนูเลื่อนเข้าออก

## ตรวจสอบและสร้างเว็บ

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

แก้ source ใน `src/` ส่วน `dist/` เป็นผลลัพธ์ที่สร้างใหม่ได้ ไม่ควรแก้ด้วยมือ

## เอกสารพัฒนาต่อ

- [โครงสร้างและหน้าที่แต่ละส่วน](docs/architecture.md)
- [สถานะ Frontend และหน้าที่พร้อมทดลอง](docs/frontend-status.md)
- [สัญญาข้อมูลและรายการเชื่อม Backend](docs/backend-contract.md)
- [วิธีตั้งค่า Supabase, Auth และฐานข้อมูล](docs/backend-setup.md)
- [ข้อเสนอเพิ่มเติมที่ยังไม่ได้ลงมือทำ](docs/recommendations.md)
- [Product Backlog และลำดับส่งมอบ](docs/backlog.md)

Schema, profile trigger, RLS, seed และ Supabase adapter ถูกเตรียมพร้อมสำหรับ deploy แล้ว แต่ **ยังไม่ได้ deploy/ทดสอบกับ Supabase project จริงใน repository นี้** และ Realtime ยังไม่เปิดใช้ ดูขั้นตอนใน `docs/backend-setup.md` และห้ามใส่ service-role key ใน `VITE_*` หรือ Git
