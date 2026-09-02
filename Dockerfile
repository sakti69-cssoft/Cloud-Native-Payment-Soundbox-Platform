FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json eslint.config.js ./
COPY src src
COPY simulator simulator
COPY scripts scripts
RUN npm run build && npm prune --omit=dev
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/dist dist
USER node
EXPOSE 3000
CMD ["node","dist/src/server.js"]
