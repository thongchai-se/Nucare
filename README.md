# NUCARE

ระบบดูแลและติดตามสุขภาวะนักศึกษา คณะพยาบาลศาสตร์ มหาวิทยาลัยขอนแก่น


- `client/` — Next.js ฝั่งเว็บ
- `server/` — Express + Prisma API
- `docker-compose*.yml` — local / test / prod / faculty
- `server/prisma/schema.prisma` — โมเดลข้อมูล
- `server/src/routes/` — จุดเข้า API ตามบทบาท
- `client/src/app/(app)/` — หน้าทำงานของแต่ละบทบาท (URL เป็น `/student`, `/admin`, ฯลฯ)
