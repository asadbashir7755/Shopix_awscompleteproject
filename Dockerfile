# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install git for fetching github packages (like mysql2 types)
RUN apk add --no-cache libc6-compat git
RUN npm ci --legacy-peer-deps

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
# Copy dependencies from Stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- BUILD ARGUMENTS FOR NEXT_PUBLIC_ VARIABLES ---
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER

# Set them as ENV so Next.js build process can see them
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create a non-privileged user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Server secrets (DB, STRIPE_SECRET, etc.) should be provided at RUNTIME 
# using the --env-file flag or container environment settings.
CMD ["node", "server.js"]
