# NUCARE docs

แผนที่เอกสารสำหรับคนรับช่วงต่อ อย่าใส่รหัสผ่านหรือ connection string จริงในโฟลเดอร์นี้

| ไฟล์ | ใช้เมื่อ |
|---|---|
| [vercel-deploy.md](./vercel-deploy.md) | ขึ้น frontend/backend บน Vercel + Neon |
| [docker-production.md](./docker-production.md) | รันด้วย Docker แบบ production |
| [docker-faculty.md](./docker-faculty.md) | Deploy เซิร์ฟเวอร์คณะ (port 89, Compose project `nucare`) |
| [tor-5-compliance.md](./tor-5-compliance.md) | สถานะ WCAG, SEO, PDPA, audit |
| [sqa-ghq28-survey-test-report.md](./sqa-ghq28-survey-test-report.md) | ผลทดสอบคะแนน GHQ-28 |
| [latex/Template_TestReport_2026/](./latex/Template_TestReport_2026/) | เทมเพลต LaTeX รายงานการทดสอบ (ตาราง Test Scenario / Test Case) |
| [whiteboard-system-map.md](./whiteboard-system-map.md) | แผนภาพสถานะระบบ + แบ่งงานสำหรับไวท์บอร์ด |
| [whiteboard-role-capabilities.md](./whiteboard-role-capabilities.md) | ความสามารถราย Role เสร็จ/ค้าง + แผนภาพไวท์บอร์ด |

เอกสารที่เกี่ยวข้องนอก `docs/`

- `README.md` ที่รากโปรเจกต์: วิธีรันและโครงโฟลเดอร์
- `server/.env.example` และ `client/.env.example`: คีย์ที่ต้องตั้ง
- `secrets/README.md`: วิธีเก็บ secret ของ Docker production
- `all/รายงานความคืบหน้า-บอร์ด.md` (local only): รายงานส่งบอร์ด + ภาพใน `all/board-progress-screenshots/`
