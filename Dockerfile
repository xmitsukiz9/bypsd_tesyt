# استخدام الصورة الرسمية لـ Node.js
FROM node:18-slim

# تثبيت المتطلبات اللازمة لـ Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# إنشاء دليل التطبيق
WORKDIR /app

# نسخ ملف package.json و package-lock.json
COPY package*.json ./

# تثبيت dependencies
RUN npm install

# نسخ ملفات المصدر
COPY . .

# إنشاء دليل public إذا لم يكن موجوداً
RUN mkdir -p public

# تعيين البيئة لـ Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# تعيين المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["npm", "start"]
