#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupLocation() {
  console.log('===============================================');
  console.log('    EMS Pipeline - Location Configuration');
  console.log('===============================================');
  console.log('');
  console.log('Please provide information about this location/shop:');
  console.log('(Press Enter to use default values)');
  console.log('');

  try {
    // Collect location information
    const shopName = await question('Shop Name (e.g., "Downtown Auto Body"): ') || 'Main Shop';
    const shopId = await question('Shop ID (e.g., "SHOP001", "DOWNTOWN"): ') || 'SHOP001';
    const address = await question('Shop Address (optional): ') || '';
    const region = await question('Region (e.g., "Northeast", "West Coast"): ') || '';
    const phone = await question('Shop Phone (optional): ') || '';
    const email = await question('Shop Email (optional): ') || '';
    const timezone = await question('Timezone (e.g., "America/New_York"): ') || 'America/New_York';

    console.log('');
    console.log('Configuration Summary:');
    console.log(`Shop Name: ${shopName}`);
    console.log(`Shop ID: ${shopId}`);
    console.log(`Address: ${address || '(not set)'}`);
    console.log(`Region: ${region || '(not set)'}`);
    console.log(`Phone: ${phone || '(not set)'}`);
    console.log(`Email: ${email || '(not set)'}`);
    console.log(`Timezone: ${timezone}`);
    console.log('');

    const confirm = await question('Save this configuration? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Configuration cancelled.');
      process.exit(0);
    }

    // Create .env file with location settings
    const envPath = path.join(process.cwd(), '.env');
    const envContent = `# EMS Pipeline Location Configuration
# Generated on ${new Date().toISOString()}

SHOP_NAME="${shopName}"
SHOP_ID="${shopId}"
SHOP_ADDRESS="${address}"
SHOP_REGION="${region}"
SHOP_PHONE="${phone}"
SHOP_EMAIL="${email}"
SHOP_TIMEZONE="${timezone}"
`;

    await fs.writeFile(envPath, envContent);
    
    console.log('');
    console.log('✅ Location configuration saved to .env file');
    console.log('');
    console.log('This installation will be identified as:');
    console.log(`  Shop: ${shopName} (${shopId})`);
    console.log(`  Computer: ${require('os').hostname()}`);
    console.log('');
    console.log('All estimates will be tagged with this location data.');

  } catch (error) {
    console.error('Error setting up location:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setupLocation();
}

module.exports = { setupLocation }; 