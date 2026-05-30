# ── Stage dev: ng serve local (4200) ─────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]

# ── Stage builder: compila para producción ───────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx ng build --configuration production

# ── Stage prod: nginx sirve el build (puerto 80) ─────────────
FROM nginx:alpine AS prod
COPY --from=builder /app/dist/alcaldia-frontend /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]