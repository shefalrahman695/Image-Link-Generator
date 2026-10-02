# Multi-stage Dockerfile for ImageLink Generator
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native sharp builds if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for sharp
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend and application files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/data ./data

# Ensure data directory exists with appropriate permissions
RUN mkdir -p /app/data/uploads

EXPOSE 3000

# Run using production tsx or node
CMD ["npx", "tsx", "server.ts"]
