# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/

RUN pnpm install --prod --frozen-lockfile

# Choose service to run via env (default api)
ENV SERVICE=api
EXPOSE 3000

CMD ["sh", "-c", "node packages/${SERVICE}/dist/server.js"]
