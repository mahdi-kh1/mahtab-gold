// دریافت قیمت‌ها از API
async function fetchPrices() {
    try {
      const goldResponse = await fetch('https://alanchand.com/api/price-free?type=gold');
      const currencyResponse = await fetch('https://alanchand.com/api/price-free?type=currencies');
      const cryptoResponse = await fetch('https://alanchand.com/api/price-free?type=crypto');
  
      const goldData = await goldResponse.json();
      const currencyData = await currencyResponse.json();
      const cryptoData = await cryptoResponse.json();
  
      // نمایش قیمت‌ها
      document.getElementById('gold-price').innerText = `یک گرم طلای 18 عیار: ${goldData[0].sell} تومان`;
      document.getElementById('currency-price').innerText = `دلار آمریکا: ${currencyData[0].sell} تومان`;
      document.getElementById('crypto-price').innerText = `بیت کوین: ${cryptoData[0].toman} تومان`;
    } catch (error) {
      console.error('خطا در دریافت قیمت‌ها:', error);
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