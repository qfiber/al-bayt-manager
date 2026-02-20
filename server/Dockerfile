## Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc

## Stage 2: Production
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled output
COPY --from=build /app/dist ./dist

# Drizzle migration files (SQL, not TS)
COPY --from=build /app/src/db/migrations ./dist/db/migrations

# Ensure uploads directory exists
RUN mkdir -p uploads/logos

EXPOSE 3000
CMD ["node", "dist/index.js"]
