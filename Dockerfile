FROM node:20-slim AS build
WORKDIR /app/server

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-slim AS frontend-build
WORKDIR /app

ENV VITE_API_BASE_URL=
ENV REACT_APP_API_BASE_URL=
ENV VITE_FIREBASE_API_KEY=AIzaSyBgAgFDRThLpOjG0j9V9yFfTiQs8T7bauc
ENV VITE_FIREBASE_AUTH_DOMAIN=chrommasnap-vertex-ai-use.firebaseapp.com
ENV VITE_FIREBASE_PROJECT_ID=chrommasnap-vertex-ai-use
ENV VITE_FIREBASE_APP_ID=1:757124892696:web:bebb7300ab59d615dedb6d

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
COPY postcss.config.cjs ./
COPY tailwind.config.cjs ./
COPY metadata.json ./
COPY public ./public

RUN npm ci
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app/server

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./dist
COPY --from=frontend-build /app/dist ./public
COPY server/public ./public
RUN chown -R node:node /app/server

USER node

EXPOSE 8080
CMD ["node", "dist/index.js"]
