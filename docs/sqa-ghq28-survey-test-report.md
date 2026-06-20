# GHQ-28 Survey SQA Test Report

## 1. วัตถุประสงค์และขอบเขต

ทดสอบระบบแบบสอบถาม GHQ-28 หลังปรับเกณฑ์ให้ใช้ **4 ระดับความรุนแรง (distress tiers)** เป็นผลแปลหลัก โดย:

- ใช้ Likert 0–1–2–3 ต่อข้อ (คะแนนรวมสูงสุด 84)
- **ไม่** แสดง Normal/High หรือเกณฑ์คัดกรอง ≥24 ใน UI/API สำหรับ GHQ-28
- ยัง map `riskLevel` สำหรับ advisor legacy: NORMAL→NORMAL, MILD/MODERATE→MEDIUM, SEVERE→HIGH

ขอบเขตการทดสอบ:

- Unit tests: ฟังก์ชันคำนวณคะแนนและระดับ (`survey-scoring.ts`)
- Integration tests: seed, submit, duplicate, archive/restore, recalculate, delete บน PostgreSQL แยก (Docker port 5433)
- Build verification: server + client

---

## 2. สภาพแวดล้อมทดสอบ

| รายการ | ค่า |
|---|---|
| วันที่ทดสอบ | 2026-06-20 |
| ผู้ทดสอบ | Auto (CI/script) |
| Database | PostgreSQL 15 (Docker `docker-compose.test.yml`) |
| Host/Port | `localhost:5433` |
| Database name | `nucare_test` |
| Connection | `postgresql://nucare:nucare_test_password@localhost:5433/nucare_test?schema=public` |
| Cloud/Production DB | **ไม่ใช้** — ทุก test ชี้ port 5433 เท่านั้น |
| Server env | `server/.env.test` (จาก `.env.test.example`) |
| Node test runner | `tsx --test` (unit), `tsx scripts/ghq28-sqa-test.ts` (integration) |

---

## 3. เกณฑ์คะแนน GHQ-28 Likert 0-1-2-3

| คะแนนรวม | ระดับ (distressLevel) | ป้ายกำกับ (distressLabel) |
|---|---|---|
| 0–14 | NORMAL | ปกติ (Normal) |
| 15–28 | MILD | ปัญหาสุขภาพจิตระดับน้อย (Mild Distress) |
| 29–42 | MODERATE | ปัญหาสุขภาพจิตระดับปานกลาง (Moderate Distress) |
| 43–84 | SEVERE | ปัญหาสุขภาพจิตระดับรุนแรง (Severe Distress) |

**Mapping riskLevel (advisor legacy):**

| distressLevel | riskLevel |
|---|---|
| NORMAL | NORMAL |
| MILD | MEDIUM |
| MODERATE | MEDIUM |
| SEVERE | HIGH |

---

## 4. Test Matrix

### 4.1 Unit Tests (`server/src/lib/survey-scoring.test.ts`)

| Test ID | หัวข้อ | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| SC-01 | score 0 | distress=NORMAL, riskLevel=NORMAL | NORMAL / NORMAL | **PASS** |
| SC-02 | score 14 (boundary) | distress=NORMAL, riskLevel=NORMAL | NORMAL / NORMAL | **PASS** |
| SC-03 | score 15 (boundary) | distress=MILD, riskLevel=MEDIUM | MILD / MEDIUM | **PASS** |
| SC-04 | score 28 (boundary) | distress=MILD, riskLevel=MEDIUM | MILD / MEDIUM | **PASS** |
| SC-05 | score 29 (boundary) | distress=MODERATE, riskLevel=MEDIUM | MODERATE / MEDIUM | **PASS** |
| SC-06 | score 42 (boundary) | distress=MODERATE, riskLevel=MEDIUM | MODERATE / MEDIUM | **PASS** |
| SC-07 | score 43 (boundary) | distress=SEVERE, riskLevel=HIGH | SEVERE / HIGH | **PASS** |
| SC-08 | score 84 | distress=SEVERE, riskLevel=HIGH | SEVERE / HIGH | **PASS** |
| SC-09 | option index 0–3 per item | per-item 0,1,2,3; max 84 | scores 0–3; max 84 | **PASS** |

**Unit summary:** 9/9 PASS

### 4.2 Integration Tests (`server/scripts/ghq28-sqa-test.ts`)

| Test ID | หัวข้อ | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| INT-01 | Seed GHQ-28 | 28 scored questions, option scores 0–3 | questions=28, scores=0,1,2,3,... | **PASS** |
| INT-02 | Submit tier NORMAL | totalScore=0, distress=NORMAL | totalScore=0, distress=NORMAL | **PASS** |
| INT-03 | Submit tier MILD | totalScore=20, distress=MILD | totalScore=20, distress=MILD | **PASS** |
| INT-04 | Submit tier MODERATE | totalScore=35, distress=MODERATE | totalScore=35, distress=MODERATE | **PASS** |
| INT-05 | Submit tier SEVERE | totalScore=84, distress=SEVERE | totalScore=84, distress=SEVERE | **PASS** |
| INT-06 | Duplicate submit | P2002 unique constraint | P2002 | **PASS** |
| INT-07 | Admin distress labels | all responses have distressLevel/label | responses=4, allLabeled=true | **PASS** |
| INT-08 | Archive survey | ARCHIVED + isActive=false | status=ARCHIVED, isActive=false | **PASS** |
| INT-09 | Restore survey | status=DRAFT | status=DRAFT | **PASS** |
| INT-10 | Recalculate scores | recalculated=4, maxScore=84 | recalculated=4, maxScore=84 | **PASS** |
| INT-11 | Delete (no responses) | survey removed | removed | **PASS** |
| INT-12 | Delete (with responses) | survey + responses removed | removed | **PASS** |

**Integration summary:** 12/12 PASS

### 4.3 Build Verification

| Component | Command | Result |
|---|---|---|
| Server | `cd server && npm run build` | **PASS** (Prisma generate + tsc) |
| Client | `cd client && npm run build` | **PASS** (Next.js 15 production build) |

---

## 5. ข้อบกพร่องที่พบและการแก้ไข

| # | รายละเอียด | สาเหตุ | การแก้ไข |
|---|---|---|---|
| 1 | INT-07 ล้มเหลวครั้งแรก (expected ≥5 responses) | assertion ใน test script คาดหวัง 5 responses แต่ flow สร้าง 4 (normal/mild/moderate/severe; duplicate ถูก block) | แก้ `ghq28-sqa-test.ts` ให้ expect `storedResponses.length >= 4` |

ไม่พบข้อบกพร่องใน application logic จากชุดทดสอบนี้

---

## 6. สรุปผล

| ประเภท | Pass | Fail | รวม |
|---|---|---|---|
| Unit (SC) | 9 | 0 | 9 |
| Integration (INT) | 12 | 0 | 12 |
| Build | 2 | 0 | 2 |
| **รวมทั้งหมด** | **23** | **0** | **23** |

**สรุป:** GHQ-28 ใช้เกณฑ์ 4 ระดับความรุนแรงครบถ้วน ไม่มี screening ≥24 ใน API/UI ชุด SQA บน Docker DB ผ่านทั้งหมด และ build server/client สำเร็จ

---

## 7. คำสั่ง reproduce

```powershell
# จาก root โปรเจกต์
Copy-Item server/.env.test.example server/.env.test   # ครั้งแรกเท่านั้น

cd server
npm run test:db:up
npm run test:db:migrate
npm run ghq28:seed
npm run test:unit
npm run test:sqa

# หรือรันครบชุด
npm run test:sqa:all

# ปิด test DB เมื่อเสร็จ
npm run test:db:down
```

Build verification:

```powershell
cd server && npm run build
cd ../client && npm run build
```
