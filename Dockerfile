# Step 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package management files (only yarn.lock to avoid npm conflicts)
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies needed for build)
# NODE_ENV must NOT be "production" here so devDeps are installed
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.cache/yarn yarn install --cache-folder /root/.cache/yarn --frozen-lockfile --prefer-offline --non-interactive --no-progress

# Copy the entire workspace (excluding files in .dockerignore)
COPY . .

# Build the Vite frontend SPA and bundle the Express server using esbuild
# Increase Node.js heap size to avoid OOM errors on large bundles
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# Step 2: Production runner stage (keeps the final image lightweight)
FROM node:22-alpine AS runner

# Cài ca-certificates và tzdata (Alpine)
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

ENV NODE_ENV=production

# Copy package files first to leverage Docker build cache for node_modules
COPY --from=builder /app/package.json /app/yarn.lock ./

# Install only production dependencies
RUN --mount=type=cache,target=/root/.cache/yarn yarn install --cache-folder /root/.cache/yarn --production --frozen-lockfile --prefer-offline --non-interactive --no-progress

# Copy only the compiled output directories from builder.
# dist/ = static frontend assets (publicly served via express.static)
# dist-server/ = bundled Express server (must stay outside the publicly served
# directory — it is never served over HTTP)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/assets/fonts ./server/assets/fonts

# Default port; runtime PORT is loaded from the environment or /app/.env.
EXPOSE 3012

# Run the bundled production server
CMD ["node", "dist-server/server.cjs"]
