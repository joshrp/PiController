# syntax=docker.io/docker/dockerfile:1

FROM node:18-alpine AS base

# Install dependencies only when needed
# FROM base AS deps
# # Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat

WORKDIR /app/fe

# # Install dependencies based on the preferred package manager
# COPY package.json package-lock.json .npmrc* ./
# RUN npm ci;


# # Rebuild the source code only when needed
# FROM base AS builder
# WORKDIR /app/fe
# COPY --from=deps /app/fe/node_modules ./node_modules
# COPY . .

# RUN npm run build;

ENV NODE_ENV=production

ENV NEXT_TELEMETRY_DISABLED=1

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# RUN chown -R nextjs:nodejs ./

# USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["npm", "run", "dev"]
