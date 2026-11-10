# NUCARE

ระบบดูแลและติดตามสุขภาวะนักศึกษา คณะพยาบาลศาสตร์ มหาวิทยาลัยขอนแก่น

## โครงหลัก

- `client/` — Next.js ฝั่งเว็บ
- `server/` — Express + Prisma API
- `docker-compose*.yml` — local / test / prod / faculty
- `server/prisma/schema.prisma` — โมเดลข้อมูล
- `server/src/routes/` — จุดเข้า API ตามบทบาท
- `client/src/app/(app)/` — หน้าทำงานของแต่ละบทบาท (URL เป็น `/student`, `/admin`, ฯลฯ)

ของใช้เฉพาะเครื่อง (ไม่ขึ้น git): `status.md`, `data.md`, `.cursor/`, `.skill/`, `.impeccable/`, `all/`, `.env.faculty`, ไฟล์จริงใน `secrets/`

## รันในเครื่อง

```powershell
docker compose up -d db
copy server\.env.example server\.env.local
copy client\.env.example client\.env.local
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

เว็บ: `http://localhost:3000` — API health: `http://localhost:5000/api/health`

## Deploy เซิร์ฟเวอร์คณะ (port 89)

รายละเอียดเต็ม: `docs/docker-faculty.md`

```bash
cp .env.faculty.example .env.faculty
mkdir -p secrets/faculty
# สร้าง secret files ตาม docs/docker-faculty.md (อย่า commit)
chmod +x scripts/check-faculty-deploy.sh
./scripts/check-faculty-deploy.sh
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d --build
```
