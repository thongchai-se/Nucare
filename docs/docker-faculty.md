# Faculty Ubuntu — Docker Compose (port 89)

Deploy NUCARE บนเซิร์ฟเวอร์คณะแบบโปรเจกต์แยก ไม่แตะ container อื่นของคณะ

## Architecture

```
Host :89 → nucare-client:3000
              └─ /api/* rewrite → nucare-server:5000 (Docker network)
                                   └─ nucare-db:5432 (internal network + named volume)
```

| รายการ | ค่า |
|---|---|
| Compose | `docker-compose.faculty.yml` |
| Project | `-p nucare` |
| Public port | `89 → 3000` (client เท่านั้น) |
| Backend / DB host ports | ไม่เปิด |
| Chat | `CHAT_PROVIDER=kku` + `AI_API_KEY` จาก Docker secret |
| Email ช่วงแรก | `console` + `ALLOW_CONSOLE_EMAIL=true` |
| Directory service | ไม่รวมในรอบนี้ |

ชื่อ container / network / volume ใช้คำนำหน้า `nucare` เพื่อไม่ชนกับ `train_nu_*`, `wp_*`, `nu_alumni_*`, `uptime-kuma`

## 1) สร้างไฟล์ตั้งค่าบนเซิร์ฟเวอร์

```bash
cp .env.faculty.example .env.faculty
# ตรวจ NUCARE_PUBLIC_APP_ORIGIN=http://10.101.111.160:89
```

อย่า commit `.env.faculty`

## 2) สร้าง Secret บนเซิร์ฟเวอร์

```bash
mkdir -p secrets/faculty
chmod 700 secrets/faculty

# รหัสผ่าน PostgreSQL (สุ่มยาว และเก็บเฉพาะในไฟล์นี้)
openssl rand -base64 32 | tr -d '\n' > secrets/faculty/postgres_password.txt

# JWT อย่างน้อย 32 ตัวอักษร คนละค่า
openssl rand -base64 48 | tr -d '\n' > secrets/faculty/jwt_access_secret.txt
openssl rand -base64 48 | tr -d '\n' > secrets/faculty/jwt_refresh_secret.txt

# KKU Gen AI API key (วางค่าจริงหนึ่งบรรทัด ไม่มีช่องว่างหัวท้าย)
nano secrets/faculty/ai_api_key.txt
```

### Database URL

อ่านรหัสผ่านจากไฟล์แล้วประกอบ URL (host ต้องเป็นชื่อ service `db` ใน Compose):

```bash
DB_PASS="$(tr -d '\r\n' < secrets/faculty/postgres_password.txt)"
printf 'postgresql://nucare:%s@db:5432/nucare?schema=public\n' "$DB_PASS" \
  > secrets/faculty/database_url.txt
unset DB_PASS
```

ถ้า password มีอักขระพิเศษใน URL ให้ URL-encode ก่อนใส่

```bash
chmod 600 secrets/faculty/*
```

ไฟล์ที่ต้องมีและไม่ว่าง:

- `secrets/faculty/postgres_password.txt`
- `secrets/faculty/database_url.txt`
- `secrets/faculty/jwt_access_secret.txt`
- `secrets/faculty/jwt_refresh_secret.txt`
- `secrets/faculty/ai_api_key.txt`

## 3) ตรวจก่อน Deploy

```bash
chmod +x scripts/check-faculty-deploy.sh
./scripts/check-faculty-deploy.sh
```

สคริปต์ตรวจ: compose config, secret ครบ/ไม่ว่าง, gitignore, และ (ถ้ามี) docker build แบบเบา

## 4) Deploy

RAM จำกัด — build ทีละ service:

```bash
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build db
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build server
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml build client
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d
```

## 5) ตรวจสุขภาพ / logs / restart

```bash
docker compose -p nucare ps
docker compose -p nucare logs --tail=100 db
docker compose -p nucare logs --tail=100 server
docker compose -p nucare logs --tail=100 client

curl -sS http://127.0.0.1:89/api/health
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:89/

# จากเครือข่ายคณะ (ถ้าระบบอนุญาต)
# curl -sS http://10.101.111.160:89/api/health

# restart เฉพาะ NUCARE
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml restart server
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml restart client
```

ตรวจว่า container คณะอื่นยังรัน:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
```

## 6) Backup ฐานข้อมูล

```bash
mkdir -p backups
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml exec -T db \
  pg_dump -U nucare -d nucare -Fc > "backups/nucare-$(date +%Y%m%d-%H%M%S).dump"
```

กู้คืน (ระวัง: ทับข้อมูลใน volume):

```bash
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml exec -T db \
  pg_restore -U nucare -d nucare --clean --if-exists < backups/nucare-YYYYMMDD-HHMMSS.dump
```

## 7) เมื่อได้โดเมน + HTTPS

1. ตั้ง `NUCARE_PUBLIC_APP_ORIGIN=https://your-domain`
2. ตั้ง `NUCARE_AUTH_COOKIE_SECURE=true`
3. ตั้ง `NUCARE_TRUST_PROXY_HOPS=1`
4. Rebuild client แล้ว recreate server:
   ```bash
   docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d --build client
   docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml up -d --force-recreate server
   ```

## 8) Rollback เฉพาะ NUCARE

```bash
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml stop
docker compose -p nucare --env-file .env.faculty -f docker-compose.faculty.yml rm -f
# เก็บ volume: ห้าม down -v ถ้ายังต้องการข้อมูล
# ห้ามแตะ train_nu_*, wp_*, nu_alumni_*, uptime-kuma
```

## หมายเหตุความปลอดภัย

- ห้ามใส่รหัสผ่าน / JWT / API key ใน `.env.faculty` หรือ Compose
- ห้ามเปิดพอร์ต 5432 / 5000 ออก host
- ห้ามเปิด seed ผู้ใช้ตัวอย่างบนเซิร์ฟเวอร์คณะ
- เอกสารนี้ไม่มี credential จริง
