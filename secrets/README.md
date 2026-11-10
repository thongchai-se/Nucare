# Secrets Directory

เก็บไฟล์ secret จริงบนเครื่อง/เซิร์ฟเวอร์เท่านั้น — ไม่ commit ค่าจริง

## Faculty (`docker-compose.faculty.yml`)

สร้างใต้ `secrets/faculty/`:

- `postgres_password.txt`
- `database_url.txt`
- `jwt_access_secret.txt`
- `jwt_refresh_secret.txt`
- `ai_api_key.txt`
- `admin_seed_password.txt` (รหัส adminnucare@gmail.com)

ดูขั้นตอนใน `docs/docker-faculty.md`

## Production (`docker-compose.prod.yml`)

- `postgres_password.txt`
- `database_url.txt`
- `jwt_access_secret.txt`
- `jwt_refresh_secret.txt`
- `smtp_password.txt`

ตัวอย่างโครงสร้าง (ไม่มีค่าจริง) อยู่ที่ `secrets/examples/*.example.txt`
