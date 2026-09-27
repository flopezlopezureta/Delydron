FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
# Auto-incrementing build version: MAJOR.MINOR are bumped by hand for real
# milestones, PATCH is the build timestamp so every deploy gets a new,
# always-increasing number with no manual step. Deliberately not based on
# git history — Coolify's own repo import strips .git before Docker ever
# sees the build context, regardless of .dockerignore, so a commit count
# isn't reachable from here.
RUN echo "VITE_APP_VERSION=1.1.$(date +%Y%m%d%H%M)" > .env.production
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
