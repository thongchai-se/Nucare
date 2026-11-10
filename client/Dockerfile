FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# เฉพาะค่า public / proxy ภายใน — ห้ามส่ง secret หรือ API key เข้า ARG/ENV ชุดนี้
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NUCARE_API_PROXY_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NUCARE_API_PROXY_URL=$NUCARE_API_PROXY_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# rewrite /api/* ถูก bake ตอน build; ค่านี้คงไว้ให้ runtime สอดคล้องกับ faculty compose
ARG NUCARE_API_PROXY_URL=
ENV NUCARE_API_PROXY_URL=$NUCARE_API_PROXY_URL
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
