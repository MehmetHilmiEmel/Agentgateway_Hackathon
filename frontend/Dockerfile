# frontend/Dockerfile
# Aşama 1: Build (Derleme)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Vite build alırken environment variable'lara ihtiyaç duyar (ARG ile alıyoruz)
ARG VITE_CORE_API_URL
ARG VITE_AGENT_API_URL
ARG VITE_KEYCLOAK_URL

ENV VITE_CORE_API_URL=$VITE_CORE_API_URL
ENV VITE_AGENT_API_URL=$VITE_AGENT_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL

RUN npm run build

# Aşama 2: Serve (Sunum)
FROM nginx:alpine
# Özel nginx ayarımızı kopyalıyoruz
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Build edilmiş dosyaları Nginx'in sunacağı klasöre kopyalıyoruz
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]