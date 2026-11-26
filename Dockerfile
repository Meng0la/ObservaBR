FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24.22.3-bookworm-slim
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/infrastructure/certs/supabase-prod-ca-2021.crt
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/apps/worker ./apps/worker
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/infrastructure/database-env.mjs ./infrastructure/
COPY --from=build --chown=node:node /app/infrastructure/certs ./infrastructure/certs
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
