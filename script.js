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
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Set initial theme - default to light
    const savedTheme = localStorage.getItem('theme');
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
    return localStorage.getItem('userRole') === 'admin';
}

// دریافت یک شناسه منحصر به فرد برای دستگاه (جایگزین MAC Address)
async function getDeviceIdentifier() {
    let deviceId = localStorage.getItem('device_identifier');
    
    if (!deviceId) {
        // ایجاد یک شناسه منحصر به فرد با استفاده از برخی ویژگی‌های مرورگر
        const navigatorInfo = JSON.stringify({
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            pixelRatio: window.devicePixelRatio,
            colorDepth: window.screen.colorDepth
        });
        
        // ایجاد یک هش ساده از اطلاعات
        let hash = 0;
        for (let i = 0; i < navigatorInfo.length; i++) {
            const char = navigatorInfo.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        
        deviceId = Math.abs(hash).toString(16);
        localStorage.setItem('device_identifier', deviceId);
    }
    
    return deviceId;
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
            const visitHistory = JSON.parse(localStorage.getItem('visit_history')) || [];
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
        const visitHistory = JSON.parse(localStorage.getItem('visit_history')) || [];
        updateVisitStatsLocal(visitHistory);
    }
}

// ذخیره آخرین قیمت‌ها در دیتابیس
async function savePrices(gold, dollar, tether, source = 'manual', sourceUrl = window.location.href) {
    // بررسی وجود جداول
    const tablesExist = await createTablesIfNotExist();
    if (!tablesExist) {
        console.error('Cannot save prices - database tables do not exist');
        return {
            success: false,
            error: 'جداول مورد نیاز در دیتابیس وجود ندارند. لطفاً با مدیر سیستم تماس بگیرید.',
            sqlRequired: true
        };
    }

    // اعتبارسنجی داده‌ها
    if (isNaN(gold) || isNaN(dollar) || isNaN(tether)) {
        console.error('Invalid price values:', { gold, dollar, tether });
        return {
            success: false,
            error: 'مقادیر قیمت نامعتبر هستند. لطفاً اعداد معتبر وارد کنید.',
            sqlRequired: false
        };
    }

    try {
        // قیمت‌ها به اعداد صحیح تبدیل می‌شوند
        const goldValue = parseInt(gold);
        const dollarValue = parseInt(dollar);
        const tetherValue = parseInt(tether);

        // درج در دیتابیس
        const { data, error } = await supabase
            .from('prices')
            .insert([
                {
                    gold_price: goldValue,
                    dollar_price: dollarValue,
                    tether_price: tetherValue,
                    source: source,
                    source_url: sourceUrl
                }
            ]);

        if (error) {
            console.error('Error saving prices to database:', error);
            return {
                success: false,
                error: `خطا در ذخیره قیمت‌ها: ${error.message}`,
                sqlRequired: false
            };
        }

        console.log('Prices saved successfully:', { gold: goldValue, dollar: dollarValue, tether: tetherValue, source, sourceUrl });
        return {
            success: true,
            message: 'قیمت‌ها با موفقیت ذخیره شدند'
        };
    } catch (error) {
        console.error('Exception when saving prices:', error);
        return {
            success: false,
            error: `خطای سیستمی در ذخیره قیمت‌ها: ${error.message}`,
            sqlRequired: false
        };
    }
}

// دریافت قیمت‌های طلا از منابع مختلف
async function fetchPrices() {
    console.log('دریافت آخرین قیمت‌ها...');
    
    try {
        // ابتدا از API اصلی دریافت می‌کنیم
        const result = await tryAlanchandAPI();
        if (result) {
            console.log('قیمت‌ها با موفقیت از API دریافت شدند');
            updateLastUpdateTime(new Date());
            return true;
        }
        
        // اگر API اصلی پاسخ نداد، از وب‌سایت تلاش می‌کنیم
        console.log('تلاش برای دریافت از وب‌سایت...');
        const webResult = await tryFetchFromWebsite();
        if (webResult) {
            console.log('قیمت‌ها با موفقیت از وب‌سایت دریافت شدند');
            updateLastUpdateTime(new Date());
            return true;
        }
        
        // اگر هر دو روش قبلی ناموفق بود، از داده‌های محلی استفاده می‌کنیم
        console.log('تلاش برای استفاده از داده‌های محلی...');
        const localResult = await tryLocalData();
        if (localResult) {
            console.log('قیمت‌ها با موفقیت از داده‌های محلی دریافت شدند');
            const storedData = safeStorageGet('lastPrices');
            if (storedData) {
                try {
                    const parsedData = JSON.parse(storedData);
                    if (parsedData.last_updated) {
                        updateLastUpdateTime(new Date(parsedData.last_updated));
                    } else {
                        updateLastUpdateTime(new Date());
                    }
                } catch (error) {
                    console.error('خطا در پردازش تاریخ ذخیره شده:', error);
                    updateLastUpdateTime(new Date());
                }
            } else {
                updateLastUpdateTime(new Date());
            }
            return true;
        }
        
        console.error('خطا در دریافت قیمت‌ها از تمام منابع');
        showNotification('خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کنید.', 'error');
        return false;
    } catch (error) {
        console.error('خطا در دریافت قیمت‌ها:', error);
        showNotification(`خطا در دریافت قیمت‌ها: ${error.message}`, 'error');
        return false;
    }
}

// دریافت قیمت های قبلی از دیتابیس
async function tryDatabasePrices() {
    try {
        if (!supabase) return false;
        
        // دریافت آخرین قیمت‌های ذخیره شده
        const { data, error } = await supabase
            .from('prices')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) {
            console.error('Error fetching latest prices from DB:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            const latestPrices = data[0];
            
            // بررسی تازگی داده‌ها - اگر بیش از 6 ساعت از آخرین به‌روزرسانی گذشته باشد، داده‌ها قدیمی محسوب می‌شوند
            const lastUpdateTime = new Date(latestPrices.created_at);
            const currentTime = new Date();
            const hoursDifference = Math.abs(currentTime - lastUpdateTime) / 3600000; // تبدیل به ساعت
            const minutesDifference = Math.abs(currentTime - lastUpdateTime) / 60000; // تبدیل به دقیقه
            
            if (hoursDifference > 6) {
                console.log(`داده‌های دیتابیس قدیمی هستند (${Math.floor(hoursDifference)} ساعت گذشته).`);
                return false;
            }
            
            // ساخت آبجکت‌ها با ساختار مشابه API
            const goldData = { sell: latestPrices.gold_price };
            const currencyData = { sell: latestPrices.dollar_price };
            const cryptoData = { toman: latestPrices.tether_price };
            
            // ذخیره زمان برای نمایش در UI
            try {
                window.lastPriceUpdate = new Intl.DateTimeFormat('fa-IR', {
                    year: 'numeric',
                    month: 'numeric', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZone: 'Asia/Tehran'
                }).format(lastUpdateTime);
            } catch (e) {
                window.lastPriceUpdate = lastUpdateTime.toLocaleString('fa-IR');
            }
            
            updatePrices(goldData, currencyData, cryptoData);
            
            // نمایش پیام با تاکید بر اینکه داده‌ها از دیتابیس هستند و چقدر قدیمی هستند
            showNotification(`قیمت‌ها از دیتابیس (${Math.floor(minutesDifference)} دقیقه قبل) - منبع: ${latestPrices.source || 'نامشخص'}`, 'info');
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Exception fetching database prices:', error);
        return false;
    }
}

// حذف قیمت‌های قدیمی‌تر از 24 ساعت
async function cleanupOldPrices() {
    try {
        if (!supabase) return;
        
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        
        const { data, error } = await supabase
            .from('prices')
            .delete()
            .lt('created_at', yesterday.toISOString());
        
        if (error) {
            console.error('Error cleaning up old prices:', error);
        } else {
            console.log('Old prices cleaned up successfully');
        }
    } catch (error) {
        console.error('Exception cleaning up old prices:', error);
    }
}

// روش 1: استفاده از API تابلوخوان (در صورت فعال بودن CORS proxy)
async function tryTgjuAPI() {
    try {
        // بجای مقادیر ثابت، از اسکرپینگ استفاده می‌کنیم
        console.log('در حال تلاش برای دریافت قیمت‌ها از tgju.org با استفاده از اسکرپینگ...');
        return await tryTgjuScraping();
    } catch (error) {
        console.error('خطا در دریافت قیمت‌ها از tgju.org:', error);
        return false;
    }
}

// به‌روزرسانی تابع processTgjuData برای استفاده از ذخیره‌سازی امن
function processTgjuData(goldPrice, dollarPrice, tetherPrice) {
    // اعتبارسنجی قیمت‌ها
    if (isNaN(goldPrice) || isNaN(dollarPrice) || isNaN(tetherPrice)) {
        console.error('قیمت‌های استخراج شده نامعتبر هستند');
        return false;
    }
    
    // ذخیره زمان آخرین به‌روزرسانی برای نمایش در UI
    const now = new Date();
    
    // به‌روزرسانی زمان آخرین به‌روزرسانی
    updateLastUpdateTime(now);
    
    // ساخت آبجکت‌ها با ساختار مشابه API
    const goldData = { sell: goldPrice };
    const currencyData = { sell: dollarPrice };
    const cryptoData = { toman: tetherPrice };
    
    // ذخیره داده‌ها در localStorage برای استفاده بعدی
    const localData = {
        gold: goldPrice,
        dollar: dollarPrice,
        tether: tetherPrice,
        last_updated: now.toISOString()
    };
    safeStorageSet('lastPrices', JSON.stringify(localData));
    
    // آپدیت UI
    updatePrices(goldData, currencyData, cryptoData);
    
    // بررسی نیاز به ذخیره در دیتابیس (هر 5 دقیقه یک بار)
    checkAndSavePricesToDB(goldPrice, dollarPrice, tetherPrice, 'tgju', 'https://www.tgju.org');
    
    // نمایش اعلان با تاکید بر زنده بودن قیمت‌ها
    showNotification('قیمت‌های زنده از TGJU.org با موفقیت دریافت شدند ✓', 'success');
    
    return true;
}

// بررسی نیاز به ذخیره قیمت‌ها در دیتابیس
async function checkAndSavePricesToDB(goldPrice, dollarPrice, tetherPrice, source, sourceUrl) {
    try {
        if (!supabase) return;
        
        // بررسی آخرین قیمت ذخیره شده در دیتابیس
        const { data, error } = await supabase
            .from('prices')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (error) {
            console.error('Error checking latest price in DB:', error);
            return;
        }
        
        let shouldSave = true;
        
        if (data && data.length > 0) {
            const lastSaveTime = new Date(data[0].created_at);
            const now = new Date();
            const minutesDifference = Math.abs(now - lastSaveTime) / 60000; // تبدیل به دقیقه
            
            // اگر کمتر از 5 دقیقه از آخرین ذخیره گذشته باشد، نیازی به ذخیره مجدد نیست
            if (minutesDifference < 5) {
                console.log(`آخرین ذخیره قیمت‌ها ${Math.floor(minutesDifference)} دقیقه پیش بوده، نیازی به ذخیره مجدد نیست.`);
                shouldSave = false;
            }
        }
        
        if (shouldSave) {
            console.log('ذخیره قیمت‌های جدید در دیتابیس...');
            const result = await savePrices(goldPrice, dollarPrice, tetherPrice, source, sourceUrl);
            
            if (result.success) {
                console.log('قیمت‌ها با موفقیت در دیتابیس ذخیره شدند.');
                // پاکسازی داده‌های قدیمی
                await cleanupOldPrices();
            } else {
                console.error('خطا در ذخیره قیمت‌ها در دیتابیس:', result.error);
            }
        }
    } catch (error) {
        console.error('Exception checking/saving prices to DB:', error);
    }
}

// تنظیم به‌روزرسانی خودکار
function setupAutoRefresh() {
    // دریافت دکمه بازخوانی قیمت‌ها
    const refreshButton = document.getElementById('refresh-prices');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            showNotification('در حال بازخوانی قیمت‌ها...', 'info');
            const success = await fetchPrices();
            if (success) {
                showNotification('قیمت‌ها با موفقیت بازخوانی شدند', 'success');
            } else {
                showNotification('خطا در بازخوانی قیمت‌ها', 'error');
            }
        });
    }
    
    // دریافت اولیه قیمت‌ها هنگام بارگذاری صفحه
    fetchPrices();
}

// به‌روزرسانی قیمت‌ها در المان‌های HTML
function updatePrices(goldPrice, dollarPrice, tetherPrice, isFallback = false) {
    try {
        // به‌روزرسانی قیمت طلا
        const goldElement = document.getElementById('gold-price');
        if (goldElement) {
            goldElement.textContent = goldPrice.toLocaleString('fa-IR') + ' تومان';
        }

        // به‌روزرسانی قیمت دلار
        const dollarElement = document.getElementById('dollar-price');
        if (dollarElement) {
            dollarElement.textContent = dollarPrice.toLocaleString('fa-IR') + ' تومان';
        }

        // به‌روزرسانی قیمت تتر
        const tetherElement = document.getElementById('tether-price');
        if (tetherElement) {
            tetherElement.textContent = tetherPrice.toLocaleString('fa-IR') + ' تومان';
        }

        // نمایش منبع داده‌ها (در صورت استفاده از داده‌های پشتیبان)
        if (isFallback) {
            showNotification('استفاده از داده‌های پشتیبان به دلیل عدم دسترسی به سرور', 'info');
        }

        // صدا زدن تابع به‌روزرسانی زمان
        updateLastUpdateTime(new Date());
        
        // ذخیره‌سازی قیمت‌ها در localStorage
        const pricesData = {
            gold_price: goldPrice,
            dollar_price: dollarPrice,
            tether_price: tetherPrice,
            last_updated: new Date().toISOString()
        };
        
        safeStorageSet('lastPrices', JSON.stringify(pricesData));
        console.log('قیمت‌ها با موفقیت به‌روزرسانی شدند');

        return true;
    } catch (error) {
        console.error('خطا در به‌روزرسانی قیمت‌ها:', error);
        showNotification('خطا در به‌روزرسانی قیمت‌ها', 'error');
        return false;
    }
}

// نمایش آخرین زمان بروزرسانی قیمت‌ها
function updateLastUpdateTime(date) {
    const lastUpdateElement = document.getElementById('last-update-time');
    if (lastUpdateElement) {
        // تبدیل به فرمت تاریخ فارسی با استفاده از DateTimeFormat
        const formatter = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const formattedDate = formatter.format(date);
        lastUpdateElement.textContent = `آخرین بروزرسانی: ${formattedDate}`;
        
        // ذخیره زمان به‌روزرسانی در حافظه محلی
        const pricesData = safeStorageGet('lastPrices');
        if (pricesData) {
            try {
                const data = JSON.parse(pricesData);
                data.last_updated = date.toISOString();
                safeStorageSet('lastPrices', JSON.stringify(data));
            } catch (error) {
                console.error('خطا در ذخیره زمان به‌روزرسانی:', error);
            }
        }
    }
}

// استخراج قیمت‌ها از سایت tgju.org
async function tryTgjuScraping() {
  try {
    console.log('در حال دریافت داده‌ها از سایت tgju.org...');
    
    // استفاده از CORS Proxy یا درخواست مستقیم به سایت (بسته به تنظیمات سرور)
    const response = await fetch('https://www.tgju.org', {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`خطا در دریافت داده از tgju.org: ${response.status} ${response.statusText}`);
      return false;
    }
    
    // خواندن محتوای HTML صفحه
    const html = await response.text();
    console.log('داده‌های HTML از tgju.org دریافت شد');
    
    // استخراج قیمت‌ها با استفاده از regex - اطلاعات از info-bar در صفحه اصلی tgju.org
    // استخراج قیمت طلای 18 عیار (با ID: mesghal_price یا geram18_price)
    const goldPriceRegex = /id="(?:mesghal_price|geram18_price)"[^>]*>\s*<[\w\s"=-]*>([۰-۹,]+)/;
    const goldMatch = html.match(goldPriceRegex);
    
    // استخراج قیمت دلار (با ID: price_dollar_rl)
    const dollarPriceRegex = /id="(?:price_dollar_rl)"[^>]*>\s*<[\w\s"=-]*>([۰-۹,]+)/;
    const dollarMatch = html.match(dollarPriceRegex);
    
    // استخراج قیمت تتر (با ID: crypto-usdt یا p-tether-rl)
    const tetherPriceRegex = /id="(?:crypto-usdt|p-tether-rl)"[^>]*>\s*<[\w\s"=-]*>([۰-۹,]+)/;
    const tetherMatch = html.match(tetherPriceRegex);
    
    // اگر الگوهای فوق با محتوای سایت تطابق نداشت، از الگوی جایگزین استفاده کنیم
    // جستجو در کل HTML برای یافتن مقادیر قیمت در متن‌های مرتبط
    const fallbackGoldRegex = /(?:طلا|طلای ۱۸|طلای 18)[^0-9۰-۹]+([\d۰-۹,]+)/;
    const fallbackDollarRegex = /(?:دلار|دلار آمریکا)[^0-9۰-۹]+([\d۰-۹,]+)/;
    const fallbackTetherRegex = /(?:تتر|تترUSDT)[^0-9۰-۹]+([\d۰-۹,]+)/;
    
    // استخراج قیمت‌ها با استفاده از الگوهای اصلی یا جایگزین
    let goldPriceStr = goldMatch ? goldMatch[1] : null;
    if (!goldPriceStr) {
      const fallbackMatch = html.match(fallbackGoldRegex);
      goldPriceStr = fallbackMatch ? fallbackMatch[1] : null;
    }
    
    let dollarPriceStr = dollarMatch ? dollarMatch[1] : null;
    if (!dollarPriceStr) {
      const fallbackMatch = html.match(fallbackDollarRegex);
      dollarPriceStr = fallbackMatch ? fallbackMatch[1] : null;
    }
    
    let tetherPriceStr = tetherMatch ? tetherMatch[1] : null;
    if (!tetherPriceStr) {
      const fallbackMatch = html.match(fallbackTetherRegex);
      tetherPriceStr = fallbackMatch ? fallbackMatch[1] : null;
    }
    
    // بررسی وجود داده‌های استخراج شده
    if (!goldPriceStr || !dollarPriceStr || !tetherPriceStr) {
      console.error('مشکل در استخراج قیمت‌ها از tgju.org:', { 
        goldFound: !!goldPriceStr, 
        dollarFound: !!dollarPriceStr, 
        tetherFound: !!tetherPriceStr 
      });
      return false;
    }
    
    // تبدیل اعداد فارسی به انگلیسی و حذف کاما
    const toEnglishDigits = str => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g, '');
    
    // تبدیل به عدد
    const goldPrice = parseInt(toEnglishDigits(goldPriceStr)) / 10; // تبدیل از ریال به تومان
    const dollarPrice = parseInt(toEnglishDigits(dollarPriceStr)) / 10; // تبدیل از ریال به تومان
    const tetherPrice = parseInt(toEnglishDigits(tetherPriceStr)) / 10; // تبدیل از ریال به تومان
    
    console.log('داده‌های استخراج شده از tgju.org:', {
      'طلای 18 عیار (تومان)': goldPrice,
      'دلار (تومان)': dollarPrice,
      'تتر (تومان)': tetherPrice
    });
    
    // پردازش داده‌های دریافتی
    return processTgjuData(goldPrice, dollarPrice, tetherPrice);
  } catch (error) {
    console.error('خطا در استخراج قیمت‌ها از tgju.org:', error);
    return false;
  }
}

// استفاده از Alan Chand API
async function tryAlanchandAPI() {
  try {
    console.log('در حال دریافت داده‌ها از Alan Chand API...');
    
    // دریافت قیمت طلا
    const goldResponse = await fetch('https://alanchand.com/api/gold');
    if (!goldResponse.ok) {
      console.error(`خطا در دریافت قیمت طلا: ${goldResponse.status}`);
      return false;
    }
    const goldData = await goldResponse.json();
    
    // دریافت قیمت ارزها
    const currencyResponse = await fetch('https://alanchand.com/api/currency');
    if (!currencyResponse.ok) {
      console.error(`خطا در دریافت قیمت ارز: ${currencyResponse.status}`);
      return false;
    }
    const currencyData = await currencyResponse.json();
    
    // دریافت قیمت ارزهای دیجیتال
    const cryptoResponse = await fetch('https://alanchand.com/api/crypto-currency');
    if (!cryptoResponse.ok) {
      console.error(`خطا در دریافت قیمت ارز دیجیتال: ${cryptoResponse.status}`);
      return false;
    }
    const cryptoData = await cryptoResponse.json();
    
    // بررسی وجود داده‌های مورد نیاز
    if (!goldData.data || !goldData.data.geram18 || 
        !currencyData.data || !currencyData.data.dollar || 
        !cryptoData.data || !cryptoData.data.tether) {
      console.error('داده‌های دریافتی از Alan Chand API ناقص است');
      return false;
    }
    
    // استخراج قیمت‌ها
    let goldPrice = parseInt(goldData.data.geram18.sell);
    let dollarPrice = parseInt(currencyData.data.dollar.sell);
    let tetherPrice = parseInt(cryptoData.data.tether.toman);
    
    // تبدیل از ریال به تومان اگر قیمت‌ها بزرگتر از حد معقول باشند
    if (goldPrice > 10000000) { // اگر قیمت طلا بیش از 10 میلیون است، احتمالا در ریال است
      goldPrice = Math.round(goldPrice / 10);
    }
    
    if (dollarPrice > 1000000) { // اگر قیمت دلار بیش از 1 میلیون است، احتمالا در ریال است
      dollarPrice = Math.round(dollarPrice / 10);
    }
    
    if (tetherPrice > 1000000) { // اگر قیمت تتر بیش از 1 میلیون است، احتمالا در ریال است
      tetherPrice = Math.round(tetherPrice / 10);
    }
    
    console.log('داده‌های دریافتی از Alan Chand API:', {
      'طلای 18 عیار (تومان)': goldPrice,
      'دلار (تومان)': dollarPrice,
      'تتر (تومان)': tetherPrice
    });
    
    // ساخت آبجکت‌ها با ساختار مشابه API اصلی
    const goldObj = { sell: goldPrice };
    const currencyObj = { sell: dollarPrice };
    const cryptoObj = { toman: tetherPrice };
    
    // به‌روزرسانی زمان آخرین به‌روزرسانی
    updateLastUpdateTime(new Date());
    
    // آپدیت UI
    updatePrices(goldObj, currencyObj, cryptoObj);
    
    // ذخیره در دیتابیس
    checkAndSavePricesToDB(goldPrice, dollarPrice, tetherPrice, 'alanchand', 'https://alanchand.com');
    
    // نمایش اعلان
    showNotification('قیمت‌های زنده از Alan Chand API با موفقیت دریافت شدند ✓', 'success');
    
    return true;
  } catch (error) {
    console.error('خطا در دریافت قیمت‌ها از Alan Chand API:', error);
    return false;
  }
}

// متغیر برای ذخیره داده‌ها در حافظه در صورتی که localStorage در دسترس نباشد
let memoryStorage = {
  lastPrices: null,
  lastUpdateTimestamp: null,
  theme: null,
  visit_history: []
};

// ذخیره داده با پشتیبانی از localStorage یا حافظه موقت
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`خطا در ذخیره داده در localStorage (${key}):`, error);
    // ذخیره در حافظه موقت به جای localStorage
    memoryStorage[key] = value;
  }
}

// بازیابی داده با پشتیبانی از localStorage یا حافظه موقت
function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`خطا در بازیابی داده از localStorage (${key}):`, error);
    // بازیابی از حافظه موقت
    return memoryStorage[key];
  }
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

// به‌روزرسانی تابع recordVisit برای استفاده از ذخیره‌سازی امن
function recordVisit() {
  try {
    const now = new Date();
    const visit = {
      timestamp: now.toISOString(),
      url: window.location.href,
      referrer: document.referrer || 'direct'
    };
    
    // خواندن تاریخچه بازدیدهای قبلی
    let visits = [];
    const savedVisits = safeStorageGet('visit_history');
    if (savedVisits) {
      try {
        visits = JSON.parse(savedVisits);
        // اطمینان از اینکه visits یک آرایه است
        if (!Array.isArray(visits)) {
          visits = [];
        }
      } catch (e) {
        console.error('خطا در تجزیه تاریخچه بازدیدها:', e);
        visits = [];
      }
    }
    
    // اضافه کردن بازدید جدید به لیست
    visits.push(visit);
    
    // محدود کردن تعداد بازدیدهای ذخیره شده (مثلاً 20 مورد آخر)
    if (visits.length > 20) {
      visits = visits.slice(visits.length - 20);
    }
    
    // ذخیره تاریخچه به‌روزرسانی شده
    safeStorageSet('visit_history', JSON.stringify(visits));
    
  } catch (error) {
    console.warn('خطا در ثبت بازدید:', error);
  }
}

// دکمه بازخوانی قیمت‌ها
function setupRefreshButton() {
    const refreshButton = document.getElementById('refresh-prices-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            showNotification('در حال بازخوانی قیمت‌ها...', 'info');
            // پاک کردن localStorage برای مطمئن شدن از دریافت داده‌های جدید
            localStorage.removeItem('lastPrices');
            // فراخوانی مجدد تابع اصلی دریافت قیمت‌ها
            fetchPrices();
        });
    }
}