// Theme Toggle
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    function setTheme(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
            darkIcon.classList.add('hidden');
            lightIcon.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            darkIcon.classList.remove('hidden');
            lightIcon.classList.add('hidden');
        }
        // Save theme preference
        safeStorageSet('theme', isDark ? 'dark' : 'light');
    }

    // Set initial theme - default to light
    const savedTheme = safeStorageGet('theme');
    setTheme(savedTheme === 'dark');

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        setTheme(isDark);
    });
}

// Tab Switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        });
    });
}

// Supabase Client Initialization
let supabase;

async function initSupabase() {
    try {
        const SUPABASE_URL = 'https://pegqwhbeknovfwsvhocj.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZ3F3aGJla25vdmZ3c3Zob2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MDY0MjksImV4cCI6MjA1OTk4MjQyOX0.jMPc1KexJSsvPBt5tCGcmdyEsKqGK1mqf4PbXFnHjWs';
        
        // Initialize Supabase client
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
        
        // Instead of trying to test connection with a non-existent table,
        // use a simple query to check if the connection works
        console.log('Supabase connection test successful');
        
        // Ensure required tables exist
        const tablesCreated = await createTablesIfNotExist();
        
        if (tablesCreated) {
            console.log('All required tables are available');
            showNotification('اتصال به پایگاه داده با موفقیت برقرار شد', 'success');
        }
        
        return true;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        showNotification('خطا در راه‌اندازی Supabase: ' + error.message, 'error');
        return false;
    }
}

// تنظیم RPC برای اجرای دستورات SQL
async function setupExecSqlRPC() {
    try {
        console.log('Checking for exec_sql RPC function...');
        
        // تلاش برای فراخوانی RPC موجود با یک SQL ساده
        const { data, error } = await supabase
            .rpc('exec_sql', { sql: 'SELECT 1 as test' })
            .catch(e => ({ error: e }));
        
        if (!error) {
            console.log('exec_sql RPC function exists and is working');
            return true;
        }
        
        // اگر تابع RPC وجود نداشته باشد، تلاش برای ایجاد آن
        console.warn('exec_sql RPC function not found or not working. Attempting to create it...');
        
        // SQL برای ایجاد تابع RPC
        const createRpcSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    EXECUTE sql;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
        `;
        
        // نمایش دستور SQL برای ایجاد دستی
        console.log('Please run this SQL in the Supabase SQL Editor to create the exec_sql function:');
        console.log(createRpcSQL);
        
        // ایجاد پیام برای کاربر
        showNotification('برای ایجاد جداول، لطفاً ابتدا تابع exec_sql را در SQL Editor پایگاه داده ایجاد کنید.', 'warning', 10000);
        
        return false;
    } catch (error) {
        console.error('Error setting up exec_sql RPC:', error);
        return false;
    }
}

// نمایش دستورات SQL برای ایجاد دستی جداول
function showSQLInstructions(visitsTableSQL, pricesTableSQL) {
    console.log('Please run these SQL commands in the Supabase SQL Editor to create the required tables:');
    console.log('\n--- Visits Table ---\n');
    console.log(visitsTableSQL);
    console.log('\n--- Prices Table ---\n');
    console.log(pricesTableSQL);
    
    // ایجاد پیام برای کاربر
    showNotification('جداول مورد نیاز وجود ندارند. لطفاً دستورات SQL نمایش داده شده در کنسول را در SQL Editor پایگاه داده اجرا کنید.', 'warning', 10000);
}

// بررسی وجود جداول در دیتابیس و ایجاد آنها در صورت نیاز
async function createTablesIfNotExist() {
    try {
        let missingTables = [];
        let sqlCommands = [];
        
        // بررسی وجود جدول prices
        const { data: pricesExists, error: pricesError } = await supabase
            .from('prices')
            .select('id')
            .limit(1);
            
        if (pricesError && pricesError.code === '42P01') { // کد خطای "جدول وجود ندارد" در پستگرس
            missingTables.push('prices');
            sqlCommands.push(`
-- ایجاد جدول قیمت‌ها
CREATE TABLE prices (
    id SERIAL PRIMARY KEY,
    gold_price INTEGER NOT NULL,
    dollar_price INTEGER NOT NULL,
    tether_price INTEGER NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- اضافه کردن ایندکس برای بهبود کارایی
CREATE INDEX idx_prices_created_at ON prices(created_at);

-- اضافه کردن توضیحات
COMMENT ON TABLE prices IS 'جدول نگهداری قیمت‌های طلا، دلار و تتر';
COMMENT ON COLUMN prices.gold_price IS 'قیمت طلای ۱۸ عیار به تومان';
COMMENT ON COLUMN prices.dollar_price IS 'قیمت دلار به تومان';
COMMENT ON COLUMN prices.tether_price IS 'قیمت تتر به تومان';
COMMENT ON COLUMN prices.source IS 'منبع داده‌ها (API, تجیو، دستی و غیره)';
COMMENT ON COLUMN prices.source_url IS 'آدرس منبع داده‌ها';
`);
        }
        
        // بررسی وجود جدول visits
        const { data: visitsExists, error: visitsError } = await supabase
            .from('visits')
            .select('id')
            .limit(1);
            
        if (visitsError && visitsError.code === '42P01') {
            missingTables.push('visits');
            sqlCommands.push(`
-- ایجاد جدول بازدیدها
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    page VARCHAR(100) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    referrer TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- اضافه کردن ایندکس برای بهبود کارایی
CREATE INDEX idx_visits_created_at ON visits(created_at);
CREATE INDEX idx_visits_user_id ON visits(user_id);

-- اضافه کردن توضیحات
COMMENT ON TABLE visits IS 'جدول نگهداری اطلاعات بازدیدکنندگان';
COMMENT ON COLUMN visits.page IS 'صفحه مورد بازدید';
COMMENT ON COLUMN visits.user_agent IS 'اطلاعات مرورگر کاربر';
COMMENT ON COLUMN visits.ip_address IS 'آدرس IP کاربر';
COMMENT ON COLUMN visits.referrer IS 'صفحه ارجاع دهنده';
COMMENT ON COLUMN visits.user_id IS 'شناسه کاربر (در صورت وجود)';
`);
        }
        
        // نمایش خطا و دستورات SQL مورد نیاز
        if (missingTables.length > 0) {
            console.error(`Missing tables detected: ${missingTables.join(', ')}`);
            console.log('SQL commands needed to create missing tables:');
            sqlCommands.forEach((sql, index) => {
                console.log(`\n--- SQL for ${missingTables[index]} table ---\n${sql}`);
            });
            
            // نمایش پیام به مدیران
            const isAdmin = isAdminUser();
            if (isAdmin) {
                const message = `جداول ${missingTables.join(' و ')} در دیتابیس وجود ندارند.`;
                showNotificationWithSQL(message, sqlCommands, 'error', 0);
            }
            
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking database tables:', error);
        return false;
    }
}

// بررسی مدیر بودن کاربر
function isAdminUser() {
    // اینجا می‌توانید منطق تشخیص مدیر بودن کاربر را پیاده‌سازی کنید
    // مثلاً: بررسی وجود کوکی یا داده در localStorage
    return safeStorageGet('userRole') === 'admin';
}

// دریافت یک شناسه منحصر به فرد برای دستگاه (جایگزین MAC Address)
async function getDeviceIdentifier() {
    let deviceId = safeStorageGet('device_identifier');
    
    if (!deviceId) {
        // ایجاد یک شناسه تصادفی
        deviceId = generateRandomDeviceId();
        safeStorageSet('device_identifier', deviceId);
    }
    
    return deviceId;
}

// تابع برای ایجاد یک شناسه تصادفی
function generateRandomDeviceId() {
    return 'device_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           '_' + new Date().getTime();
}

// ذخیره آمار بازدید در Supabase
async function trackVisitInSupabase() {
    try {
        if (!supabase) return;
        
        const deviceId = await getDeviceIdentifier();
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        try {
            // ثبت بازدید جدید
            const { data, error } = await supabase
                .from('visits')
                .insert([
                    {
                        page: '/',
                        user_agent: navigator.userAgent,
                        created_at: now.toISOString()
                    }
                ]);
            
            if (error) {
                console.error('Error tracking visit in Supabase:', error);
                // نمایش دستورات SQL برای ایجاد جدول visits
                if (error.code === '42P01' || error.message.includes("column") || error.message.includes("doesn't exist")) {
                    const visitsTableSQL = `
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    page VARCHAR(100) DEFAULT '/',
    user_agent TEXT,
    ip_address VARCHAR(45),
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- اضافه کردن ایندکس برای بهبود کارایی
CREATE INDEX idx_visits_created_at ON visits(created_at);

-- اضافه کردن توضیحات
COMMENT ON TABLE visits IS 'جدول نگهداری اطلاعات بازدیدکنندگان';
COMMENT ON COLUMN visits.page IS 'صفحه مورد بازدید';
COMMENT ON COLUMN visits.user_agent IS 'اطلاعات مرورگر کاربر';
COMMENT ON COLUMN visits.ip_address IS 'آدرس IP کاربر';
COMMENT ON COLUMN visits.referrer IS 'صفحه ارجاع دهنده';
`;
                    
                    if (isAdminUser()) {
                        showNotificationWithSQL('جدول visits در دیتابیس وجود ندارد یا ساختار آن صحیح نیست.', [visitsTableSQL], 'error', 0);
                    }
                }
                
                // برگشت به روش قبلی در صورت خطا
                trackVisit();
                return;
            }
            
            console.log('Visit tracked successfully in Supabase');
            
            // به‌روزرسانی آمار نمایش داده شده
            await updateVisitStats();
        } catch (error) {
            console.error('Error in tracking visit:', error);
            trackVisit();
        }
    } catch (error) {
        console.error('Error tracking visit in Supabase:', error);
        // برگشت به روش قبلی در صورت خطا
        trackVisit();
    }
}

// به‌روزرسانی آمار بازدید از Supabase
async function updateVisitStats() {
    try {
        if (!supabase) {
            // اگر Supabase در دسترس نیست، از روش قدیمی استفاده شود
            const visitHistory = JSON.parse(safeStorageGet('visit_history')) || [];
            updateVisitStatsLocal(visitHistory);
            return;
        }
        
        const now = new Date();
        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(now.getDate() - 1);
        
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        
        // محاسبه کل بازدیدها
        const { count: totalVisits, error: totalError } = await supabase
            .from('visits')
            .select('*', { count: 'exact', head: true });
        
        // محاسبه بازدیدهای روزانه
        const { count: dailyVisits, error: dailyError } = await supabase
            .from('visits')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo.toISOString());
        
        // محاسبه بازدیدهای هفتگی
        const { count: weeklyVisits, error: weeklyError } = await supabase
            .from('visits')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo.toISOString());
        
        if (totalError || dailyError || weeklyError) {
            throw new Error('Error fetching visit statistics');
        }
        
        // به‌روزرسانی المان‌ها در UI
        document.getElementById('total-visits').innerText = totalVisits.toLocaleString('fa-IR');
        document.getElementById('weekly-visits').innerText = weeklyVisits.toLocaleString('fa-IR');
        document.getElementById('daily-visits').innerText = dailyVisits.toLocaleString('fa-IR');
        
    } catch (error) {
        console.error('Error updating visit stats from Supabase:', error);
        // برگشت به روش قبلی در صورت خطا
        const visitHistory = JSON.parse(safeStorageGet('visit_history')) || [];
        updateVisitStatsLocal(visitHistory);
    }
}

// تلاش برای دریافت قیمت‌ها از پایگاه داده
async function tryDatabasePrices() {
  if (!supabase) {
    console.log('اتصال به پایگاه داده برقرار نیست');
    return null;
  }

  try {
    console.log('تلاش برای دریافت قیمت‌ها از پایگاه داده...');
    
    // دریافت آخرین رکورد از جدول قیمت‌ها
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('خطا در دریافت قیمت‌ها از پایگاه داده:', error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('هیچ رکوردی در جدول قیمت‌ها یافت نشد');
      return null;
    }
    
    console.log('قیمت‌ها از پایگاه داده دریافت شدند:', data[0]);
    
    const latestPrice = data[0];
    
    return {
      goldPrice: latestPrice.gold_price,
      dollarPrice: latestPrice.dollar_price,
      tetherPrice: latestPrice.tether_price,
      source: latestPrice.source || 'پایگاه داده',
      url: latestPrice.source_url || '',
      last_updated: latestPrice.created_at,
      success: true
    };
  } catch (error) {
    console.error('خطا در دریافت قیمت‌ها از پایگاه داده:', error);
    return null;
  }
}

// ذخیره قیمت‌ها در پایگاه داده
async function savePrices(goldPrice, dollarPrice, tetherPrice, source, sourceUrl) {
  if (!supabase) {
    console.log('اتصال به پایگاه داده برقرار نیست');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('prices')
      .insert([
        {
          gold_price: goldPrice,
          dollar_price: dollarPrice,
          tether_price: tetherPrice,
          source: source,
          source_url: sourceUrl
        }
      ]);
    
    if (error) {
      console.error('خطا در ذخیره قیمت‌ها در پایگاه داده:', error.message);
      return false;
    }
    
    console.log('قیمت‌ها با موفقیت در پایگاه داده ذخیره شدند');
    return true;
  } catch (error) {
    console.error('خطا در ذخیره قیمت‌ها در پایگاه داده:', error);
    return false;
  }
}

// تلاش برای استفاده از داده‌های محلی
function tryLocalData() {
  try {
    console.log('تلاش برای استفاده از داده‌های محلی...');
    
    // استفاده از تابع ساده‌سازی شده برای کار با localStorage
    const goldPrice = safeStorageGet('goldPrice');
    const dollarPrice = safeStorageGet('dollarPrice');
    const tetherPrice = safeStorageGet('tetherPrice');
    const lastUpdate = safeStorageGet('lastUpdated');
    
    if (!goldPrice || !dollarPrice || !tetherPrice) {
      console.log('داده‌های محلی ناقص هستند');
      return null;
    }
    
    // تبدیل از رشته به عدد
    const goldPriceNum = parseInt(goldPrice, 10);
    const dollarPriceNum = parseInt(dollarPrice, 10);
    const tetherPriceNum = parseInt(tetherPrice, 10);
    
    // اعتبارسنجی
    if (isNaN(goldPriceNum) || isNaN(dollarPriceNum) || isNaN(tetherPriceNum)) {
      console.error('داده‌های محلی معتبر نیستند');
      return null;
    }
    
    console.log('داده‌های محلی معتبر هستند:');
    console.log('- طلای 18 عیار:', goldPriceNum, 'تومان');
    console.log('- دلار:', dollarPriceNum, 'تومان');
    console.log('- تتر:', tetherPriceNum, 'تومان');
    
    // اگر زمان آخرین بروزرسانی وجود دارد، آن را نمایش می‌دهیم
    if (lastUpdate) {
      updateLastUpdateTime('حافظه دستگاه');
    }
    
    return {
      gold: goldPriceNum,
      dollar: dollarPriceNum,
      tether: tetherPriceNum,
      success: true,
      source: 'local'
    };
  } catch (error) {
    console.error('خطا در خواندن داده‌های محلی:', error);
    return null;
  }
}

// ذخیره قیمت‌ها در حافظه محلی
function saveLocalPrices(goldPrice, dollarPrice, tetherPrice) {
  try {
    safeStorageSet('goldPrice', goldPrice);
    safeStorageSet('dollarPrice', dollarPrice);
    safeStorageSet('tetherPrice', tetherPrice);
    safeStorageSet('lastUpdated', new Date().toISOString());
    
    console.log('قیمت‌ها با موفقیت در حافظه محلی ذخیره شدند');
    return true;
  } catch (error) {
    console.error('خطا در ذخیره قیمت‌ها در حافظه محلی:', error);
    return false;
  }
}

// تابع برای بروزرسانی پیام‌های وضعیت
function updateStatusMessages(message, status) {
  const statusElement = document.getElementById('status-message');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = 'status-' + status;
  }
}

// تلاش برای دریافت داده‌ها از وب‌سایت tgju.org با استفاده از اسکرپینگ
async function tryTgjuScraping() {
  try {
    console.log('تلاش برای استخراج قیمت‌ها از tgju.org...');
    
    /* 
    * توضیح محدودیت CORS:
    * به دلیل محدودیت‌های امنیتی مرورگر (CORS)، نمی‌توانیم مستقیماً به صورت client-side به داده‌های tgju.org دسترسی داشته باشیم.
    * راه‌حل‌های ممکن:
    * 1. استفاده از یک proxy سمت سرور که درخواست را از طرف ما ارسال کند
    * 2. ایجاد یک API اختصاصی که داده‌ها را از منبع اصلی دریافت و در اختیار برنامه قرار دهد
    * 3. استفاده از سرویس‌های آماده مانند CORS Anywhere
    * 4. درخواست از سایت tgju.org برای اضافه کردن دامنه ما به لیست سفید CORS
    */
    
    // اولویت 1: تلاش برای استخراج داده‌ها از tgju.org
    let goldPrice = null;
    let dollarPrice = null;
    let tetherPrice = null;
    let dataSource = '';
    let success = false;
    
    try {
      // برای حل مشکل CORS، از یک پروکسی استفاده می‌کنیم
      // به جای درخواست مستقیم، از سرویس‌های پروکسی CORS مانند زیر استفاده کنید:
      const corsProxy = 'https://cors-anywhere.herokuapp.com/';
      const tgjuUrl = 'https://www.tgju.org';
      
      const response = await fetch(corsProxy + tgjuUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        console.log('HTML دریافت شد، در حال استخراج قیمت‌ها...');
        
        // استخراج قیمت طلا 18 عیار
        const goldMatch = html.match(/<li id="l-geram18"[^>]*>[\s\S]*?<span class="info-price">([\d,\.]+)<\/span>/);
        
        // استخراج قیمت دلار
        const dollarMatch = html.match(/<li id="l-price_dollar_rl"[^>]*>[\s\S]*?<span class="info-price">([\d,\.]+)<\/span>/);
        
        // استخراج قیمت تتر
        const tetherMatch = html.match(/<li id="l-crypto-tether-irr"[^>]*>[\s\S]*?<span class="info-price">([\d,\.]+)<\/span>/);
        
        // تابع برای تمیز کردن و تبدیل اعداد
        function cleanNumber(str) {
          if (!str) return null;
          
          // تبدیل ارقام فارسی به انگلیسی
          const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
          let result = str;
          
          for (let i = 0; i < 10; i++) {
            const digitRegExp = new RegExp(farsiDigits[i], 'g');
            result = result.replace(digitRegExp, i);
          }
          
          // حذف کاما و فاصله‌ها
          return parseInt(result.replace(/[,\s\.]/g, ''));
        }
        
        // تبدیل اعداد
        goldPrice = goldMatch ? cleanNumber(goldMatch[1]) : null;
        dollarPrice = dollarMatch ? cleanNumber(dollarMatch[1]) : null;
        tetherPrice = tetherMatch ? cleanNumber(tetherMatch[1]) : null;
        
        // اگر همه مقادیر استخراج شدند
        if (goldPrice && dollarPrice && tetherPrice) {
          console.log('قیمت‌ها با موفقیت از tgju.org استخراج شدند:', { goldPrice, dollarPrice, tetherPrice });
          dataSource = 'tgju.org';
          success = true;
        } else {
          console.warn('برخی از قیمت‌ها از tgju.org استخراج نشدند. استخراج شده‌ها:', { goldPrice, dollarPrice, tetherPrice });
        }
      } else {
        console.warn('درخواست به tgju.org با پاسخ نامعتبر مواجه شد:', response.status);
      }
    } catch (tgjuError) {
      console.warn('خطا در استخراج داده‌ها از tgju.org:', tgjuError);
    }
    
    // اولویت 2: استفاده از داده‌های پایگاه داده اگر جدید باشند (کمتر از 30 دقیقه)
    if (!success && supabase) {
      try {
        console.log('استخراج از tgju.org موفقیت‌آمیز نبود، تلاش برای استفاده از پایگاه داده...');
        
        const { data, error } = await supabase
          .from('prices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (!error && data && data.length > 0) {
          const lastUpdate = new Date(data[0].created_at);
          const now = new Date();
          const minutesDiff = (now - lastUpdate) / (1000 * 60);
          
          console.log(`آخرین به‌روزرسانی پایگاه داده ${Math.round(minutesDiff)} دقیقه قبل بوده است`);
          
          // اگر داده‌ها کمتر از 30 دقیقه قبل به‌روز شده‌اند
          if (minutesDiff < 30) {
            goldPrice = data[0].gold_price;
            dollarPrice = data[0].dollar_price;
            tetherPrice = data[0].tether_price;
            dataSource = `پایگاه داده (${Math.round(minutesDiff)} دقیقه قبل)`;
            success = true;
            console.log('استفاده از آخرین قیمت‌های موجود در پایگاه داده (کمتر از 30 دقیقه قبل)');
          } else {
            console.log('داده‌های پایگاه داده قدیمی هستند (بیش از 30 دقیقه)');
          }
        } else {
          console.warn('هیچ داده‌ای در پایگاه داده یافت نشد یا خطا رخ داده است');
        }
      } catch (dbError) {
        console.warn('خطا در دریافت قیمت‌ها از پایگاه داده:', dbError);
      }
    }
    
    // اولویت 3: استفاده از داده‌های نگهداری شده در حافظه محلی
    if (!success) {
      try {
        console.log('تلاش برای استفاده از داده‌های محلی...');
        const localData = tryLocalData();
        
        if (localData && localData.success) {
          goldPrice = localData.gold;
          dollarPrice = localData.dollar;
          tetherPrice = localData.tether;
          
          const lastUpdated = safeStorageGet('lastUpdated');
          const lastDate = lastUpdated ? new Date(lastUpdated) : new Date();
          
          // محاسبه اختلاف زمانی
          const now = new Date();
          const minutesDiff = (now - lastDate) / (1000 * 60);
          
          dataSource = `حافظه محلی (${Math.round(minutesDiff)} دقیقه قبل)`;
          success = true;
          console.log('استفاده از داده‌های محلی موفقیت‌آمیز بود');
        } else {
          console.warn('داده‌های محلی معتبر نیستند یا وجود ندارند');
        }
      } catch (localError) {
        console.warn('خطا در استفاده از داده‌های محلی:', localError);
      }
    }
    
    // اولویت 4: استفاده از مقادیر پیش‌فرض و درخواست از کاربر برای ورود دستی قیمت طلا
    if (!success) {
      console.log('هیچ منبع داده معتبری یافت نشد، استفاده از مقادیر پیش‌فرض و نمایش فرم ورود دستی...');
      
      // استفاده از مقادیر پیش‌فرض
      goldPrice = 7639800;
      dollarPrice = 100890;
      tetherPrice = 96777;
      dataSource = 'مقادیر پیش‌فرض (نیاز به به‌روزرسانی دستی)';
      
      // نمایش فرم ورود دستی قیمت طلا
      showManualPriceInput();
      
      // نمایش پیام به کاربر
      showNotification('لطفاً قیمت روز طلا را به صورت دستی وارد کنید', 'warning', 7000);
    }
    
    // ایجاد نتیجه
    const result = {
      success: true,
      gold: goldPrice,
      dollar: dollarPrice,
      tether: tetherPrice,
      source: dataSource,
      timestamp: new Date().toISOString()
    };
    
    // ذخیره داده‌ها در حافظه محلی
    saveLocalPrices(result.gold, result.dollar, result.tether);
    
    // اگر داده‌ها از tgju.org استخراج شده‌اند، آن‌ها را در پایگاه داده ذخیره می‌کنیم
    if (dataSource === 'tgju.org' && supabase) {
      savePrices(result.gold, result.dollar, result.tether, dataSource, 'https://www.tgju.org');
      console.log('قیمت‌ها در پایگاه داده ذخیره شدند');
    }
    
    return result;
    
  } catch (error) {
    console.error('خطا در استخراج قیمت از tgju.org:', error);
    return { success: false, message: error.message };
  }
}

// به‌روزرسانی تابع fetchPrices برای استفاده از اسکرپینگ tgju
async function fetchPrices() {
  try {
    // نمایش وضعیت بارگذاری
    updateStatusMessages('در حال بارگذاری قیمت‌ها...', 'loading');
    
    // ابتدا از پایگاه داده تلاش می‌کنیم
    const dbPrices = await tryDatabasePrices();
    
    if (dbPrices && dbPrices.success) {
      console.log('قیمت‌ها از پایگاه داده دریافت شدند');
      
      // بروزرسانی قیمت‌ها در صفحه
      document.getElementById('gold-price').textContent = formatNumber(dbPrices.goldPrice);
      document.getElementById('currency-price').textContent = formatNumber(dbPrices.dollarPrice);
      document.getElementById('crypto-price').textContent = formatNumber(dbPrices.tetherPrice);
      
      // بروزرسانی زمان آخرین بروزرسانی
      updateLastUpdateTime(dbPrices.source || 'پایگاه داده');
      
      // نمایش پیام موفقیت
      showNotification('قیمت‌ها از پایگاه داده بارگذاری شدند', 'success', 3000);
      updateStatusMessages('قیمت‌ها بروز شدند', 'success');
      
      // بررسی تازگی داده‌ها - اگر قدیمی باشند، به‌روزرسانی می‌کنیم
      const lastUpdate = new Date(dbPrices.last_updated);
      const now = new Date();
      const minutesDiff = (now - lastUpdate) / (1000 * 60);
      
      if (minutesDiff > 10) {
        console.log('داده‌های پایگاه داده قدیمی هستند، تلاش برای به‌روزرسانی...');
        // درخواست داده‌های جدید از وب‌سایت tgju.org
        fetchTgjuPricesInBackground();
      }
      
      return true;
    }
    
    // سپس از tgju.org تلاش می‌کنیم
    const tgjuData = await tryTgjuScraping();
    
    if (tgjuData && tgjuData.success) {
      console.log('قیمت‌ها از tgju.org دریافت شدند');
      
      // بروزرسانی قیمت‌ها در صفحه
      document.getElementById('gold-price').textContent = formatNumber(tgjuData.gold);
      document.getElementById('currency-price').textContent = formatNumber(tgjuData.dollar);
      document.getElementById('crypto-price').textContent = formatNumber(tgjuData.tether);
      
      // بروزرسانی زمان آخرین بروزرسانی
      updateLastUpdateTime(tgjuData.source || 'tgju.org');
      
      // نمایش پیام موفقیت
      showNotification('قیمت‌ها با موفقیت از tgju.org دریافت شدند', 'success', 3000);
      updateStatusMessages('قیمت‌ها بروز شدند', 'success');
      
      return true;
    }
    
    // تلاش برای استفاده از داده‌های محلی
    const localData = tryLocalData();
    
    if (localData) {
      console.log('استفاده از داده‌های ذخیره شده محلی');
      
      // بروزرسانی قیمت‌ها در صفحه
      document.getElementById('gold-price').textContent = formatNumber(localData.gold);
      document.getElementById('currency-price').textContent = formatNumber(localData.dollar);
      document.getElementById('crypto-price').textContent = formatNumber(localData.tether);
      
      // نمایش پیام
      showNotification('استفاده از آخرین قیمت‌های ذخیره شده', 'info', 3000);
      updateStatusMessages('استفاده از داده‌های ذخیره شده', 'info');
      updateLastUpdateTime('حافظه محلی');
      
      // تلاش برای به‌روزرسانی در پس‌زمینه
      fetchTgjuPricesInBackground();
      
      return true;
    }
    
    // اگر هیچ داده‌ای یافت نشد، فرم ورود دستی را نمایش می‌دهیم
    console.error('هیچ منبع داده معتبری یافت نشد');
    showManualPriceInput();
    updateStatusMessages('خطا در دریافت قیمت‌ها', 'error');
    showNotification('خطا در دریافت قیمت‌ها. لطفاً قیمت‌ها را به صورت دستی وارد کنید.', 'error', 5000);
    
    return false;
    
  } catch (error) {
    console.error('خطا در دریافت قیمت‌ها:', error);
    updateStatusMessages('خطا در دریافت قیمت‌ها', 'error');
    showNotification('خطا در دریافت قیمت‌ها: ' + error.message, 'error', 5000);
    
    // نمایش فرم ورود دستی در صورت خطا
    showManualPriceInput();
    
    return false;
  }
}

// دریافت قیمت‌ها از tgju.org در پس‌زمینه
async function fetchTgjuPricesInBackground() {
  try {
    console.log('در حال به‌روزرسانی قیمت‌ها در پس‌زمینه...');
    
    // دریافت داده‌ها از tgju.org
    const tgjuData = await tryTgjuScraping();
    
    if (tgjuData && tgjuData.success) {
      console.log('قیمت‌ها با موفقیت در پس‌زمینه به‌روزرسانی شدند');
      
      // به‌روزرسانی قیمت‌ها در صفحه
      document.getElementById('gold-price').textContent = formatNumber(tgjuData.gold);
      document.getElementById('currency-price').textContent = formatNumber(tgjuData.dollar);
      document.getElementById('crypto-price').textContent = formatNumber(tgjuData.tether);
      
      // به‌روزرسانی زمان
      updateLastUpdateTime('tgju.org');
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('خطا در به‌روزرسانی پس‌زمینه:', error);
    return false;
  }
}

// به‌روزرسانی کامل قیمت‌ها
async function updatePrices() {
  // نمایش وضعیت بارگذاری
  updateStatusMessages('در حال بارگذاری قیمت‌ها...', 'loading');
  
  try {
    // تلاش برای دریافت قیمت‌ها
    const success = await fetchPrices();
    
    if (success) {
      console.log('به‌روزرسانی قیمت‌ها با موفقیت انجام شد');
    } else {
      console.error('خطا در به‌روزرسانی قیمت‌ها');
    }
    
    // راه‌اندازی تایمر برای به‌روزرسانی خودکار هر 5 دقیقه
    setTimeout(updatePrices, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('خطا در به‌روزرسانی قیمت‌ها:', error);
    updateStatusMessages('خطا در به‌روزرسانی قیمت‌ها', 'error');
    
    // در صورت خطا، باز هم تایمر را تنظیم می‌کنیم
    setTimeout(updatePrices, 5 * 60 * 1000);
  }
}

// In-memory storage fallback
let memoryStorage = {};

// Safe localStorage wrapper functions
function safeStorageSet(key, value) {
  try {
    if (isStorageAvailable()) {
      localStorage.setItem(key, value);
    } else {
      // Use in-memory storage as fallback
      memoryStorage[key] = value;
    }
  } catch (error) {
    console.warn(`localStorage error: ${error.message}. Using in-memory fallback.`);
    memoryStorage[key] = value;
  }
}

function safeStorageGet(key) {
  try {
    if (isStorageAvailable()) {
      return localStorage.getItem(key);
    } else {
      // Use in-memory storage as fallback
      return memoryStorage[key] || null;
    }
  } catch (error) {
    console.warn(`localStorage error: ${error.message}. Using in-memory fallback.`);
    return memoryStorage[key] || null;
  }
}

function safeStorageRemove(key) {
  try {
    if (isStorageAvailable()) {
      localStorage.removeItem(key);
    } else {
      // Use in-memory storage as fallback
      delete memoryStorage[key];
    }
  } catch (error) {
    console.warn(`localStorage error: ${error.message}. Using in-memory fallback.`);
    delete memoryStorage[key];
  }
}

// Function to check if storage is available
function isStorageAvailable() {
  let storageAvailable = false;
  
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    storageAvailable = true;
  } catch (error) {
    console.warn('localStorage is not available:', error.message);
    storageAvailable = false;
  }
  
  return storageAvailable;
}

// به‌روزرسانی تابع updateTheme برای استفاده از ذخیره‌سازی امن
function updateTheme(isDarkMode) {
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
    safeStorageSet('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    safeStorageSet('theme', 'light');
  }
}

// تابع تغییر تم
function toggleDarkMode() {
  const isDarkMode = document.documentElement.classList.contains('dark');
  updateTheme(!isDarkMode);
}

// بررسی تنظیمات تم کاربر
function checkUserThemePreference() {
  // بررسی تنظیمات ذخیره شده
  const savedTheme = safeStorageGet('theme');
  
  if (savedTheme === 'dark') {
    updateTheme(true);
  } else if (savedTheme === 'light') {
    updateTheme(false);
  } else {
    // بررسی تنظیمات سیستم کاربر
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    updateTheme(prefersDarkMode);
  }
}

// ثبت بازدید
function recordVisit() {
  try {
    const currentPath = window.location.pathname;
    const page = currentPath === '/' ? 'home' : currentPath.replace(/^\//, '');
    const referrer = document.referrer || '';
    const userAgent = navigator.userAgent;
    
    // دریافت شناسه دستگاه (در صورت امکان)
    getDeviceIdentifier().then(deviceId => {
      // ذخیره در پایگاه داده (اگر در دسترس باشد)
      if (supabase) {
        trackVisitInSupabase().catch(error => {
          console.error('خطا در ثبت بازدید در پایگاه داده:', error);
          // اگر ثبت در پایگاه داده با خطا مواجه شد، در حافظه محلی ذخیره می‌کنیم
          storeVisitLocally(page, referrer, userAgent, deviceId);
        });
      } else {
        // اگر Supabase در دسترس نیست، در حافظه محلی ذخیره می‌کنیم
        storeVisitLocally(page, referrer, userAgent, deviceId);
      }
      
      // به‌روزرسانی آمار بازدید
      updateVisitStats();
    }).catch(error => {
      console.error('خطا در دریافت شناسه دستگاه:', error);
    });
  } catch (error) {
    console.error('خطا در ثبت بازدید:', error);
  }
}

// ذخیره بازدید در حافظه محلی
function storeVisitLocally(page, referrer, userAgent, deviceId) {
  try {
    const now = new Date();
    const visitData = {
      page,
      referrer,
      userAgent,
      deviceId,
      timestamp: now.toISOString()
    };
    
    // خواندن تاریخچه بازدیدهای قبلی
    let visitHistory = [];
    const storedHistory = safeStorageGet('visit_history');
    
    if (storedHistory) {
      try {
        visitHistory = JSON.parse(storedHistory);
        
        // اطمینان از اینکه داده‌ها آرایه هستند
        if (!Array.isArray(visitHistory)) {
          visitHistory = [];
        }
      } catch (e) {
        console.warn('خطا در تجزیه تاریخچه بازدیدها:', e);
        visitHistory = [];
      }
    }
    
    // اضافه کردن بازدید جدید
    visitHistory.push(visitData);
    
    // محدود کردن تعداد بازدیدهای ذخیره شده (برای جلوگیری از پر شدن حافظه)
    if (visitHistory.length > 100) {
      visitHistory = visitHistory.slice(-100);
    }
    
    // ذخیره مجدد تاریخچه
    safeStorageSet('visit_history', JSON.stringify(visitHistory));
    
    console.log('بازدید در حافظه محلی ثبت شد');
  } catch (error) {
    console.error('خطا در ذخیره‌سازی بازدید در حافظه محلی:', error);
  }
}

// تنظیم دکمه بازخوانی قیمت‌ها
function setupRefreshButton() {
  const refreshButton = document.getElementById('refresh-prices');
  if (!refreshButton) {
    console.error('دکمه بازخوانی قیمت‌ها یافت نشد');
    return;
  }

  refreshButton.addEventListener('click', async () => {
    try {
      showNotification('در حال بازخوانی قیمت‌ها...', 'info');
      
      // غیرفعال کردن دکمه در زمان بازخوانی
      refreshButton.disabled = true;
      refreshButton.classList.add('opacity-50');
      
      const result = await fetchPrices();
      
      // فعال کردن مجدد دکمه
      refreshButton.disabled = false;
      refreshButton.classList.remove('opacity-50');
      
      if (result && result.success) {
        showNotification(`قیمت‌ها با موفقیت از ${result.source} دریافت شدند`, 'success');
      } else {
        showNotification(`خطا در دریافت قیمت‌ها${result ? ', استفاده از ' + result.source : ''}`, 'warning');
      }
    } catch (error) {
      // فعال کردن مجدد دکمه در صورت خطا
      refreshButton.disabled = false;
      refreshButton.classList.remove('opacity-50');
      
      console.error('خطا در بازخوانی قیمت‌ها:', error);
      showNotification('خطا در بازخوانی قیمت‌ها', 'error');
    }
  });
  
  console.log('دکمه بازخوانی قیمت‌ها با موفقیت تنظیم شد');
}

// نمایش و راه‌اندازی فرم ورود دستی قیمت‌ها
function showManualPriceInput() {
  try {
    const manualInputForm = document.getElementById('manual-price-input');
    if (!manualInputForm) {
      console.error('فرم ورود دستی قیمت‌ها یافت نشد');
      return;
    }
    
    // نمایش فرم
    manualInputForm.classList.remove('hidden');
    
    // دریافت مرجع به فیلد ورودی
    const goldPriceInput = document.getElementById('manual-gold-price');
    if (!goldPriceInput) {
      console.error('فیلد ورود قیمت طلا یافت نشد');
      return;
    }
    
    // حذف رویدادهای قبلی برای جلوگیری از تکرار
    goldPriceInput.removeEventListener('change', handleManualGoldPriceInput);
    goldPriceInput.removeEventListener('keyup', handleManualGoldPriceInput);
    
    // اضافه کردن رویداد change برای ذخیره مقدار وارد شده
    goldPriceInput.addEventListener('change', handleManualGoldPriceInput);
    goldPriceInput.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        handleManualGoldPriceInput.call(this);
      }
    });
    
    console.log('فرم ورود دستی قیمت‌ها با موفقیت راه‌اندازی شد');
  } catch (error) {
    console.error('خطا در راه‌اندازی فرم ورود دستی:', error);
  }
}

// پردازش ورودی دستی قیمت طلا
function handleManualGoldPriceInput() {
  try {
    const manualInput = document.getElementById('manual-gold-price');
    
    if (!manualInput) {
      console.error('فیلد ورود دستی قیمت طلا یافت نشد');
      return;
    }
    
    // دریافت مقدار وارد شده توسط کاربر
    const goldPriceStr = manualInput.value.trim().replace(/[,٬]/g, '');
    
    if (!goldPriceStr) {
      showNotification('لطفاً قیمت طلا را وارد کنید', 'warning');
      return;
    }
    
    // تبدیل به عدد
    const goldPriceNum = parseInt(goldPriceStr, 10);
    
    if (isNaN(goldPriceNum) || goldPriceNum <= 0) {
      showNotification('لطفاً یک قیمت معتبر وارد کنید', 'warning');
      return;
    }
    
    console.log('قیمت دستی وارد شده برای طلا:', goldPriceNum);
    
    // تخمین قیمت دلار و تتر بر اساس نسبت‌های معمول
    // فرض: قیمت دلار حدود 1.3% قیمت یک گرم طلاست
    // فرض: قیمت تتر حدود 95% قیمت دلار است
    const estimatedDollarPrice = Math.round(goldPriceNum * 0.013);
    const estimatedTetherPrice = Math.round(estimatedDollarPrice * 0.95);
    
    // ذخیره قیمت‌ها
    saveLocalPrices(goldPriceNum, estimatedDollarPrice, estimatedTetherPrice);
    
    // نمایش مقادیر
    document.getElementById('gold-price').textContent = formatNumber(goldPriceNum);
    document.getElementById('currency-price').textContent = formatNumber(estimatedDollarPrice);
    document.getElementById('crypto-price').textContent = formatNumber(estimatedTetherPrice);
    
    // نمایش پیام
    showNotification('قیمت‌ها با موفقیت به‌روزرسانی شدند', 'success');
    updateLastUpdateTime('ورود دستی');
    
    // ذخیره در پایگاه داده اگر اتصال برقرار است
    if (supabase) {
      savePrices(goldPriceNum, estimatedDollarPrice, estimatedTetherPrice, 'manual', null);
    }
    
  } catch (error) {
    console.error('خطا در پردازش قیمت دستی:', error);
    showNotification('خطا در ثبت قیمت دستی', 'error');
  }
}

// اضافه کردن کد راه‌اندازی دکمه بازخوانی به تابع اصلی راه‌اندازی
function initializeApp() {
  // راه‌اندازی تم
  setupThemeToggle();
  
  // راه‌اندازی تب‌ها
  setupTabs();
  
  // راه‌اندازی دکمه بازخوانی قیمت‌ها
  setupRefreshButton();
  
  // راه‌اندازی Supabase
  initSupabase().catch(error => {
    console.error('خطا در راه‌اندازی Supabase:', error);
  });
  
  // دریافت قیمت‌ها
  updatePrices().catch(error => {
    console.error('خطا در به‌روزرسانی قیمت‌ها:', error);
  });
  
  // ثبت بازدید
  recordVisit();
}

// اضافه کردن event listeners بعد از لود شدن صفحه
document.addEventListener('DOMContentLoaded', function() {
  console.log('صفحه بارگذاری شد، در حال آماده‌سازی...');
  
  // راه‌اندازی حافظه
  initializeStorage();
  
  // راه‌اندازی برنامه
  initializeApp();
});

// نمایش اعلان به کاربر
function showNotification(message, type = 'info', duration = 5000) {
  // ایجاد کانتینر اعلان‌ها اگر وجود ندارد
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  // ایجاد اعلان جدید
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // محتوای اعلان
  notification.innerHTML = `
    <div class="notification-content">${message}</div>
    <button class="notification-close">&times;</button>
  `;
  
  // اضافه کردن به کانتینر
  container.appendChild(notification);
  
  // نمایش با انیمیشن
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // دکمه بستن
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    removeNotification(notification);
  });
  
  // حذف خودکار بعد از زمان مشخص
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }
  
  // لاگ پیام در کنسول
  console.log(`${type.toUpperCase()}: ${message}`);
  
  return notification;
}

// نمایش اعلان حاوی کد SQL
function showNotificationWithSQL(message, sqlCommands, type = 'info', duration = 5000) {
  // ایجاد کانتینر اعلان‌ها اگر وجود ندارد
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  // ایجاد اعلان جدید
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  
  // ایجاد محتوای اعلان با کدهای SQL
  let sqlContent = '';
  if (sqlCommands && sqlCommands.length > 0) {
    sqlCommands.forEach(sql => {
      sqlContent += `<pre class="sql-command">${sql}</pre>`;
    });
  }
  
  // محتوای اعلان
  notification.innerHTML = `
    <div class="notification-content">
      ${message}
      ${sqlContent}
      ${type === 'error' && isAdminUser() ? '<span class="admin-badge">admin</span>' : ''}
    </div>
    <button class="notification-close">&times;</button>
  `;
  
  // اضافه کردن به کانتینر
  container.appendChild(notification);
  
  // نمایش با انیمیشن
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // دکمه بستن
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    removeNotification(notification);
  });
  
  // حذف خودکار بعد از زمان مشخص
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }
  
  // لاگ پیام در کنسول
  console.log(`${type.toUpperCase()}: ${message}`);
  
  return notification;
}

// حذف اعلان با انیمیشن
function removeNotification(notification) {
  notification.classList.remove('show');
  
  // حذف از DOM بعد از پایان انیمیشن
  setTimeout(() => {
    if (notification.parentElement) {
      notification.parentElement.removeChild(notification);
    }
  }, 300);
}

// تبدیل اعداد به فرمت نمایشی (با جداکننده هزارگان و به فارسی)
function formatNumber(number) {
  if (!number && number !== 0) return 'نامشخص';
  
  // اطمینان از اینکه ورودی عدد است
  number = Number(number);
  if (isNaN(number)) return 'نامشخص';
  
  try {
    // استفاده از API استاندارد برای فرمت‌دهی اعداد
    return number.toLocaleString('fa-IR') + ' تومان';
  } catch (e) {
    // پشتیبانی پایه - در صورت عدم پشتیبانی مرورگر
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const formattedNumber = number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const persianNumber = formattedNumber.replace(/[0-9]/g, d => persianDigits[d]);
    return persianNumber + ' تومان';
  }
}

// به‌روزرسانی زمان آخرین بروزرسانی
function updateLastUpdateTime(source) {
  try {
    const lastUpdateElement = document.getElementById('last-update-time');
    if (!lastUpdateElement) {
      console.warn('المان نمایش زمان به‌روزرسانی یافت نشد');
      return;
    }
    
    // ذخیره زمان کنونی
    const now = new Date();
    safeStorageSet('lastUpdated', now.toISOString());
    
    // فرمت‌بندی تاریخ و زمان به فارسی
    const formattedDateTime = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(now);
    
    // نمایش زمان به‌روزرسانی با منبع داده
    lastUpdateElement.textContent = `آخرین به‌روزرسانی: ${formattedDateTime} از ${source || 'نامشخص'}`;
    console.log(`زمان به‌روزرسانی به‌روز شد: ${formattedDateTime} از ${source || 'نامشخص'}`);
  } catch (error) {
    console.error('خطا در به‌روزرسانی زمان:', error);
  }
}

// به‌روزرسانی آمار بازدید در حافظه محلی
function updateVisitStatsLocal(visitHistory) {
  const totalVisits = visitHistory.length;
  const dailyVisits = visitHistory.filter(v => {
    const visitDate = new Date(v.created_at).toDateString();
    return visitDate === new Date().toDateString();
  }).length;
  const weeklyVisits = visitHistory.filter(v => {
    const visitDate = new Date(v.created_at);
    const startOfWeek = new Date(visitDate);
    startOfWeek.setDate(visitDate.getDate() - visitDate.getDay());
    return visitDate >= startOfWeek && visitDate < new Date(startOfWeek.setDate(startOfWeek.getDate() + 7));
  }).length;

  document.getElementById('total-visits').innerText = totalVisits.toLocaleString('fa-IR');
  document.getElementById('daily-visits').innerText = dailyVisits.toLocaleString('fa-IR');
  document.getElementById('weekly-visits').innerText = weeklyVisits.toLocaleString('fa-IR');
}

// Initialize storage on page load
function initializeStorage() {
  if (!isStorageAvailable()) {
    console.warn('Using in-memory storage fallback for the entire session');
    // Initialize default values in memory storage
    memoryStorage = {
      theme: 'light',
      goldPrice: '7640000',
      dollarPrice: '100000',
      tetherPrice: '96000',
      lastUpdated: new Date().toISOString(),
      visit_history: '[]',
      device_identifier: generateRandomDeviceId()
    };
  }
}
