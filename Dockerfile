FROM node:20-slim AS build
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-slim AS frontend-build
WORKDIR /app

COPY package*.json ./
COPY capacitor-plugin ./capacitor-plugin
COPY components ./components
COPY services ./services
COPY src ./src
COPY App.tsx ./
COPY index.tsx ./
COPY index.css ./
COPY index.html ./
COPY types.ts ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY metadata.json ./
COPY public ./public

RUN npm ci
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=8080

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./dist
COPY --from=frontend-build /app/dist ./public
RUN chown -R node:node /app/server

USER node

EXPOSE 8080
CMD ["node", "dist/index.js"]
