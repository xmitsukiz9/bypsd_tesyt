import express from "express";
import puppeteer from "puppeteer";
import { UAParser } from 'ua-parser-js';
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;


app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// تخزين للزيارات السابقة (مدى الحياة)
const visitorCache = new Map();

const sites = {
  yorurl: {
    baseUrl: "https://go.yorurl.com/",
    referer: "https://how2guidess.com/",
  },
  linkjust: {
    baseUrl: "https://linkjust.com/",
    referer: "https://yjiur.xyz/",
  },
  shr2link: {
    baseUrl: "https://shr2.link/",
    referer: "https://bigcarinsurance.com/",
  },
  just2earn: {
    baseUrl: "https://go.just2earn.com/",
    referer: "https://mahitiportal.in/",
  },
  "nitro-link": {
    baseUrl: "https://nitro-link.com/",
    referer: "https://finestart.online/",
  },
};

// دالة تحسين معلومات OS و Browser باستخدام ua-parser-js
function getEnhancedSystemInfo(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  // تحسين معلومات نظام التشغيل
  let osInfo = 'Unknown OS';
  if (result.os.name) {
    osInfo = result.os.name;
    if (result.os.version) {
      osInfo += ` ${result.os.version}`;
    }
    
    // تحسين الأسماء
    osInfo = osInfo
      .replace('Mac OS', 'macOS')
      .replace('Windows', 'Windows')
      .replace('iOS', 'iOS')
      .replace('Android', 'Android')
      .replace('Linux', 'Linux')
      .replace('Chrome OS', 'ChromeOS');
  }
  
  // تحسين معلومات المتصفح
  let browserInfo = 'Unknown Browser';
  if (result.browser.name) {
    browserInfo = result.browser.name;
    if (result.browser.version) {
      // أخذ الجزء الرئيسي من الإصدار فقط (أول جزئين)
      const versionParts = result.browser.version.split('.').slice(0, 2);
      browserInfo += ` ${versionParts.join('.')}`;
    }
    
    // تحسين أسماء المتصفحات
    browserInfo = browserInfo
      .replace('Chrome', 'Chrome')
      .replace('Firefox', 'Firefox')
      .replace('Safari', 'Safari')
      .replace('Edge', 'Edge')
      .replace('Opera', 'Opera')
      .replace('Samsung Browser', 'Samsung Internet')
      .replace('UCBrowser', 'UC Browser');
  }
  
  return {
    os: osInfo,
    browser: browserInfo
  };
}

// دالة إرسال إشعار التليجرام
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    });

    const result = await response.json();
    return result.ok;
  } catch (error) {
    return false;
  }
}

// دالة التحقق من الزائر الجديد
function isNewVisitor(ip, userAgent) {
  const visitorKey = `${ip}-${userAgent}`;
  
  if (visitorCache.has(visitorKey)) {
    return false;  // زائر متكرر
  }
  
  // إضافة زائر جديد مدى الحياة
  visitorCache.set(visitorKey, Date.now());
  return true;  // زائر جديد
}

// دالة الحصول على الموقع الجغرافي من IP
async function getGeoLocation(ip) {
  // تجاهل IPs المحلية
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: 'Local',
      region: 'Local Network',
      city: 'Local',
      isp: 'Local',
      timezone: 'Local'
    };
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        country: data.country || 'Unknown',
        region: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        isp: data.isp || 'Unknown',
        timezone: data.timezone || 'Unknown',
        coordinates: data.lat && data.lon ? `${data.lat}, ${data.lon}` : 'Unknown'
      };
    }
  } catch (error) {
    // لا نطبع أي شيء في حالة الخطأ
  }

  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
    isp: 'Unknown',
    timezone: 'Unknown'
  };
}

// دالة استخراج معلومات الزائر مع الموقع الجغرافي
async function getVisitorInfo(req) {
  try {
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               'Unknown IP';

    // تنظيف عنوان IP
    const cleanIp = ip.toString().replace(/::ffff:/, '').replace(/^::1$/, '127.0.0.1').split(',')[0].trim();

    const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
    
    // استخدام ua-parser-js لاستخراج معلومات دقيقة
    const systemInfo = getEnhancedSystemInfo(userAgent);

    // الحصول على الموقع الجغرافي
    const geoInfo = await getGeoLocation(cleanIp);
    
    return {
      ip: cleanIp,
      userAgent,
      os: systemInfo.os,
      browser: systemInfo.browser,
      country: geoInfo.country,
      region: geoInfo.region,
      city: geoInfo.city,
      isp: geoInfo.isp,
      timezone: geoInfo.timezone,
      timestamp: new Date().toLocaleString(),
      isNew: isNewVisitor(cleanIp, userAgent)
    };
  } catch (error) {
    return {
      ip: 'Unknown',
      userAgent: 'Unknown',
      os: 'Unknown OS',
      browser: 'Unknown Browser',
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      isp: 'Unknown',
      timezone: 'Unknown',
      timestamp: new Date().toLocaleString(),
      isNew: true
    };
  }
}

// نقطة النهاية لتتبع الزيارات
app.post("/api/visit", async (req, res) => {
  try {
    const visitorInfo = await getVisitorInfo(req);
    
    // إرسال إشعار فقط للزوار الجدد
    if (visitorInfo.isNew) {
      // إنشاء رسالة التليجرام
      const message = `
🆕 <b>New Visitor</b>

📍 <b>IP:</b> <code>${visitorInfo.ip}</code>
🏴 <b>Country:</b> ${visitorInfo.country}
🏙️ <b>Region:</b> ${visitorInfo.region}
🏢 <b>City:</b> ${visitorInfo.city}
🌐 <b>ISP:</b> ${visitorInfo.isp}
🕒 <b>Timezone:</b> ${visitorInfo.timezone}

🖥️ <b>OS:</b> ${visitorInfo.os}
🌐 <b>Browser:</b> ${visitorInfo.browser}
🕒 <b>Time:</b> ${visitorInfo.timestamp}

📊 <b>User Agent:</b>
<code>${visitorInfo.userAgent}</code>
      `.trim();

      // إرسال الإشعار
      await sendTelegramNotification(message);
    }

    res.json({ success: true, message: "Visit logged", isNew: visitorInfo.isNew });
  } catch (error) {
    res.status(500).json({ success: false, error: "Tracking failed" });
  }
});

// نقطة النهاية لعمليات الـ Bypass (بدون إرسال إشعارات)
app.post("/api/bypass", async (req, res) => {
  const { site, urlPath } = req.body;

  if (!site || !urlPath)
    return res.status(400).json({ success: false, error: "Required parameters are missing" });

  const info = sites[site];
  if (!info)
    return res.status(400).json({ success: false, error: "This website is not currently supported" });

  const cleanPath = urlPath.replace(/^https?:\/\/[^\/]+\//, "").replace(/^\//, "");
  const fullUrl = info.baseUrl + cleanPath;

  try {
    const result = await extractDownloadLink(fullUrl, info.referer);

    if (result) {
      return res.json({ 
        success: true, 
        downloadUrl: result.downloadUrl, 
        attempts: result.attempts,
        totalWaitTime: result.totalWaitTime,
        originalUrl: fullUrl,
        message: "Link bypassed successfully!"
      });
    }

    return res.status(404).json({ 
      success: false, 
      error: "download link not found after multiple attempts" 
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: "Service temporarily unavailable" 
    });
  }
});

async function extractDownloadLink(fullUrl, referer) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: null,
      args: ['--start-maximized', '--no-sandbox']
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Referer': referer
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.goto(fullUrl, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    let downloadUrl = null;
    let attempts = 0;
    let totalWaitTime = 0;

    await new Promise(resolve => setTimeout(resolve, 6000));
    totalWaitTime += 6000;
    attempts = 1;
    
    downloadUrl = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, div, span');
      
      for (let element of elements) {
        const text = element.textContent?.trim().toLowerCase();
        
        if (text && (text.includes('get link') || 
                     text.includes('getlink') || 
                     text.includes('download'))) {
          
          // إذا كان رابط مباشر
          if (element.href && element.href.includes('http')) {
            return element.href;
          }
          // إذا كان لديه onclick
          if (element.getAttribute('onclick')) {
            const onclick = element.getAttribute('onclick');
            const urlMatch = onclick.match(/window\.open\('([^']+)'\)/) || 
                           onclick.match(/location\.href='([^']+)'/);
            if (urlMatch) return urlMatch[1];
          }
        }
      }
      return null;
    });

    if (!downloadUrl) {
      await new Promise(resolve => setTimeout(resolve, 6000));
      totalWaitTime += 6000;
      attempts = 2;
      
      downloadUrl = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, a, div, span');
        
        for (let element of elements) {
          const text = element.textContent?.trim().toLowerCase();
          
          if (text && (text.includes('get link') || 
                       text.includes('getlink') || 
                       text.includes('download') ||
                       text.includes('continue') ||
                       text.includes('proceed'))) {
            
            // إذا كان رابط مباشر
            if (element.href && element.href.includes('http')) {
              return element.href;
            }
            // إذا كان لديه onclick
            if (element.getAttribute('onclick')) {
              const onclick = element.getAttribute('onclick');
              const urlMatch = onclick.match(/window\.open\('([^']+)'\)/) || 
                             onclick.match(/location\.href='([^']+)'/);
              if (urlMatch) return urlMatch[1];
            }

            // البحث في data attributes
            const dataHref = element.getAttribute('data-href') || 
                           element.getAttribute('data-url') ||
                           element.getAttribute('data-link');
            if (dataHref) return dataHref;
          }
        }
        return null;
      });
    }

    if (downloadUrl) {
      return {
        downloadUrl,
        attempts,
        totalWaitTime
      };
    }

    return null;

  } catch (err) {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));