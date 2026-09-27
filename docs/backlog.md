# Product Backlog — SE68 Hub

อัปเดตล่าสุด: 27 กันยายน 2026

## เป้าหมายของ Release แรก

เปิดใช้ SE68 Hub กับนิสิตจริง โดยให้ผู้ใช้ที่ได้รับอนุญาตเข้าสู่ระบบ ดูประกาศและงานตามรายวิชา/Section ของตน ส่งคำขอประกาศ และบันทึกความคืบหน้าส่วนตัวได้ ขณะที่ผู้ดูแลจัดการข้อมูลและอนุมัติประกาศได้อย่างปลอดภัย

Frontend หลัก, Supabase migrations/RLS/adapter และ Google OAuth ถูก deploy กับ project จริงแล้ว พร้อมผ่าน automated tests, database lint และ RLS smoke test รายการ P0 ด้านล่างจึงใช้ติดตามงานด้านนโยบาย การปฏิบัติการ และการทดสอบก่อนขยายจาก pilot ไปใช้ทั้งรุ่น

## ภาพรวม

| กลุ่ม | จำนวน | Story points | Release gate |
|---|---:|---:|---|
| P0 — ก่อน Production | 15 | 99 | ต้องเสร็จและผ่านการทดสอบทั้งหมด |
| P1 — หลัง MVP | 5 | 34 | วางแผนหลัง pilot หรือนำขึ้นมาก่อนได้ตามความเสี่ยง |
| P2 — Parking lot | 6 | ยังไม่ประเมิน | ต้องยืนยันขอบเขตและคุณค่าก่อน |

## เกณฑ์จัดลำดับ

- **P0 — ต้องทำก่อน Production:** เกี่ยวข้องกับความถูกต้อง ความปลอดภัย ข้อมูลจริง หรือการปล่อยระบบ
- **P1 — ควรทำหลัง MVP:** ลดความเสี่ยงในการปฏิบัติงานและเพิ่มความครบถ้วน แต่ไม่ขวาง pilot แบบจำกัดกลุ่ม
- **P2 — พักไว้:** ยังไม่อยู่ในขอบเขต Release แรก ต้องยืนยันความต้องการก่อนเริ่ม
- Story point ใช้ลำดับ Fibonacci และเป็นค่าประเมินเบื้องต้นของความซับซ้อน ไม่ใช่จำนวนวัน

## P0 — พร้อมใช้งานจริง

### BL-001 ตกลงเจ้าของข้อมูลและนโยบายเก็บรักษา

**Epic:** Governance · **Story points:** 3 · **Dependency:** ไม่มี

ในฐานะทีมดูแลระบบ เราต้องมีนโยบายข้อมูลที่ชัดเจน เพื่อให้รู้ว่าใครรับผิดชอบข้อมูลและจัดการข้อมูลส่วนตัวอย่างไร

**Acceptance criteria**

- ระบุเจ้าของข้อมูลรายชื่อนิสิต รายวิชา งาน ประกาศ และบันทึกส่วนตัว
- ระบุระยะเวลาเก็บข้อมูล วิธีลบเมื่อจบรุ่น และผู้ดูแลสำรอง
- ระบุผู้ที่มีสิทธิ์แต่งตั้ง/ถอดถอน admin และขั้นตอนเมื่อบัญชีถูกเพิกถอน
- ผู้มีอำนาจตัดสินใจอนุมัตินโยบายก่อนนำข้อมูลจริงเข้าระบบ

### BL-002 จำกัดบัญชีด้วยรหัสนิสิต 6802

**Epic:** Identity · **Story points:** 5 · **Dependency:** BL-001

ในฐานะผู้ดูแล ฉันต้องอนุญาตเฉพาะนิสิตที่มีรหัสขึ้นต้น 6802 เพื่อให้ตรงกับขอบเขตสาขาที่ตกลงไว้โดยไม่ต้องดูแล allowlist แยก

**Acceptance criteria**

- การสร้าง profile ครั้งแรกรับเฉพาะ verified email รูปแบบ `6802xxxx@up.ac.th`
- frontend ตรวจรูปแบบเดียวกันและ sign out บัญชีที่ไม่ผ่านทันที
- restrictive RLS ปิดการอ่าน/เขียนทุกตารางสำหรับบัญชีที่ไม่ผ่าน แม้เคยมี profile เก่า
- constraint ป้องกัน profile ใหม่ที่มี email หรือ student ID นอกช่วง

### BL-003 ออกแบบภาคเรียน รายวิชา การลงทะเบียน และ Section

**Epic:** Academic data · **Story points:** 8 · **Dependency:** BL-001

ในฐานะนิสิต ฉันต้องเห็นเฉพาะงานและประกาศของรายวิชา/Section ที่ลงทะเบียน เพื่อให้ข้อมูลบน Dashboard ถูกต้อง

**Acceptance criteria**

- มี schema สำหรับ academic term, subjects, subject offerings และ enrollments
- รองรับนิสิตหนึ่งคนอยู่ต่าง Section ในแต่ละรายวิชาและแต่ละภาคเรียน
- กำหนด unique key, foreign key และกติกาเมื่อปิดภาคเรียนครบถ้วน
- ย้าย master data และ enrollment ออกจาก `localStorage` โดยมีแผน migrate/seed ที่ทำซ้ำได้

### BL-004 ทำ Supabase migrations, constraints และ indexes ให้พร้อมใช้

**Epic:** Data platform · **Story points:** 8 · **Dependency:** BL-003

ในฐานะทีมพัฒนา เราต้องสร้างฐานข้อมูลจาก migration ได้เหมือนกันทุก environment เพื่อให้ deploy และกู้ระบบได้อย่างเชื่อถือได้

**Acceptance criteria**

- migration สร้างตารางตาม `docs/backend-contract.md` และแบบข้อมูลจาก BL-003 ได้ตั้งแต่ฐานข้อมูลว่าง
- มี enum/check, length validation, timestamp defaults, foreign keys และ delete behavior ที่ตกลงแล้ว
- มี index สำหรับ query หลัก เช่น author, status/category/pin/update time, enrollment และ assignment due date
- มี `public_profiles` view/RPC ที่เปิดเฉพาะ `uid` และ `full_name` ตามความจำเป็น
- seed สำหรับ development ไม่ปะปนกับข้อมูล production และ rollback/restore ได้ทดสอบแล้ว

### BL-005 เชื่อม Authentication และ provision profile อย่างปลอดภัย

**Epic:** Identity · **Story points:** 8 · **Dependency:** BL-002, BL-004

ในฐานะนิสิตหรือผู้ดูแล ฉันต้องเข้าสู่ระบบด้วยบัญชีที่รองรับและได้รับ role ที่ถูกต้อง โดย client ไม่สามารถกำหนดสิทธิ์ของตนเองได้

**Acceptance criteria**

- ตั้งค่า Google OAuth สำหรับนิสิต, Email provider สำหรับ Admin และ redirect allowlist สำหรับ local/staging/production
- ตรวจ verified email รูปแบบ `6802xxxx@up.ac.th` ที่ trigger, constraint และ RLS; ค่า OAuth `hd` ไม่ถูกใช้เป็นสิทธิ์
- profile ใช้ `auth.users.id` เป็น `uid`, role เริ่มต้นเป็น student, admin ตั้งได้ผ่านขั้นตอนที่เชื่อถือได้เท่านั้น และ RLS ยอมรับสิทธิ์ Admin เฉพาะ password session
- ผู้ใช้เปลี่ยน `uid`, email, student ID หรือ role จาก client ไม่ได้
- session หมดอายุหรือบัญชีถูกถอนสิทธิ์แล้ว API ปฏิเสธคำขอและ UI พากลับสู่ flow ที่เหมาะสม

### BL-006 บังคับ Row Level Security แบบ least privilege

**Epic:** Security · **Story points:** 13 · **Dependency:** BL-004, BL-005

ในฐานะผู้ใช้ ฉันต้องเข้าถึงเฉพาะข้อมูลที่ตนมีสิทธิ์ เพื่อป้องกันข้อมูลส่วนตัวและการเปลี่ยนแปลงข้อมูลข้ามบัญชี

**Acceptance criteria**

- เปิด RLS ทุกตารางที่ client เข้าถึง และไม่มี policy แบบเปิดกว้างเพื่อแก้ปัญหาชั่วคราว
- student อ่าน pending/rejected ได้เฉพาะของตน และอ่าน/แก้ progress/note ได้เฉพาะของตน
- admin จัดการประกาศและงานได้ แต่ไม่อ่าน note ส่วนตัวของนิสิต
- published posts และ assignment ถูกกรองตามกติกาการลงทะเบียน/Section ที่ตกลงไว้
- มี automated negative tests สำหรับการปลอม owner/role/status/reviewer และการอ่านข้อมูลข้ามบัญชี

### BL-007 ย้าย state transition สำคัญไปไว้ฝั่ง server

**Epic:** Security · **Story points:** 8 · **Dependency:** BL-006

ในฐานะผู้ดูแล ฉันต้องมั่นใจว่าสถานะประกาศและ field สำคัญเปลี่ยนตาม workflow เท่านั้น แม้ผู้ใช้เรียก API โดยไม่ผ่าน UI

**Acceptance criteria**

- RPC/trigger ตรวจ insert, edit, approve, reject, publish, pin และ delete ตาม role และสถานะเดิม
- official post ของ student เริ่ม/กลับเป็น pending; การแก้ไข reset reviewer/pin ตามกติกา
- conditional review สำเร็จได้เฉพาะรายการที่ยัง pending และป้องกันการอนุมัติซ้ำ
- client ไม่สามารถกำหนด `author_id`, `approved_by`, `is_pinned` หรือสถานะที่ไม่มีสิทธิ์ได้
- validation เนื้อหา ความยาว URL, attachment, due date และ Section ทำซ้ำที่ server

### BL-008 เชื่อม Repository กับข้อมูลจริงครบทุกหน้าหลัก

**Epic:** Application integration · **Story points:** 8 · **Dependency:** BL-003–BL-007

ในฐานะผู้ใช้ ฉันต้องเห็นข้อมูลเดียวกันข้ามบัญชีและอุปกรณ์ เพื่อให้ระบบทำงานแทน demo ใน browser ได้จริง

**Acceptance criteria**

- subjects, enrollments, posts, assignments และ progress อ่าน/เขียนผ่าน Supabase repository
- ไม่มีข้อมูลธุรกิจ production ที่พึ่ง `localStorage`; local storage ใช้ได้เฉพาะ preference ของ UI
- Dashboard, รายการ, detail, form, calendar และ admin pages รองรับ loading, empty, error และ retry
- mutation ไม่เกิด duplicate write เมื่อ network ช้าหรือผู้ใช้กดซ้ำ
- โหมด demo ยังรันแยกได้โดยไม่ส่งข้อมูลไป production

### BL-009 ป้องกันการเขียนทับจากการแก้ไขพร้อมกัน

**Epic:** Data integrity · **Story points:** 5 · **Dependency:** BL-007, BL-008

ในฐานะผู้ดูแล ฉันต้องได้รับแจ้งเมื่อข้อมูลถูกแก้จากอีกหน้าจอ เพื่อไม่ให้บันทึกทับการเปลี่ยนแปลงใหม่โดยไม่รู้ตัว

**Acceptance criteria**

- เก็บ version หรือ `updated_at` ตั้งแต่ตอนเปิดฟอร์มและส่งไปกับ update
- server ปฏิเสธ update เมื่อ version ไม่ตรง โดยไม่ทำข้อมูลล่าสุดสูญหาย
- UI แสดงข้อมูลล่าสุดและให้ผู้ใช้เลือกโหลดใหม่หรือคัดลอกการแก้ไขของตน
- มี integration test ที่จำลอง admin สองบัญชีแก้รายการเดียวกัน

### BL-010 จัดการ session change และ Realtime อย่างปลอดภัย

**Epic:** Application integration · **Story points:** 5 · **Dependency:** BL-005, BL-006, BL-008

ในฐานะผู้ใช้ ฉันต้องเห็นข้อมูลล่าสุดและเสียสิทธิ์ทันทีเมื่อ session/role เปลี่ยน เพื่อไม่ใช้ข้อมูลเก่าหรือหน้าจอที่ไม่ควรเข้าถึง

**Acceptance criteria**

- subscription อัปเดต/refresh รายการที่เกี่ยวข้องเมื่อประกาศ งาน หรือ enrollment เปลี่ยน
- unsubscribe ทุก channel เมื่อ logout, session เปลี่ยน หรือออกจากหน้า
- เมื่อ role/สิทธิ์ถูกถอน UI ล้างข้อมูล cache และตรวจ route ใหม่
- reconnect หลัง offline ไม่สร้าง subscription ซ้ำหรือแสดงข้อมูลของบัญชีก่อนหน้า

### BL-011 เพิ่ม rate limit, logging และการรับมือข้อผิดพลาด production

**Epic:** Operations · **Story points:** 5 · **Dependency:** BL-005–BL-008

ในฐานะทีมดูแล เราต้องตรวจพบและควบคุมความผิดปกติ เพื่อให้ระบบปลอดภัยและแก้ปัญหาได้โดยไม่เปิดเผยข้อมูลลับ

**Acceptance criteria**

- rate limit การสร้าง/แก้ไข/อนุมัติที่ฝั่ง server โดยอย่างน้อยเทียบเท่าข้อจำกัด demo 3 ครั้งต่อนาที
- log เหตุการณ์สำคัญและ error พร้อม correlation ID โดยไม่บันทึก token หรือ note ส่วนตัวเกินจำเป็น
- UI แยก validation, unauthorized, conflict, rate limit และ network error พร้อมข้อความที่ทำต่อได้
- มี alert/ช่องทางตรวจสอบ error rate และ runbook สำหรับเหตุขัดข้องหลัก

### BL-012 ทำ backup, restore และแผนกู้คืน

**Epic:** Operations · **Story points:** 5 · **Dependency:** BL-001, BL-004

ในฐานะเจ้าของระบบ ฉันต้องกู้ข้อมูลจากความผิดพลาดได้ เพื่อไม่ให้ประกาศ งาน และความคืบหน้าสูญหายถาวร

**Acceptance criteria**

- กำหนดความถี่ backup, retention, RPO/RTO และผู้รับผิดชอบ
- ทดสอบ restore ใน environment ที่ไม่ใช่ production และบันทึกผล
- delete behavior ของ assignment/progress ตรงกับนโยบายที่อนุมัติใน BL-001
- มี checklist และ runbook สำหรับ backup/restore ก่อนเปิดใช้งานจริง

### BL-013 ทดสอบ E2E และ security ด้วยหลายบัญชีจริง

**Epic:** Quality · **Story points:** 8 · **Dependency:** BL-005–BL-012

ในฐานะทีมพัฒนา เราต้องพิสูจน์ workflow สำคัญและขอบเขตสิทธิ์บนระบบจริงก่อนเปิดให้ผู้ใช้

**Acceptance criteria**

- ทดสอบ staging ด้วยอย่างน้อย 2 student + 1 admin ผ่าน browser จริง
- ครอบคลุม login/logout, enrollment, post request/review, assignment CRUD, private progress และ session expiry
- พิสูจน์ว่าอ่าน note/คำขอของคนอื่น เปลี่ยน role เผยแพร่ official เอง และเขียน field ต้องห้ามไม่ได้
- ครอบคลุม slow network, retry, duplicate submission และ concurrent edit
- test suite เดิม, typecheck และ production build ผ่านทั้งหมดใน CI

### BL-014 ตรวจ responsive, accessibility และ browser compatibility

**Epic:** Quality · **Story points:** 5 · **Dependency:** BL-008

ในฐานะนิสิต ฉันต้องใช้ระบบบนมือถือและคีย์บอร์ดได้อย่างชัดเจน เพื่อไม่ถูกขวางจากอุปกรณ์หรือข้อจำกัดการเข้าถึง

**Acceptance criteria**

- ตรวจ route สำคัญบน viewport มือถือ/แท็บเล็ต/เดสก์ท็อปและ browser ที่ทีมกำหนด
- ไม่มี horizontal overflow, เมนูค้าง, modal ใช้ไม่ได้ หรือฟอร์มซ่อนข้อมูลสำคัญ
- ใช้งาน flow หลักด้วย keyboard ได้ มี visible focus, label, error association และ heading order ที่เหมาะสม
- contrast และ automated accessibility scan ผ่านเกณฑ์ที่ทีมกำหนด; issue ร้ายแรงเป็นศูนย์

### BL-015 เตรียม CI/CD และ production release

**Epic:** Delivery · **Story points:** 5 · **Dependency:** BL-004–BL-014

ในฐานะทีมพัฒนา เราต้อง deploy ระบบซ้ำได้และย้อนกลับได้ เพื่อให้การปล่อยเวอร์ชันมีความเสี่ยงต่ำ

**Acceptance criteria**

- แยก local/staging/production และใช้เฉพาะ public anon key ในตัวแปร `VITE_*`
- CI รัน test, typecheck และ build ทุก pull request; migration ถูกตรวจใน staging ก่อน production
- มี deploy checklist, smoke test, rollback plan และผู้อนุมัติ release
- ไม่มี secret/service-role key อยู่ใน source, client bundle, log หรือ Git history ที่ตรวจได้

## P1 — หลัง MVP

### BL-016 บันทึก audit history และเหตุผลการตรวจสอบ

**Epic:** Governance · **Story points:** 8 · **Dependency:** BL-007

เก็บเหตุการณ์ create/edit/review/publish/delete พร้อม actor, เวลา และสถานะก่อน/หลัง; การ reject ต้องระบุเหตุผลและเจ้าของโพสต์เห็นเหตุผลได้ โดย audit record แก้จาก client ไม่ได้

### BL-017 เพิ่ม soft delete และถังขยะ

**Epic:** Data integrity · **Story points:** 8 · **Dependency:** BL-012, BL-016

กำหนดระยะเวลากู้คืน แสดงรายการที่ลบแก่ผู้มีสิทธิ์ และ restore ความสัมพันธ์ที่จำเป็นโดยไม่เปิดข้อมูลที่ถูกลบให้ผู้ใช้ทั่วไป

### BL-018 แยก submission URL และตรวจลิงก์ทรัพยากร

**Epic:** Assignment workflow · **Story points:** 5 · **Dependency:** BL-008

แยกชื่อช่องทางส่งงานออกจาก URL, ตรวจ protocol/รูปแบบฝั่ง server และแสดงสถานะลิงก์เสียหรือเอกสารที่ต้องขอสิทธิ์โดยไม่ให้ระบบ crawler เข้าถึง URL ภายในโดยพลการ

### BL-019 เพิ่มเครื่องมือจัดการสมาชิกและ enrollment สำหรับผู้ดูแล

**Epic:** Admin experience · **Story points:** 8 · **Dependency:** BL-002, BL-003, BL-006

ผู้ดูแลที่ได้รับสิทธิ์สามารถค้นหาสมาชิกในกลุ่มรหัส 6802 ตรวจความผิดพลาด ระงับการใช้งาน และเปลี่ยน enrollment แบบมี preview, validation และ audit trail

### BL-020 ทดสอบโหลดและกำหนด capacity baseline

**Epic:** Performance · **Story points:** 5 · **Dependency:** BL-008, BL-011

วัดเวลาโหลดหน้าและ API ภายใต้จำนวนผู้ใช้/ข้อมูลที่คาดการณ์ ตรวจ query plan และกำหนดเกณฑ์ผ่านสำหรับ response time, error rate และ concurrent connections

## P2 — Parking lot (ต้องยืนยันขอบเขตก่อน)

| ID | แนวคิด | คำถามก่อนนำเข้า Backlog |
|---|---|---|
| BL-021 | Push/email notification | เหตุการณ์ใดต้องแจ้ง ใครเป็นผู้ส่ง และผู้ใช้ opt out ได้หรือไม่ |
| BL-022 | File upload | ชนิด/ขนาดไฟล์ อายุการเก็บ quota และผู้มีสิทธิ์ดาวน์โหลดคือใคร |
| BL-023 | Chat | ต้องมี moderation, retention และผู้ดูแลข้อความอย่างไร |
| BL-024 | คะแนน | ใครเป็นเจ้าของข้อมูล มีความลับระดับใด และระบบนี้เป็น source of truth หรือไม่ |
| BL-025 | Analytics | ต้องการ metric ใด ยินยอม/นิรนามข้อมูลอย่างไร และเก็บไว้นานเท่าใด |
| BL-026 | SMS | เหตุการณ์ใดคุ้มค่าใช้จ่าย ใครรับผิดชอบหมายเลขและ consent |

## ลำดับส่งมอบที่แนะนำ

### Sprint 1 — Foundation และ Identity (32 points)

**เป้าหมาย:** ได้ข้อกำหนดที่อนุมัติแล้ว พร้อมฐานข้อมูลและระบบยืนยันตัวตนบน staging

1. BL-001 ตกลงเจ้าของข้อมูลและนโยบายเก็บรักษา — 3 points
2. BL-002 จำกัดบัญชีด้วยรหัสนิสิต 6802 — 5 points
3. BL-003 ออกแบบภาคเรียน รายวิชา การลงทะเบียน และ Section — 8 points
4. BL-004 ทำ Supabase migrations, constraints และ indexes ให้พร้อมใช้ — 8 points
5. BL-005 เชื่อม Authentication และ provision profile อย่างปลอดภัย — 8 points

**Sprint outcome:** ผู้ใช้รหัส 6802 เข้าสู่ระบบ staging ได้, บัญชีอื่นถูก RLS ปฏิเสธ, profile/role ถูกสร้างอย่างปลอดภัย และฐานข้อมูลสร้างซ้ำจาก migration ได้

### Sprint 2 — Security และเชื่อมข้อมูลจริง (34 points)

**เป้าหมาย:** Workflow หลักทำงานกับ Supabase จริงภายใต้สิทธิ์และกติกาฝั่ง server

1. BL-006 บังคับ Row Level Security แบบ least privilege — 13 points
2. BL-007 ย้าย state transition สำคัญไปไว้ฝั่ง server — 8 points
3. BL-008 เชื่อม Repository กับข้อมูลจริงครบทุกหน้าหลัก — 8 points
4. BL-009 ป้องกันการเขียนทับจากการแก้ไขพร้อมกัน — 5 points

**Sprint outcome:** Student และ admin ใช้ flow หลักกับข้อมูลจริงได้ โดยไม่อ่านหรือแก้ข้อมูลนอกสิทธิ์ และระบบตรวจพบ concurrent update

### Sprint 3 — Hardening และ Production Release (33 points)

**เป้าหมาย:** ระบบผ่านการตรวจด้านความเสถียร ความปลอดภัย การเข้าถึง และพร้อม deploy production

1. BL-010 จัดการ session change และ Realtime อย่างปลอดภัย — 5 points
2. BL-011 เพิ่ม rate limit, logging และการรับมือข้อผิดพลาด production — 5 points
3. BL-012 ทำ backup, restore และแผนกู้คืน — 5 points
4. BL-013 ทดสอบ E2E และ security ด้วยหลายบัญชีจริง — 8 points
5. BL-014 ตรวจ responsive, accessibility และ browser compatibility — 5 points
6. BL-015 เตรียม CI/CD และ production release — 5 points

**Sprint outcome:** ผ่าน release checklist, security/E2E tests และ restore drill พร้อม deploy และ rollback production ได้

ทั้ง 3 Sprint รวม 99 points โดยเรียงงานภายใน Sprint ตาม dependency ลำดับนี้เป็นข้อเสนอเบื้องต้นและยังไม่ผูกกับระยะเวลา Sprint หรือจำนวนคนในทีม หาก capacity จริงต่ำกว่า 32–34 points ต่อ Sprint ควรลดขอบเขตหรือเพิ่มจำนวน Sprint แทนการตัด acceptance criteria ของงาน P0

## Definition of Done

งานถือว่าเสร็จเมื่อ:

- Acceptance criteria ผ่านและมีหลักฐานทดสอบที่เหมาะกับความเสี่ยง
- เพิ่ม/แก้ automated tests สำหรับ business rule และสิทธิ์ที่เปลี่ยน
- `npm test`, `npm run typecheck` และ `npm run build` ผ่าน
- migration, configuration และเอกสารใช้งาน/rollback ได้รับการอัปเดตเมื่อเกี่ยวข้อง
- ไม่มี secret หรือข้อมูลส่วนตัวจริงใน source, fixture, screenshot หรือ log
- มีผู้รีวิวอย่างน้อยหนึ่งคน และ Product Owner/ผู้รับผิดชอบข้อมูลยอมรับงานที่กระทบกติกาธุรกิจ

## Baseline ที่ทำแล้ว (ไม่นำกลับเข้า Backlog)

- Frontend 20 routes และหน้าเริ่มต้น พร้อม flow ฝั่ง student/admin ในโหมด demo
- CRUD ประกาศ/งาน, moderation, pin, pagination, enrollment UI, calendar และ private task progress
- TypeScript strict, production build และ automated DOM/unit tests ตาม `docs/frontend-status.md`
- มี repository abstraction และ Supabase adapter เบื้องต้นสำหรับต่อยอด
