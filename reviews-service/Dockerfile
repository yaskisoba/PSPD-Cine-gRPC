FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY proto/reviews.proto ./proto/reviews.proto
COPY server.js .
EXPOSE 50052
CMD ["node", "server.js"]
