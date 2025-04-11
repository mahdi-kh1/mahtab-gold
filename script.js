// Theme Toggle
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    // Set initial theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
    }

    themeToggleBtn.addEventListener('click', function() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.theme = isDark ? 'dark' : 'light';
        darkIcon.classList.toggle('hidden');
        lightIcon.classList.toggle('hidden');
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

// Fetch and Display Prices
async function fetchPrices() {
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

        updatePrices(goldData[0], currencyData[0], cryptoData[0]);
    } catch (error) {
        console.error('Error fetching prices:', error);
        showManualPriceInput();
    }
}

function updatePrices(gold, currency, crypto) {
    document.getElementById('gold-price').innerText = `یک گرم طلای 18 عیار: ${gold.sell.toLocaleString()} تومان`;
    document.getElementById('currency-price').innerText = `دلار آمریکا: ${currency.sell.toLocaleString()} تومان`;
    document.getElementById('crypto-price').innerText = `بیت کوین: ${crypto.toman.toLocaleString()} تومان`;
    
    // Store gold price for calculations
    window.currentGoldPrice = gold.sell;
}

function showManualPriceInput() {
    document.getElementById('manual-price-input').classList.remove('hidden');
    document.getElementById('manual-gold-price').addEventListener('change', (e) => {
        window.currentGoldPrice = parseFloat(e.target.value);
    });
}

// Calculator Logic
function setupCalculator() {
    document.getElementById('gold-calculator-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const weight = parseFloat(document.getElementById('gold-weight').value);
        const wagePercentage = parseFloat(document.getElementById('wage-percentage').value);
        const wageFixed = parseFloat(document.getElementById('wage-fixed').value);
        
        if (!window.currentGoldPrice) {
            alert('لطفا قیمت طلا را وارد کنید');
            return;
        }

        const basePrice = weight * window.currentGoldPrice;
        const percentageWage = (basePrice * wagePercentage) / 100;
        const totalPrice = basePrice + percentageWage + wageFixed;

        document.getElementById('calculation-result').innerText = 
            `قیمت نهایی: ${totalPrice.toLocaleString()} تومان`;
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupTabs();
    setupCalculator();
    fetchPrices();
});