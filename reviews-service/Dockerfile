FROM node:22-alpine
WORKDIR /app
COPY reviews-service/package*.json ./
RUN npm ci --only=production
COPY proto/reviews.proto ./proto/reviews.proto
COPY reviews-service/server.js .
EXPOSE 50052
CMD ["node", "server.js"]
