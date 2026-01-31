# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy only package.json first (works even if package-lock.json is missing)
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Final Stage: Runtime Image
FROM node:18-alpine

# Create non-root user
RUN adduser -D appuser

USER appuser
WORKDIR /home/appuser

# Copy built app from builder
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "index.js"]
