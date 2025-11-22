FROM node:18-slim

# تثبيت المتطلبات الأساسية فقط
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --no-optional --progress=false

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
