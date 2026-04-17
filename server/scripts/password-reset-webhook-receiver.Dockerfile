FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY scripts/password-reset-webhook-receiver.mjs ./scripts/password-reset-webhook-receiver.mjs

ENV PORT=8080
EXPOSE 8080

CMD ["node", "scripts/password-reset-webhook-receiver.mjs"]
