
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .


ARG VITE_CORE_API_URL
ARG VITE_AGENT_API_URL
ARG VITE_KEYCLOAK_URL

ENV VITE_CORE_API_URL=$VITE_CORE_API_URL
ENV VITE_AGENT_API_URL=$VITE_AGENT_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL

RUN npm run build


FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]