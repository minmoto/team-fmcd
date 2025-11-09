FROM node:20-alpine AS base

# Add labels for metadata
LABEL maintainer="FMCD Team"
LABEL description="Multi-tenant dashboard for FMCD management"

# Development stage with hot reload
FROM base AS development

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Create user for development (but don't use it to match host user)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app
# USER nextjs  # Commented out for development to match host user

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Expose port for development server
EXPOSE 3030

# Development uses volume mounts for hot reload
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS prod-deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only package files for better caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --frozen-lockfile && npm cache clean --force

# All dependencies stage (for building)
FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only package files for better caching
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile && npm cache clean --force

# Production builder stage
FROM deps AS builder

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build arguments for metadata
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=latest

# Stack Auth environment variables must be provided at build time
# Use build args to pass these values during docker build
ARG NEXT_PUBLIC_STACK_PROJECT_ID
ARG NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
ARG STACK_SECRET_SERVER_KEY

ENV NEXT_PUBLIC_STACK_PROJECT_ID=$NEXT_PUBLIC_STACK_PROJECT_ID
ENV NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=$NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
ENV STACK_SECRET_SERVER_KEY=$STACK_SECRET_SERVER_KEY

# Build the application
RUN npm run build

# Production runner stage
FROM base AS production

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create public directory (Next.js expects it even if empty)
RUN mkdir -p public && chown nextjs:nodejs public

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3030

# Add build metadata
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=latest

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$VERSION

USER nextjs

EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3030 || exit 1

CMD ["node", "server.js"]
