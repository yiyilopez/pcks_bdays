FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
