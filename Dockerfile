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

# Create user for development (matches host user)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Expose port for development server
EXPOSE 3030

# Development uses volume mounts for hot reload
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only package files for better caching
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Production builder stage
FROM base AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install all dependencies (including dev dependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build arguments for metadata
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=latest

# Set dummy build-time environment variables for Next.js build
# These will be replaced at runtime by actual values
ENV NEXT_PUBLIC_STACK_PROJECT_ID=build_placeholder
ENV NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=build_placeholder
ENV STACK_SECRET_SERVER_KEY=build_placeholder

# Build the application
RUN npm run build

# Production runner stage
FROM base AS production

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

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
