# Build context = raiz do projeto (ver scripts/deploy-minikube.sh).
# Por isso os COPY usam o prefixo "frontend/".

# ── Stage 1: build do bundle Vite ─────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ .

# VITE_API_URL é injetada em build-time (Vite "assa" a URL no bundle estático).
# No K8S o deploy passa --build-arg VITE_API_URL=http://<minikube-ip>:30800
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: nginx servindo os arquivos estáticos ────────────────────────────
FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
