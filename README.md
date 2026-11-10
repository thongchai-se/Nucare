# NUCARE

ระบบดูแลและติดตามสุขภาวะนักศึกษา คณะพยาบาลศาสตร์ มหาวิทยาลัยขอนแก่น

## โครงที่คนรับช่วงต้องรู้

- `client/` — Next.js ฝั่งเว็บ
- `server/` — Express + Prisma API
- `docker-compose*.yml` — local / test / prod / faculty
- `server/prisma/schema.prisma` — โมเดลข้อมูล
- `server/src/routes/` — จุดเข้า API ตามบทบาท
- `client/src/app/(app)/` — หน้าทำงานของแต่ละบทบาท (URL เป็น `/student`, `/admin`, ฯลฯ)

ของใช้เฉพาะเครื่อง (ไม่ขึ้น git): `docs/`, `secrets/`, `status.md`, `data.md`, `.cursor/`, `.skill/`, `.impeccable/`, `all/`

บทบาทหลัก: Student, Advisor, Instructor, Student Development, Mental Health, Executive, Admin

กฎสำคัญตอนนี้

- ผู้สอนเห็นเฉพาะนักศึกษาที่แอดมินมอบหมายในหน้าจัดการนักศึกษา
- สถิติผู้บริหารเป็นภาพรวม ไม่ใช้เปิดประวัติรายคน
- Cookie ความยินยอมถูกบันทึกที่ `POST /api/consent`
- อย่าตั้ง `NEXT_PUBLIC_API_URL` บน Vercel ถ้าต้องการให้ cookie อยู่โดเมนเดียวกับเว็บ ให้ใช้ `NUCARE_API_PROXY_URL` แทน

## รันในเครื่อง

1. เปิด Docker แล้วรันฐานข้อมูล

```powershell
docker compose up -d db
```

2. คัดลอก env

```powershell
copy server\.env.example server\.env.local
copy client\.env.example client\.env.local
```

ใส่ `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` ใน `server/.env.local`

3. ติดตั้งและรัน

```powershell
cd server
npm install
npx prisma migrate deploy
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

เว็บ: `http://localhost:3000`  
API health: `http://localhost:5000/api/health`

## ตรวจก่อนส่งงาน

```powershell
cd server
npm run test:unit
npx tsc -p tsconfig.json --noEmit

cd ..\client
npx tsc -p tsconfig.json --noEmit
```

## Deploy เซิร์ฟเวอร์คณะ (port 89)

```bash
cp .env.faculty.example .env.faculty
# แก้ NUCARE_PUBLIC_APP_ORIGIN=http://10.101.111.160:89
mkdir -p secrets/faculty
# สร้างไฟล์ secret: postgres_password, database_url, jwt_access_secret,
# jwt_refresh_secret, ai_api_key (อย่า commit)
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d
curl -sS http://127.0.0.1:89/api/health
```

เอกสารละเอียดเพิ่มเติมเก็บใน `docs/` บนเครื่องพัฒนา (ไม่ขึ้น repo นี้)
