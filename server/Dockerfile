FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
# prisma generate อยู่ใน npm run build; schema + migrations อยู่ใน prisma/
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
# dist/seed/admin-seed.js ถูกรวมจาก tsc แล้ว — รัน seed ด้วย node โดยไม่ต้องมี tsx
EXPOSE 5000
# อ่าน DATABASE_URL จาก Docker secret ก่อน migrate แล้วค่อยสตาร์ท API (ไม่ใช้ db push)
CMD ["sh", "-c", "set -e; if [ -n \"$DATABASE_URL_FILE\" ]; then if [ ! -f \"$DATABASE_URL_FILE\" ]; then echo \"DATABASE_URL_FILE not found: $DATABASE_URL_FILE\" >&2; exit 1; fi; DATABASE_URL=\"$(tr -d '\\r' < \"$DATABASE_URL_FILE\" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')\"; if [ -z \"$DATABASE_URL\" ]; then echo \"DATABASE_URL_FILE is empty: $DATABASE_URL_FILE\" >&2; exit 1; fi; export DATABASE_URL; fi; if [ -z \"$DATABASE_URL\" ]; then echo \"DATABASE_URL is required\" >&2; exit 1; fi; npx prisma migrate deploy; exec node dist/index.js"]
