FROM node:20-slim AS build
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=8080

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
