# استخدام صورة Node.js رسمية
FROM node:18-alpine

# تعيين مجلد العمل
WORKDIR /app

# نسخ ملفات package
COPY package*.json ./

# تثبيت dependencies
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# تثبيت المتصفح المطلوب لـ Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# تعيين متغيرات البيئة لـ Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# فتح المنفذ
EXPOSE 3000

# تشغيل السيرفر
CMD ["npm", "start"]
