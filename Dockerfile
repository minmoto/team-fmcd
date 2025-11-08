FROM node:20-alpine AS base

# Development stage with hot reload
FROM base AS development

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Create user for development (matches host user)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app

ENV NEXT_TELEMETRY_DISABLED=1

# Expose port for development server
EXPOSE 3030

# Development uses volume mounts for hot reload
CMD ["npm", "run", "dev"]

# Production builder stage
FROM base AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production runner stage
FROM base AS production

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3030

USER nextjs

EXPOSE 3030

CMD ["node", "server.js"]