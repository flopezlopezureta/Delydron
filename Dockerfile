FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tzdata
ENV TZ=America/Santiago
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js db.js schema.sql seed.sql ./
COPY middleware ./middleware
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY scripts ./scripts
COPY --from=client-builder /app/client/dist ./client/dist
EXPOSE 3000
CMD ["node", "server.js"]
