import express from "express";
import puppeteer from "puppeteer";
import { UAParser } from 'ua-parser-js';
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// إضافة متغيرات التليجرام من environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8357160519:AAFuZ6w3daWbXCKZ_ZdzgFAQCjplasU287A";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "7232694063";

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
  
  let osInfo = 'Unknown OS';
  if (result.os.name) {
    osInfo = result.os.name;
    if (result.os.version) {
      osInfo += ` ${result.os.version}`;
    }
    
    osInfo = osInfo
      .replace('Mac OS', 'macOS')
      .replace('Windows', 'Windows')
      .replace('iOS', 'iOS')
      .replace('Android', 'Android')
      .replace('Linux', 'Linux')
      .replace('Chrome OS', 'ChromeOS');
  }
  
  let browserInfo = 'Unknown Browser';
  if (result.browser.name) {
    browserInfo = result.browser.name;
    if (result.browser.version) {
      const versionParts = result.browser.version.split('.').slice(0, 2);
      browserInfo += ` ${versionParts.join('.')}`;
    }
    
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
    console.log('❌ Telegram credentials missing');
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
    console.log('❌ Telegram error:', error.message);
    return false;
  }
}

// دالة التحقق من الزائر الجديد
function isNewVisitor(ip, userAgent) {
  const visitorKey = `${ip}-${userAgent}`;
  
  if (visitorCache.has(visitorKey)) {
    return false;
  }
  
  visitorCache.set(visitorKey, Date.now());
  return true;
}

// دالة الحصول على الموقع الجغرافي من IP
async function getGeoLocation(ip) {
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
    // تجاهل الأخطاء بهدوء
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
               req.ip ||
               'Unknown IP';

    const cleanIp = ip.toString().replace(/::ffff:/, '').replace(/^::1$/, '127.0.0.1').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
    
    const systemInfo = getEnhancedSystemInfo(userAgent);
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
    
    if (visitorInfo.isNew) {
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

      await sendTelegramNotification(message);
    }

    res.json({ success: true, message: "Visit logged", isNew: visitorInfo.isNew });
  } catch (error) {
    console.log('❌ Visit tracking error:', error);
    res.status(500).json({ success: false, error: "Tracking failed" });
  }
});

// نقطة النهاية لعمليات الـ Bypass
app.post("/api/bypass", async (req, res) => {
  const { site, urlPath } = req.body;

  if (!site || !urlPath) {
    return res.status(400).json({ success: false, error: "Required parameters are missing" });
  }

  const info = sites[site];
  if (!info) {
    return res.status(400).json({ success: false, error: "This website is not currently supported" });
  }

  const cleanPath = urlPath.replace(/^https?:\/\/[^\/]+\//, "").replace(/^\//, "");
  const fullUrl = info.baseUrl + cleanPath;

  console.log(`🔗 Processing: ${fullUrl}`);

  try {
    const result = await extractDownloadLink(fullUrl, info.referer);

    if (result) {
      console.log(`✅ Success: ${result.downloadUrl}`);
      return res.json({ 
        success: true, 
        downloadUrl: result.downloadUrl, 
        attempts: result.attempts,
        totalWaitTime: result.totalWaitTime,
        originalUrl: fullUrl,
        message: "Link bypassed successfully!"
      });
    }

    console.log(`❌ Link not found for: ${fullUrl}`);
    return res.status(404).json({ 
      success: false, 
      error: "Download link not found after multiple attempts" 
    });

  } catch (error) {
    console.log('❌ Bypass error:', error);
    return res.status(500).json({ 
      success: false, 
      error: "Service temporarily unavailable" 
    });
  }
});

// دالة استخراج رابط التحميل مع إعدادات Replit
async function extractDownloadLink(fullUrl, referer) {
  let browser;
  try {
    // إعدادات خاصة لـ Replit
    const launchOptions = {
      headless: "new",
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };

    // استخدام المسار التنفيذي لـ Puppeteer إذا كان متوفراً (لـ Replit)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    // إعدادات المتصفح
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Referer': referer
    });

    // إزالة مؤشرات automation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    console.log(`🌐 Navigating to: ${fullUrl}`);
    await page.goto(fullUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    let downloadUrl = null;
    let attempts = 0;
    let totalWaitTime = 0;

    // المحاولة الأولى - انتظار 6 ثواني
    console.log('⏳ First attempt - waiting 6 seconds...');
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
          
          if (element.href && element.href.includes('http')) {
            return element.href;
          }
          
          if (element.getAttribute('onclick')) {
            const onclick = element.getAttribute('onclick');
            const urlMatch = onclick.match(/window\.open\('([^']+)'\)/) || 
                           onclick.match(/location\.href=['"]([^'"]+)['"]/);
            if (urlMatch) return urlMatch[1];
          }
        }
      }
      return null;
    });

    // المحاولة الثانية إذا لم ينجح
    if (!downloadUrl) {
      console.log('⏳ Second attempt - waiting 6 more seconds...');
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
            
            if (element.href && element.href.includes('http')) {
              return element.href;
            }
            
            if (element.getAttribute('onclick')) {
              const onclick = element.getAttribute('onclick');
              const urlMatch = onclick.match(/window\.open\('([^']+)'\)/) || 
                             onclick.match(/location\.href=['"]([^'"]+)['"]/);
              if (urlMatch) return urlMatch[1];
            }

            // البحث في data attributes
            const dataHref = element.getAttribute('data-href') || 
                           element.getAttribute('data-url') ||
                           element.getAttribute('data-link');
            if (dataHref && dataHref.includes('http')) {
              return dataHref;
            }
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
    console.log('❌ Browser error:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 Browser closed');
    }
  }
}

// استخدم index.html الموجود في public folder
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

// نقطة الصحة
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    visitors: visitorCache.size,
    uptime: process.uptime()
  });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`\n🚀 Server started on port ${PORT}`);
  console.log(`📧 Telegram Notifications: ${TELEGRAM_BOT_TOKEN ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`🌐 Supported sites: ${Object.keys(sites).join(', ')}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 Main page: http://localhost:${PORT}/\n`);
});
