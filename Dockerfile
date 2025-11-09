FROM node:lts-alpine AS base

# Development stage with hot reload
FROM base AS development

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
ENV HUSKY=0
RUN npm ci

# Create user but don't use in development for volume mounts
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

EXPOSE 3030
CMD ["npm", "run", "dev"]

# Build dependencies stage
FROM base AS installer

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
ENV HUSKY=0
RUN npm ci

# Copy source and build
COPY . .

# No build-time Stack Auth variables needed - using lazy initialization
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production runner stage
FROM base AS runner

WORKDIR /app

# Create user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application using Next.js standalone output
COPY --from=installer --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=installer --chown=nextjs:nodejs /public ./public

# Stack Auth variables provided at runtime via environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3030

USER nextjs

EXPOSE 3030

CMD ["node", "server.js"]
