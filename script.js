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

// دریافت قیمت‌های طلا از منابع مختلف
async function fetchPrices() {
    try {
        // روش 1: استفاده از API تابلوخوان (tgju.org - اولویت اول)
        console.log('در حال تلاش برای دریافت قیمت‌ها از tgju.org...');
        const tgjuSuccess = await tryTgjuAPI();
        if (tgjuSuccess) {
            localStorage.setItem('last_price_check', new Date().getTime().toString());
            return;
        }
        
        // روش 2: استفاده از API آلن چند (اولویت دوم)
        console.log('tgju.org ناموفق بود، در حال تلاش برای دریافت از API آلن چند...');
        const alanchandSuccess = await tryAlanchandAPI();
        if (alanchandSuccess) {
            localStorage.setItem('last_price_check', new Date().getTime().toString());
            return;
        }
        
        // روش 3: استفاده از داده‌های ذخیره شده در localStorage
        console.log('API ها ناموفق بودند، در حال بررسی داده‌های حافظه موقت...');
        const localStorageSuccess = await tryLocalStorageData();
        if (localStorageSuccess) {
            return;
        }
        
        // روش 4: استفاده از فایل محلی JSON
        console.log('حافظه موقت ناموفق بود، در حال استفاده از فایل محلی...');
        const localDataSuccess = await tryLocalData();
        if (localDataSuccess) {
            // بررسی تازگی داده‌های محلی
            try {
                const response = await fetch('./prices.json?' + new Date().getTime());
                const data = await response.json();
                
                if (data.lastUpdated) {
                    const lastUpdateTime = new Date(data.lastUpdated);
                    const minutesDifference = Math.abs(new Date() - lastUpdateTime) / 60000; // تبدیل به دقیقه
                    
                    // اگر بیش از 10 دقیقه از آخرین به‌روزرسانی گذشته باشد، اعلان نمایش داده شود
                    if (minutesDifference > 10) {
                        const lastUpdateDisplay = data.lastUpdate || lastUpdateTime.toLocaleString('fa-IR');
                        showNotification(`قیمت‌ها قدیمی هستند (${Math.floor(minutesDifference)} دقیقه قبل). لطفاً قیمت روز را وارد کنید.`, 'warning');
                        showManualPriceInput();
                    }
                }
            } catch (e) {
                console.error('خطا در بررسی تازگی داده‌های محلی:', e);
            }
            
            return;
        }
        
        // اگر هیچ کدام از روش‌ها موفق نبود، نمایش ورودی دستی
        console.log('هیچ یک از روش‌های دریافت قیمت موفق نبود.');
        showError('امکان دریافت قیمت‌های زنده وجود ندارد. لطفاً قیمت طلا را به صورت دستی وارد کنید');
        showManualPriceInput();
        formatNumberInputs();
    } catch (error) {
        console.error('خطا در دریافت قیمت‌ها:', error);
        showError('قیمت‌های زنده در دسترس نیستند. لطفاً قیمت طلا را به صورت دستی وارد کنید');
        showManualPriceInput();
        formatNumberInputs();
    }
}

// استفاده از داده‌های ذخیره شده در localStorage
async function tryLocalStorageData() {
    const cachedGold = localStorage.getItem('tgju_last_gold');
    const cachedDollar = localStorage.getItem('tgju_last_dollar');
    const cachedTether = localStorage.getItem('tgju_last_tether');
    const lastUpdate = localStorage.getItem('tgju_last_update');
    
    if (cachedGold && cachedDollar && cachedTether && lastUpdate) {
        console.log('استفاده از داده‌های cached در localStorage');
        
        // بررسی تازگی داده‌ها - اگر بیش از 10 دقیقه از آخرین به‌روزرسانی گذشته باشد، داده‌ها قدیمی محسوب می‌شوند
        const lastUpdateTime = new Date(lastUpdate);
        const currentTime = new Date();
        const minutesDifference = Math.abs(currentTime - lastUpdateTime) / 60000; // تبدیل به دقیقه
        
        if (minutesDifference > 10) {
            console.log(`داده‌های localStorage قدیمی هستند (${Math.floor(minutesDifference)} دقیقه گذشته). نیاز به به‌روزرسانی دارند.`);
            return false;
        }
        
        const goldData = { sell: parseFloat(cachedGold) };
        const currencyData = { sell: parseFloat(cachedDollar) };
        const cryptoData = { toman: parseFloat(cachedTether) };
        
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
        
        // نمایش پیام با تاکید بر اینکه داده‌ها از حافظه موقت هستند
        showNotification(`قیمت‌ها از حافظه موقت (${Math.floor(minutesDifference)} دقیقه قبل)`, 'cache');
        
        return true;
    }
    
    return false;
}

// روش 1: استفاده از API تابلوخوان (در صورت فعال بودن CORS proxy)
async function tryTgjuAPI() {
    try {
        // لیست پروکسی‌های CORS رایگان (چند مورد برای تلاش)
        const corsProxies = [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?'
        ];
        
        // انتخاب یک پروکسی به صورت تصادفی
        const randomProxy = corsProxies[Math.floor(Math.random() * corsProxies.length)];
        
        // آدرس اصلی tgju برای دریافت همه قیمت‌ها در یک درخواست
        const tgjuMainUrl = encodeURIComponent('https://www.tgju.org');
        
        // دریافت HTML صفحه اصلی
        const response = await fetch(`${randomProxy}${tgjuMainUrl}`);
        const html = await response.text();
        
        // استخراج قیمت‌ها با استفاده از regex برای هر کدام از بخش‌ها
        
        // قیمت طلای 18 عیار - ID: l-geram18
        const goldRegex = /<li id="l-geram18"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
        const goldMatch = html.match(goldRegex);
        
        // قیمت دلار - ID: l-price_dollar_rl
        const dollarRegex = /<li id="l-price_dollar_rl"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
        const dollarMatch = html.match(dollarRegex);
        
        // قیمت تتر - ID: l-crypto-tether-irr
        const tetherRegex = /<li id="l-crypto-tether-irr"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
        const tetherMatch = html.match(tetherRegex);
        
        // بررسی وجود همه داده‌های مورد نیاز
        if (!goldMatch || !dollarMatch || !tetherMatch) {
            console.log('داده‌های مورد نیاز از tgju استخراج نشد:', { 
                goldFound: !!goldMatch, 
                dollarFound: !!dollarMatch, 
                tetherFound: !!tetherMatch 
            });
            return false;
        }
        
        // تبدیل مقادیر رشته‌ای به عدد (حذف کاما)
        // توجه: قیمت‌ها در وبسایت به ریال هستند، تبدیل به تومان با تقسیم بر 10
        const goldPrice = parseInt(goldMatch[1].replace(/,/g, '')) / 10;
        const dollarPrice = parseInt(dollarMatch[1].replace(/,/g, '')) / 10;
        const tetherPrice = parseInt(tetherMatch[1].replace(/,/g, '')) / 10;
        
        console.log('داده‌های استخراج شده از tgju:', {
            'طلای 18 عیار (تومان)': goldPrice,
            'دلار (تومان)': dollarPrice,
            'تتر (تومان)': tetherPrice
        });
        
        // ذخیره زمان آخرین به‌روزرسانی برای نمایش در UI
        const now = new Date();
        try {
            window.lastPriceUpdate = new Intl.DateTimeFormat('fa-IR', {
                year: 'numeric',
                month: 'numeric', 
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                timeZone: 'Asia/Tehran'
            }).format(now);
        } catch (e) {
            window.lastPriceUpdate = now.toLocaleString('fa-IR');
        }
        
        // ساخت آبجکت‌ها با ساختار مشابه API آلن چند
        const goldData = { sell: goldPrice };
        const currencyData = { sell: dollarPrice };
        const cryptoData = { toman: tetherPrice }; // استفاده از تتر به جای بیت‌کوین
        
        // آپدیت UI
        updatePrices(goldData, currencyData, cryptoData);
        
        // ذخیره مقادیر برای استفاده بعدی (در صورت نیاز)
        localStorage.setItem('tgju_last_gold', goldPrice);
        localStorage.setItem('tgju_last_dollar', dollarPrice);
        localStorage.setItem('tgju_last_tether', tetherPrice);
        localStorage.setItem('tgju_last_update', now.toISOString());
        
        // نمایش اعلان با تاکید بر زنده بودن قیمت‌ها
        showNotification('قیمت‌های زنده از TGJU.org با موفقیت دریافت شدند ✓', 'success');
        
        return true;
    } catch (error) {
        console.error('خطا در دریافت از tgju:', error);
        return false;
    }
}

// روش 1: استفاده از API آلن چند (فعلی)
async function tryAlanchandAPI() {
    try {
        const options = {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        };

        const responses = await Promise.all([
            fetch('https://alanchand.com/api/price-free?type=gold', options),
            fetch('https://alanchand.com/api/price-free?type=currencies', options),
            fetch('https://alanchand.com/api/price-free?type=crypto', options)
        ]);

        const [goldData, currencyData, cryptoData] = await Promise.all(
            responses.map(res => res.json())
        );

        // بررسی صحت داده‌ها
        if (!goldData[0] || !goldData[0].sell || !currencyData[0] || !currencyData[0].sell || !cryptoData[0] || !cryptoData[0].toman) {
            console.log('داده‌های API آلن چند ناقص است.');
            return false;
        }
        
        // بررسی اینکه آیا قیمت‌ها در API آلن چند به ریال هستند یا تومان
        // اگر قیمت‌ها بزرگتر از یک میلیون باشند، احتمالاً به ریال هستند
        let goldPrice = goldData[0].sell;
        let dollarPrice = currencyData[0].sell;
        let tetherPrice = cryptoData[0].toman;
        
        // تبدیل به تومان اگر به ریال باشند (قیمت‌های خیلی بزرگ)
        if (goldPrice > 1000000) goldPrice = goldPrice / 10;
        if (dollarPrice > 100000) dollarPrice = dollarPrice / 10;
        if (tetherPrice > 100000) tetherPrice = tetherPrice / 10;
        
        console.log('داده‌های استخراج شده از API آلن چند:', {
            'طلای 18 عیار (تومان)': goldPrice,
            'دلار (تومان)': dollarPrice,
            'تتر/بیت‌کوین (تومان)': tetherPrice
        });
        
        // ذخیره زمان آخرین به‌روزرسانی برای نمایش در UI
        const now = new Date();
        try {
            window.lastPriceUpdate = new Intl.DateTimeFormat('fa-IR', {
                year: 'numeric',
                month: 'numeric', 
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                timeZone: 'Asia/Tehran'
            }).format(now);
        } catch (e) {
            window.lastPriceUpdate = now.toLocaleString('fa-IR');
        }
        
        // آپدیت داده‌ها با قیمت‌های تبدیل شده به تومان
        const adjustedGoldData = { ...goldData[0], sell: goldPrice };
        const adjustedCurrencyData = { ...currencyData[0], sell: dollarPrice };
        const adjustedCryptoData = { ...cryptoData[0], toman: tetherPrice };
        
        updatePrices(adjustedGoldData, adjustedCurrencyData, adjustedCryptoData);
        
        // نمایش اعلان با تاکید بر زنده بودن قیمت‌ها
        showNotification('قیمت‌های زنده از API آلن چند با موفقیت دریافت شدند ✓', 'success');
        
        return true;
    } catch (error) {
        console.error('خطا در دریافت از API آلن چند:', error);
        return false;
    }
}

// روش 3: استفاده از فایل محلی JSON
async function tryLocalData() {
    try {
        // دریافت فایل prices.json از مسیر نسبی
        const response = await fetch('./prices.json?' + new Date().getTime());
        const data = await response.json();
        
        // بررسی صحت داده‌ها
        if (!data.gold || !data.dollar || !data.tether || !data.lastUpdated) {
            console.log('داده‌های فایل محلی ناقص است.');
            return false;
        }
        
        console.log('داده‌های استخراج شده از فایل محلی:', {
            'طلای 18 عیار (تومان)': data.gold,
            'دلار (تومان)': data.dollar,
            'تتر (تومان)': data.tether
        });
        
        // بررسی تازگی داده‌ها - اگر بیش از 10 دقیقه از آخرین به‌روزرسانی گذشته باشد، داده‌ها قدیمی محسوب می‌شوند
        const lastUpdateTime = new Date(data.lastUpdated);
        const currentTime = new Date();
        const minutesDifference = Math.abs(currentTime - lastUpdateTime) / 60000; // تبدیل به دقیقه
        
        // ذخیره زمان آخرین به‌روزرسانی برای نمایش در UI
        window.lastPriceUpdate = data.lastUpdate || lastUpdateTime.toLocaleString('fa-IR');
        
        // ساخت آبجکت با ساختار مشابه API آلن چند
        // توجه: قیمت‌ها در فایل محلی به تومان ذخیره شده‌اند
        const goldData = { sell: data.gold };
        const currencyData = { sell: data.dollar };
        const cryptoData = { toman: data.tether };
        
        // آپدیت UI
        updatePrices(goldData, currencyData, cryptoData);
        
        // نمایش زمان آپدیت
        const lastUpdateDisplay = data.lastUpdate || lastUpdateTime.toLocaleString('fa-IR');
        
        // اگر داده‌ها قدیمی باشند (بیش از 10 دقیقه)، پیام مناسب نمایش داده شود و فیلد ورود دستی قیمت نمایش داده شود
        if (minutesDifference > 10) {
            showNotification(`قیمت‌ها قدیمی هستند (${Math.floor(minutesDifference)} دقیقه قبل). آخرین به‌روزرسانی: ${lastUpdateDisplay}`, 'warning');
            showManualPriceInput();
            formatNumberInputs();
        } else {
            // نمایش اعلان که قیمت‌ها از فایل محلی هستند
            showNotification(`قیمت‌ها از فایل محلی: ${lastUpdateDisplay}`, 'cache');
        }
        
        return true;
    } catch (error) {
        console.error('خطا در دریافت از فایل محلی:', error);
        return false;
    }
}

function updatePrices(gold, currency, crypto) {
    // Make sure we have valid data
    if (!gold || !gold.sell || !currency || !currency.sell || !crypto || !crypto.toman) {
        showError('داده‌های قیمت نامعتبر هستند. لطفاً قیمت طلا را به صورت دستی وارد کنید');
        showManualPriceInput();
        // Format the input field after showing it
        formatNumberInputs();
        return;
    }
    
    window.currentGoldPrice = gold.sell;
    
    // نمایش زمان آخرین به‌روزرسانی در بالای کارت‌های قیمت اگر وجود داشته باشد
    if (window.lastPriceUpdate) {
        const pricesSection = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
        if (pricesSection) {
            // حذف هر گونه اعلان قبلی زمان به‌روزرسانی
            const existingTimeInfo = document.getElementById('last-update-info');
            if (existingTimeInfo) {
                existingTimeInfo.remove();
            }
            
            // ایجاد المان جدید برای نمایش زمان به‌روزرسانی
            const timeInfo = document.createElement('div');
            timeInfo.id = 'last-update-info';
            timeInfo.className = 'text-center text-sm text-gray-600 dark:text-gray-400 mb-2';
            timeInfo.innerHTML = `<span>آخرین به‌روزرسانی: ${window.lastPriceUpdate}</span>`;
            
            // اضافه کردن به ابتدای بخش قیمت‌ها
            pricesSection.parentNode.insertBefore(timeInfo, pricesSection);
        }
    }
    
    document.getElementById('gold-price').innerText = `یک گرم طلای 18 عیار: ${gold.sell.toLocaleString('fa-IR')} تومان`;
    document.getElementById('currency-price').innerText = `دلار آمریکا: ${currency.sell.toLocaleString('fa-IR')} تومان`;
    document.getElementById('crypto-price').innerText = `تتر: ${crypto.toman.toLocaleString('fa-IR')} تومان`;
}

function showManualPriceInput() {
    const manualInput = document.getElementById('manual-price-input');
    manualInput.classList.remove('hidden');
    
    // تغییر متن توضیحات برای روشن‌تر کردن دلیل نیاز به ورودی دستی
    const description = document.querySelector('#manual-price-input p.text-sm');
    if (description) {
        description.innerHTML = 'قیمت‌های زنده در دسترس نیستند یا قدیمی هستند. لطفاً قیمت روز طلا را به تومان وارد کنید تا محاسبات دقیق انجام شود.';
        description.className = 'mt-2 text-sm text-yellow-600 dark:text-yellow-400 font-bold';
    }
    
    // ایجاد یک مقدار پیش‌فرض برای قیمت طلا
    if (!window.currentGoldPrice) {
        window.currentGoldPrice = 0;
    }
    
    // اطمینان از اعمال فرمت‌دهی با یک تأخیر کوتاه
    setTimeout(formatNumberInputs, 100);
}

// ماسک کردن اعداد با جداکننده هزارگان
function formatNumberInputs() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');

    inputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);

        newInput.addEventListener('input', function (e) {
            // کد مقدار قبلی برای جلوگیری از بازگشت کرسر به ابتدا
            const cursorPosition = e.target.selectionStart;
            const previousValue = e.target.value;
            
            // حذف کاراکترهای غیر عددی (پشتیبانی از اعداد فارسی و انگلیسی)
            let val = e.target.value.replace(/[^۰-۹0-9.]/g, ''); 
            
            // تبدیل اعداد فارسی به انگلیسی برای محاسبات
            let numeric = val.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
            
            // ذخیره مقدار عددی برای محاسبات بعدی
            e.target.dataset.numericValue = numeric;
            
            if (!numeric) {
                e.target.value = '';
                return;
            }

            // فرمت‌بندی با جداکننده هزارگان
            let parts = numeric.split('.');
            let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            
            // تبدیل به اعداد فارسی برای نمایش
            intPart = intPart.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
            
            if (parts.length > 1) {
                e.target.value = `${intPart}.${parts[1]}`;
            } else {
                e.target.value = intPart;
            }
            
            // آپدیت قیمت طلا در صورت نیاز
            if (e.target.id === 'manual-gold-price') {
                const price = parseFloat(numeric);
                if (!isNaN(price)) {
                    window.currentGoldPrice = price;
                    
                    // فرمت بهتر با اعداد فارسی
                    const formattedPrice = price.toLocaleString('fa-IR');
                    document.getElementById('gold-price').innerText = 
                        `یک گرم طلای 18 عیار: ${formattedPrice} تومان`;
                }
            }
            
            // حفظ موقعیت مکان‌نما تا حد ممکن
            if (cursorPosition) {
                try {
                    // تعیین جابجایی موقعیت مکان‌نما بر اساس تغییر طول متن
                    const posDiff = e.target.value.length - previousValue.length;
                    const newPosition = Math.min(cursorPosition + posDiff, e.target.value.length);
                    e.target.setSelectionRange(newPosition, newPosition);
                } catch (err) {
                    // برخی ورودی‌ها از setSelectionRange پشتیبانی نمی‌کنند
                }
            }
        });
    });
}

// محاسبه فرم‌ها
function setupCalculator() {
    // از بین بردن disabled از همه ورودی‌ها
    const formFields = document.querySelectorAll('input');
    formFields.forEach(field => {
        if (field.disabled) {
            field.disabled = false;
        }
    });

    // فرم محاسبه مبلغ و درصد اجرت
    document.getElementById('wage-calculator-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const sellerPriceInput = document.getElementById('seller-price');
        const weightInput = document.getElementById('gold-weight-wage');
        
        // استخراج مقادیر عددی از ورودی‌های فرمت شده
        let sellerPrice = sellerPriceInput.dataset.numericValue ? 
            parseFloat(sellerPriceInput.dataset.numericValue) : 
            parseFloat(sellerPriceInput.value.replace(/[^0-9.]/g, ''));
            
        let weight = weightInput.dataset.numericValue ? 
            parseFloat(weightInput.dataset.numericValue) : 
            parseFloat(weightInput.value.replace(/[^0-9.]/g, ''));
            
        const goldPrice = window.currentGoldPrice || 0;

        // گزارش مقادیر برای رفع اشکال
        console.log('محاسبه اجرت:', {
            'قیمت فروشنده': sellerPrice,
            'وزن': weight,
            'قیمت طلا': goldPrice,
            'منبع قیمت فروشنده': sellerPriceInput.dataset.numericValue ? 'dataset' : 'مستقیم',
            'منبع وزن': weightInput.dataset.numericValue ? 'dataset' : 'مستقیم',
            'ورودی اولیه قیمت': sellerPriceInput.value,
            'ورودی اولیه وزن': weightInput.value
        });

        // اطمینان از وجود مقادیر معتبر
        sellerPrice = isNaN(sellerPrice) ? 0 : sellerPrice;
        weight = isNaN(weight) ? 0 : weight;

        // محاسبه قیمت و اجرت
        const rawPrice = weight * goldPrice;
        const wageAmount = sellerPrice - rawPrice;
        const wagePercentage = rawPrice > 0 ? (wageAmount / rawPrice) * 100 : 0;

        document.getElementById('wage-result').innerHTML = `
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                <p class="text-base text-gray-600 dark:text-gray-400">قیمت طلای خام: <span class="font-bold">${rawPrice.toLocaleString('fa-IR')}</span> تومان</p>
                <p class="text-base text-gray-600 dark:text-gray-400">مبلغ اجرت: <span class="font-bold">${wageAmount.toLocaleString('fa-IR')}</span> تومان</p>
                <p class="text-base text-gray-600 dark:text-gray-400">درصد اجرت: <span class="font-bold">${wagePercentage.toFixed(2)}%</span></p>
            </div>
        `;
    });

    // فرم محاسبه قیمت تمام‌شده
    document.getElementById('final-calculator-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const weightInput = document.getElementById('gold-weight-final');
        const wagePercentageInput = document.getElementById('wage-percentage-final');
        
        // استخراج مقادیر عددی از ورودی‌های فرمت شده
        let weight = weightInput.dataset.numericValue ? 
            parseFloat(weightInput.dataset.numericValue) : 
            parseFloat(weightInput.value.replace(/[^0-9.]/g, ''));
            
        let wagePercentage = wagePercentageInput.dataset.numericValue ? 
            parseFloat(wagePercentageInput.dataset.numericValue) : 
            parseFloat(wagePercentageInput.value.replace(/[^0-9.]/g, ''));
            
        const goldPrice = window.currentGoldPrice || 0;

        // گزارش مقادیر برای رفع اشکال
        console.log('محاسبه قیمت تمام‌شده:', {
            'وزن': weight,
            'درصد اجرت': wagePercentage,
            'قیمت طلا': goldPrice,
            'منبع وزن': weightInput.dataset.numericValue ? 'dataset' : 'مستقیم',
            'منبع درصد': wagePercentageInput.dataset.numericValue ? 'dataset' : 'مستقیم',
            'ورودی اولیه وزن': weightInput.value,
            'ورودی اولیه درصد': wagePercentageInput.value
        });

        // اطمینان از وجود مقادیر معتبر
        weight = isNaN(weight) ? 0 : weight;
        wagePercentage = isNaN(wagePercentage) ? 0 : wagePercentage;

        // محاسبه قیمت
        const rawPrice = weight * goldPrice;
        const wageAmount = (rawPrice * wagePercentage) / 100;
        const totalPrice = rawPrice + wageAmount;

        document.getElementById('final-result').innerHTML = `
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
                <p class="text-base text-gray-600 dark:text-gray-400">قیمت طلای خام: <span class="font-bold">${rawPrice.toLocaleString('fa-IR')}</span> تومان</p>
                <p class="text-base text-gray-600 dark:text-gray-400">مبلغ اجرت: <span class="font-bold">${wageAmount.toLocaleString('fa-IR')}</span> تومان</p>
                <p class="text-lg font-bold text-green-600 dark:text-green-400">قیمت تمام‌شده: <span class="text-2xl">${totalPrice.toLocaleString('fa-IR')}</span> تومان</p>
            </div>
        `;
    });
}

// نمایش پیام خطا با طراحی جذاب
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-bounce';
    errorDiv.innerHTML = `
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
                <h4 class="font-bold text-lg mb-1">خطا</h4>
                <p>${message}</p>
            </div>
        </div>
    `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.style.opacity = '0';
        errorDiv.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            errorDiv.remove();
        }, 300);
    }, 4000);
}

// نمایش اعلان به کاربر
function showNotification(message, type = 'info') {
    const notifDiv = document.createElement('div');
    
    // تعیین رنگ پس‌زمینه بر اساس نوع اعلان
    let bgColor = 'bg-blue-500';
    let icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    
    if (type === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    } else if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else if (type === 'cache') {
        bgColor = 'bg-purple-500';
        icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
    
    notifDiv.className = `fixed bottom-4 left-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300`;
    notifDiv.innerHTML = `
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
            ${icon}
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(notifDiv);

    setTimeout(() => {
        notifDiv.style.opacity = '0';
        notifDiv.style.transform = 'translateY(20px)';
        setTimeout(() => {
            notifDiv.remove();
        }, 300);
    }, 5000);
}

// تنظیم زمان‌بندی برای به‌روزرسانی خودکار قیمت‌ها
function setupAutoRefresh() {
    // به‌روزرسانی هر 5 دقیقه (300000 میلی‌ثانیه)
    const refreshInterval = 300000;
    
    // تنظیم تایمر برای به‌روزرسانی خودکار
    setInterval(() => {
        console.log('در حال به‌روزرسانی خودکار قیمت‌ها...');
        fetchPrices();
    }, refreshInterval);
    
    // همچنین امکان به‌روزرسانی دستی برای کاربر
    const pricesSection = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
    if (pricesSection) {
        // افزودن دکمه برای به‌روزرسانی دستی
        const refreshButton = document.createElement('button');
        refreshButton.className = 'absolute top-2 right-2 p-2 text-gray-500 hover:text-blue-500 transition-colors';
        refreshButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        `;
        refreshButton.title = 'به‌روزرسانی قیمت‌ها';
        
        // اضافه کردن موقعیت نسبی به والد برای موقعیت‌دهی مطلق دکمه
        pricesSection.style.position = 'relative';
        
        // افزودن دکمه به بخش قیمت‌ها
        pricesSection.appendChild(refreshButton);
        
        // رویداد کلیک برای دکمه به‌روزرسانی
        refreshButton.addEventListener('click', () => {
            showNotification('در حال به‌روزرسانی قیمت‌ها...', 'info');
            fetchPrices();
        });
    }
}

// آمار بازدیدکنندگان سایت
function trackVisit() {
    try {
        // دریافت تاریخچه بازدیدها از localStorage
        let visitHistory = JSON.parse(localStorage.getItem('visit_history')) || [];
        const now = new Date();
        
        // ذخیره تاریخ و زمان بازدید فعلی
        visitHistory.push({
            timestamp: now.getTime(),
            date: now.toISOString().split('T')[0] // فقط تاریخ (YYYY-MM-DD)
        });
        
        // محدود کردن تعداد رکوردها به 1000 مورد برای جلوگیری از پر شدن حافظه
        if (visitHistory.length > 1000) {
            visitHistory = visitHistory.slice(-1000);
        }
        
        // ذخیره آرایه به‌روزرسانی شده
        localStorage.setItem('visit_history', JSON.stringify(visitHistory));
        
        // به‌روزرسانی آمار نمایش داده شده
        updateVisitStats(visitHistory);
    } catch (e) {
        console.error('خطا در ثبت بازدید:', e);
    }
}

// به‌روزرسانی آمار بازدید در UI
function updateVisitStats(visitHistory) {
    // اگر آرایه خالی است یا وجود ندارد
    if (!visitHistory || !visitHistory.length) {
        return;
    }
    
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);
    
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    // محاسبه آمار
    const totalVisits = visitHistory.length;
    
    const dailyVisits = visitHistory.filter(visit => {
        return new Date(visit.timestamp) >= oneDayAgo;
    }).length;
    
    const weeklyVisits = visitHistory.filter(visit => {
        return new Date(visit.timestamp) >= oneWeekAgo;
    }).length;
    
    // به‌روزرسانی المان‌ها در UI
    document.getElementById('total-visits').innerText = totalVisits.toLocaleString('fa-IR');
    document.getElementById('weekly-visits').innerText = weeklyVisits.toLocaleString('fa-IR');
    document.getElementById('daily-visits').innerText = dailyVisits.toLocaleString('fa-IR');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // اول تنظیمات پایه
    setupThemeToggle();
    setupCalculator();
    
    // اعمال فرمت‌دهی به ورودی‌ها
    formatNumberInputs();
    
    // دریافت قیمت‌ها از منابع مختلف
    fetchPrices();
    
    // تنظیم به‌روزرسانی خودکار
    setupAutoRefresh();
    
    // ثبت و نمایش آمار بازدید
    trackVisit();
});