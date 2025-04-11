// دریافت قیمت‌ها از API
async function fetchPrices() {
    try {
      const options = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors'
      };

      const goldResponse = await fetch('https://alanchand.com/api/price-free?type=gold', options);
      const currencyResponse = await fetch('https://alanchand.com/api/price-free?type=currencies', options);
      const cryptoResponse = await fetch('https://alanchand.com/api/price-free?type=crypto', options);
  
      const goldData = await goldResponse.json();
      const currencyData = await currencyResponse.json();
      const cryptoData = await cryptoResponse.json();
  
      // نمایش قیمت‌ها
      document.getElementById('gold-price').innerText = `یک گرم طلای 18 عیار: ${goldData[0].sell} تومان`;
      document.getElementById('currency-price').innerText = `دلار آمریکا: ${currencyData[0].sell} تومان`;
      document.getElementById('crypto-price').innerText = `بیت کوین: ${cryptoData[0].toman} تومان`;
    } catch (error) {
      console.error('خطا در دریافت قیمت‌ها:', error);
      // Show friendly error message to users
      document.getElementById('gold-price').innerText = 'خطا در دریافت اطلاعات';
      document.getElementById('currency-price').innerText = 'خطا در دریافت اطلاعات';
      document.getElementById('crypto-price').innerText = 'خطا در دریافت اطلاعات';
    }
  }
  
  // محاسبه اجرت طلا
  document.getElementById('gold-form').addEventListener('submit', function (e) {
    e.preventDefault();
  
    const weight = parseFloat(document.getElementById('gold-weight').value);
    const wage = parseFloat(document.getElementById('gold-wage').value);
    const goldPrice = parseFloat(document.getElementById('gold-price').innerText.split(':')[1].replace('تومان', '').trim());
  
    const totalPrice = weight * (goldPrice + wage);
    document.getElementById('gold-result').innerText = `قیمت نهایی: ${totalPrice.toLocaleString()} تومان`;
  });
  
  // بارگذاری قیمت‌ها هنگام لود صفحه
  fetchPrices();