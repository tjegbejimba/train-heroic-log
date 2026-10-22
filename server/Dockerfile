FROM node:24.22.1-alpine3.24
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
