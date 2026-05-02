# Vercel Deployment Checklist

## รูปแบบที่แนะนำ

- สร้าง Vercel project แยก 2 ตัวจาก monorepo นี้
  - `client` สำหรับ frontend
  - `server` สำหรับ API
- ใช้ฐานข้อมูล **Neon Postgres** ต่อไป
- ให้ frontend proxy `/api/*` ไป backend ด้วย `NUCARE_API_PROXY_URL`
  - วิธีนี้ช่วยให้ session/cookie ยังทำงานผ่านโดเมนเว็บได้ง่ายกว่า
  - ลดความยุ่งยากเรื่อง cross-domain cookie ในช่วงที่เอาระบบขึ้นตรวจชั่วคราว

## ค่าที่ต้องกรอกจริงบน Vercel

### Frontend project (`client`)

ตั้งค่า Root Directory เป็น `client`

คัดลอกชุดนี้ไปกรอกใน Vercel ได้เลย

```env
NEXT_PUBLIC_SITE_URL=https://<โดเมน-frontend-ของคุณ>
NUCARE_API_PROXY_URL=https://<โดเมน-backend-ของคุณ>
NEXT_PUBLIC_API_URL=
```

ความหมายสั้นๆ

- `NEXT_PUBLIC_SITE_URL` คือโดเมนของเว็บฝั่งผู้ใช้
- `NUCARE_API_PROXY_URL` คือโดเมนของ backend จริงที่ Next.js จะ proxy `/api/*` ไปหา
- `NEXT_PUBLIC_API_URL` บน Vercel แนะนำให้ปล่อยว่าง ถ้าไม่ได้ตั้งใจให้ browser ยิง API ข้ามโดเมนตรงๆ

### Backend project (`server`)

ตั้งค่า Root Directory เป็น `server`

คัดลอกชุดนี้ไปกรอกใน Vercel ได้เลย

```env
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require&channel_binding=require
JWT_ACCESS_SECRET=<secret-ยาวอย่างน้อย-32-ตัวอักษร>
JWT_REFRESH_SECRET=<secret-ยาวอย่างน้อย-32-ตัวอักษร-และไม่ซ้ำ-access>
CLIENT_ORIGIN=https://<โดเมน-frontend-ของคุณ>
TRUST_PROXY_HOPS=1
PORT=5000
JSON_BODY_LIMIT=2mb
ASSESSMENT_RATE_LIMIT_WINDOW_MS=3600000
ASSESSMENT_RATE_LIMIT_MAX=30
SOS_RATE_LIMIT_WINDOW_MS=600000
SOS_RATE_LIMIT_MAX=3
ENABLE_DEFAULT_USER_SEED=false
ALLOW_DEFAULT_USER_SEED_IN_PRODUCTION=false
```

ถ้าต้องใช้ระบบลืมรหัสผ่านหรือส่งอีเมลจริง ให้กรอกเพิ่มชุดนี้

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<บัญชีอีเมลที่ใช้ส่ง>
SMTP_PASS=<รหัสผ่านหรือ app password>
SMTP_FROM=NUCARE Support <no-reply@example.com>
PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=5
```

หมายเหตุสำคัญ

- `DATABASE_URL` บน Vercel แนะนำให้ใช้ **Neon pooled connection string**
- `JWT_ACCESS_SECRET` และ `JWT_REFRESH_SECRET` ต้องเป็นคนละค่า และยาวอย่างน้อย 32 ตัวอักษร
- `TRUST_PROXY_HOPS=1` จำเป็นเมื่อ API อยู่หลัง Vercel
- `PORT=5000` ใส่คงไว้ได้เพื่อให้ค่าตรงกับ local แต่บน Vercel ตัว platform จะจัดการการรับทราฟฟิกให้อีกชั้น

## พฤติกรรมของระบบตอนขึ้น Vercel

- `/api/*` จาก frontend จะถูก rewrite ไปที่ `NUCARE_API_PROXY_URL/api/*`
- security headers ฝั่งเว็บถูกกำหนดจาก `client/next.config.mjs`
- ฝั่ง server จะตรวจ `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` ตอน startup ก่อนเปิดให้ใช้งานจริง

## Neon database

ก่อน deploy production ครั้งแรก ให้ apply schema ไปที่ Neon จากเครื่องที่ไว้ใจได้

```powershell
cd server
$env:DATABASE_URL="postgresql://..."
npx prisma db push
```

ถ้า Prisma schema เปลี่ยนในอนาคต ให้รัน `npx prisma db push` ซ้ำทุกครั้ง จนกว่าจะเปลี่ยนไปใช้ migration flow แบบเต็ม

## ลำดับ deploy ที่ปลอดภัย

1. Deploy `server` ก่อน
2. เอา URL ของ backend ที่ได้ ไปใส่ใน `NUCARE_API_PROXY_URL` ของ `client`
3. Deploy `client`
4. ถ้าโดเมน frontend เปลี่ยน อย่าลืมกลับมาอัปเดต `CLIENT_ORIGIN` ที่ backend

## Smoke Test หลัง deploy

เช็กอย่างน้อยตามนี้

- `https://<frontend-domain>/`
- `https://<frontend-domain>/api/health`
- flow ล็อกอิน
- redirect หลังล็อกอินเข้าหน้า dashboard
- flow ออกจากระบบ
- flow ลืมรหัสผ่าน ถ้ามีการตั้ง SMTP

## ข้อควรระวัง

- อย่า commit `.env` จริงหรือ credential ของ Neon ลง repo
- ถ้า secret เคยหลุดในแชต, screenshot หรือ commit ให้ rotate ทันที
- สำหรับรอบตรวจชั่วคราวบน Vercel แนะนำให้คง `ENABLE_DEFAULT_USER_SEED=false` ไว้ก่อน
- ถ้าจำเป็นต้องเปิด seed ผู้ใช้ตัวอย่างจริงๆ ให้ทำแบบชั่วคราวและปิดกลับหลังตรวจเสร็จ
