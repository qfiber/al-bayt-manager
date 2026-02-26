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

# Ensure upload directories exist
RUN mkdir -p uploads/logos public-uploads/logos

EXPOSE 4010
CMD ["node", "dist/index.js"]
