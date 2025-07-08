# Windows PC Deployment Guide

## 🎯 **Quick Installation**

### 1. Download the Repository
```
https://github.com/resetroot99/ems-ccc-pipeline
```
- Click **"Code"** → **"Download ZIP"**
- Extract to `C:\ems-ccc-pipeline\`

### 2. Install Node.js (if not installed)
- Download from: https://nodejs.org/
- Choose **LTS version** 
- Install with default settings

### 3. Run One-Click Installer
- Double-click `install.bat`
- Wait for installation to complete
- Database will be automatically configured

### 4. Configure CCC ONE
- Go to **Settings > Data Connections > EMS and Workfile Copy**
- Set export directory to: `C:\CCC_EMS_EXPORTS`
- Enable auto-export for estimates

### 5. Start the Service
- Double-click `start-service.bat`
- Keep the window open (pipeline runs in background)
- You'll see real-time processing logs

## 🔧 **Manual Installation (Alternative)**

If the automatic installer doesn't work:

```batch
# Navigate to project directory
cd C:\ems-ccc-pipeline

# Install dependencies
npm install

# Setup database
npm run setup

# Start monitoring
npm start
```

## 🚀 **Running as Background Service**

### Start Service
```batch
start-service.bat
```
or
```batch
npm start
```

### Stop Service
```batch
stop-service.bat
```
or press `Ctrl+C` in the service window

### Check Status
```batch
npm run status
```

## 📊 **Monitoring**

### Real-time Logs
- Service window shows live processing
- New files detected and processed automatically
- Upload status to Supabase database

### Log Files
- `logs\combined.log` - All activity
- `logs\error.log` - Errors only
- `processed\` - Successfully processed files
- `processed\errors\` - Failed files with error details

## ⚙️ **Configuration**

### Update Settings
Edit `config.js`:
```javascript
module.exports = {
  supabase: {
    url: 'https://sxzjbrcpowcfxhwycbob.supabase.co',
    // Your keys are already configured
  },
  
  ccc: {
    exportPath: 'C:/CCC_EMS_EXPORTS',    // CCC export folder
    processedPath: './processed',         // Processed files
    logsPath: './logs'                   // Log files
  }
};
```

### CCC ONE Export Settings
1. **Export Type**: EMS 2.01 Estimate
2. **Directory**: `C:\CCC_EMS_EXPORTS`
3. **Auto-export**: Enabled
4. **Triggers**: On estimate completion

## 🗂️ **File Processing Flow**

```
1. CCC ONE saves estimate → C:\CCC_EMS_EXPORTS\EST001.ems
2. Pipeline detects file  → Processes automatically  
3. Data extracted         → Uploaded to Supabase
4. Images processed       → OCR text extraction
5. File archived          → Moved to processed\
```

## 🔍 **Troubleshooting**

### Service Won't Start
1. Check Node.js is installed: `node --version`
2. Verify dependencies: `npm install`
3. Check config.js settings
4. Review error.log for details

### Files Not Processing
1. Verify CCC export path: `C:\CCC_EMS_EXPORTS`
2. Check folder permissions
3. Ensure CCC auto-export is enabled
4. Test with sample file: copy `examples\sample.ems` to export folder

### Database Connection Issues
1. Check Supabase project status
2. Verify internet connection
3. Test connection: `npm run status`
4. Check service key permissions

### High CPU/Memory Usage
1. Adjust batch size in config.js
2. Disable OCR if not needed
3. Monitor log file sizes
4. Restart service periodically

## 📈 **Performance Tips**

### Optimize for Large Volumes
- **Batch Size**: Reduce from 10 to 5 for slower PCs
- **OCR**: Disable if images aren't critical
- **Logging**: Set level to 'warn' or 'error' only
- **Cleanup**: Archive old logs and processed files regularly

### Maintenance
- **Daily**: Check service is running
- **Weekly**: Review error logs
- **Monthly**: Clean processed files
- **Quarterly**: Update dependencies with `npm update`

## 💾 **Data Access**

### Supabase Dashboard
- URL: https://sxzjbrcpowcfxhwycbob.supabase.co
- Tables: estimates, estimate_images, parts, etc.
- Real-time data updates

### Export Data
```sql
-- Export estimates for AI training
SELECT * FROM estimates 
WHERE created_at >= '2024-01-01'
ORDER BY created_at DESC;
```

## 🔒 **Security**

### Best Practices
- Keep `config.js` secure (contains API keys)
- Regular Supabase backups
- Monitor access logs
- Update Node.js regularly

### Backup Strategy
- **Database**: Supabase auto-backup enabled
- **Files**: `processed\` folder contains all original EMS files
- **Config**: Keep copy of `config.js` settings

## 🆘 **Support**

### Common Commands
```batch
npm start           # Start pipeline
npm run status      # Check status
npm run historical  # Process existing files
npm install         # Reinstall dependencies
```

### Log Analysis
```batch
# View recent activity
type logs\combined.log | findstr /C:"Successfully processed"

# Check for errors
type logs\error.log
```

---

**Your EMS data pipeline is now ready to continuously feed your Supabase database for AI applications!** 🚀 