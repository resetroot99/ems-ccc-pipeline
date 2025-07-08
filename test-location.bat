@echo off
echo ===============================================
echo    EMS Pipeline - Location Tracking Test
echo ===============================================
echo.

echo Testing location configuration...
node -e "
const config = require('./config');
console.log('Shop Name:', config.location.shopName);
console.log('Shop ID:', config.location.shopId);
console.log('Computer:', config.location.computerName);
console.log('Region:', config.location.region);
console.log('Address:', config.location.address || '(not set)');
console.log('Timezone:', config.location.timezone);
console.log('');
console.log('✅ Location configuration loaded successfully');
"

echo.
echo Testing database connection...
npm run status

echo.
echo ===============================================
echo Location tracking test complete!
echo.
echo All estimates will now be tagged with:
echo - Shop identification
echo - Computer name  
echo - Geographic region
echo - Processing location
echo.
echo This enables multi-location analytics in your
echo RAG/AI system!
echo ===============================================
pause 