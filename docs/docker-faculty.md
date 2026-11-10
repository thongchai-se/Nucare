# Faculty Ubuntu — Docker Compose (port 89)

Deploy NUCARE บนเซิร์ฟเวอร์คณะแบบแยกโปรเจกต์ ไม่แตะ container อื่น

## Architecture

```
Host :89 → nucare-client:3000
              └─ /api/* rewrite → nucare-server:5000 (internal)
                                   └─ nucare-db:5432 (internal volume)
```

- Compose file: `docker-compose.faculty.yml`
- Project name: `nucare` (`-p nucare`)
- Directory service: **ไม่รันในรอบแรก** (ประหยัด RAM; admin import นิสิตผ่านหน้าแอดมินได้)
- Email: `console` + `ALLOW_CONSOLE_EMAIL=true` จนกว่าจะได้ SMTP
- Chat: `CHAT_PROVIDER=kku` + API key ใน secret file

## ก่อนขึ้นเครื่องคณะ

1. Push โค้ดขึ้น git แล้ว `git clone` / `git pull` ที่ `/home/nucare/...`
2. คัดลอก env:
   ```bash
   cp .env.faculty.example .env.faculty
   ```
3. แก้ `NUCARE_PUBLIC_APP_ORIGIN` เป็น `http://10.101.111.160:89` (ค่าเริ่มต้นใน `.env.faculty.example` แล้ว; เปลี่ยนเป็นโดเมนเมื่อมี)
4. สร้าง secrets:
   ```bash
   mkdir -p secrets/faculty
   # ใส่ค่าจริงทีละไฟล์ (อย่า commit)
   nano secrets/faculty/postgres_password.txt
   nano secrets/faculty/database_url.txt
   nano secrets/faculty/jwt_access_secret.txt
   nano secrets/faculty/jwt_refresh_secret.txt
   nano secrets/faculty/ai_api_key.txt
   chmod 600 secrets/faculty/*
   ```
5. รูปแบบ `database_url.txt` (รหัสผ่านต้องตรงกับ postgres_password.txt):
   ```
   postgresql://nucare:<PASSWORD>@db:5432/nucare?schema=public
   ```
6. JWT secrets ยาวอย่างน้อย 32 ตัวอักษร

## Deploy (build ทีละตัวถ้า RAM ตึง)

```bash
cd /home/nucare/NUCare   # path จริงหลัง clone

# แนะนำบนเครื่อง RAM จำกัด: build ทีละ service
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build db
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build server
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build client

docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d
```

## Verify

```bash
docker compose -p nucare ps
docker compose -p nucare logs --tail=80 server client db
curl -sS http://127.0.0.1:89/api/health
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:89/
# จากเครื่องอื่นในเครือข่ายคณะ (ถ้าระบบอนุญาต):
# curl -sS http://10.101.111.160:89/api/health
docker ps --format '{{.Names}}\t{{.Ports}}'
```

ตรวจว่า container คณะอื่นยังรันตามเดิม

## เมื่อได้โดเมน + HTTPS จากคณะ

1. ตั้ง `NUCARE_PUBLIC_APP_ORIGIN=https://your-domain`
2. ตั้ง `NUCARE_AUTH_COOKIE_SECURE=true`
3. ตั้ง `NUCARE_TRUST_PROXY_HOPS=1`
4. Rebuild **client** (เพราะ `NEXT_PUBLIC_SITE_URL` bake ตอน build) แล้ว recreate:
   ```bash
   docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d --build client
   docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d --force-recreate server
   ```
5. แจ้งผู้ดูแล: IP, port 89, โดเมนที่ต้องการ, ว่า app ตอบแล้ว

## เมื่อได้ SMTP

แก้ `.env.faculty`:
- `NUCARE_EMAIL_PROVIDER=smtp`
- `NUCARE_ALLOW_CONSOLE_EMAIL=false`
- ใส่ `NUCARE_SMTP_*` รวมรหัสผ่าน
- recreate server

## Rollback เฉพาะ NUCARE

```bash
# หยุด / ลบ container ของโปรเจกต์ nucare เท่านั้น — เก็บ volume DB
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml stop
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml rm -f

# ห้าม: docker compose down -v ถ้ายังต้องการข้อมูล
# ห้าม: แตะ container ชื่อ train_nu_*, wp_*, nu_alumni_*, uptime-kuma
```

## Directory (ภายหลัง ถ้าต้องการ)

บริการคลังรายชื่ออยู่ที่ `all/directory/` (local archive ไม่ขึ้น git ทางการ) เป็น SQLite แยก ไม่ได้อยู่ใน Compose นี้  
เพิ่มทีหลังเมื่อ RAM ว่างและต้องการดึงรายชื่อภายนอก — อย่ารันพร้อมรอบแรกถ้าไม่จำเป็น
