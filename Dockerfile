# Multi-stage Dockerfile for AI API Reverse-Engineering Platform
FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

# Copy root and workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies across workspaces
RUN npm install

# Copy complete project source
COPY . .

# Build both backend (tsc) and frontend (vite)
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
RUN apk add --no-cache git
ENV NODE_ENV=production
ENV PORT=10000

# Copy package and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/examples ./examples

EXPOSE 10000 5001

CMD ["npm", "start"]
