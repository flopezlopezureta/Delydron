FROM node:22-alpine AS client-builder
WORKDIR /app
# Auto-incrementing build version: MAJOR.MINOR are bumped by hand for real
# milestones, PATCH is the total commit count so every push that reaches a
# deploy gets a new, always-increasing number with no manual step. Falls
# back to 0 rather than failing the whole build if git history is ever
# unavailable in the build context (e.g. a shallow clone).
RUN apk add --no-cache git
COPY .git ./.git
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN echo "VITE_APP_VERSION=1.1.$(git -C /app rev-list --count HEAD 2>/dev/null || echo 0)" > .env.production
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
