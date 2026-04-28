# ── Deps ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Dev: source mounted as volume, deps pre-installed ─────────────────────
FROM deps AS dev
CMD ["npm", "run", "dev"]

# ── Builder ───────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ── Prod runner (standalone) ──────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
