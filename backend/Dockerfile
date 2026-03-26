FROM node:20-alpine AS base

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY . .
RUN mkdir -p logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:5000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
