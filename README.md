# EMS CCC Pipeline

A comprehensive data pipeline that automatically extracts, processes, and stores automotive estimate data from CCC ONE EMS exports to Supabase for AI/ML applications.

## 🚀 Features

- **Real-time File Monitoring**: Automatically processes new EMS files as they're exported from CCC ONE
- **Multi-Location Support**: Track estimates by shop, location, and computer for enterprise deployments
- **Geographic Data Tracking**: Tag estimates with shop location, region, and contact information
- **Historical Data Processing**: Batch process existing EMS files
- **Image Processing**: Upload and OCR process associated damage photos
- **Structured Data Storage**: Store estimates in normalized Supabase database
- **Comprehensive Logging**: Detailed logging and error tracking
- **RAG-Ready**: Data structured for Retrieval Augmented Generation and LLM fine-tuning

## 📋 Prerequisites

1. **CCC ONE Access**: You need access to CCC ONE with EMS & Workfile Copy module
2. **CCC Data Transfer Application**: Already installed and configured on your Windows PC
3. **Transfer Key**: Generated from CCC ONE portal (already have: `be1097ee-...`)
4. **Supabase Project**: Active project with database access
5. **Node.js**: Version 16 or higher

## 🛠️ Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd ems-ccc-pipeline
npm install
```

### 2. Configure Settings

Update `config.js` with your settings:

```javascript
module.exports = {
  supabase: {
    url: 'https://sxzjbrcpowcfxhwycbob.supabase.co',
    anonKey: 'your-anon-key',
    serviceKey: 'your-service-key'
  },
  
  ccc: {
    exportPath: 'C:/CCC_EMS_EXPORTS',  // Your CCC export directory
    processedPath: './processed',
    logsPath: './logs'
  },
  
  processing: {
    enableOCR: true,
    enableImageProcessing: true,
    maxFileSizeMB: 50,
    batchSize: 10
  }
};
```

### 3. Setup Database

Run the database setup script:

```bash
npm run setup
```

**If automatic setup fails**, manually run the SQL in `database/schema.sql` in your Supabase dashboard.

### 4. Configure CCC ONE Exports

In your CCC ONE portal:

1. Go to **Settings > Data Connections > EMS and Workfile Copy**
2. Ensure export types are enabled:
   - ✅ EMS Estimates
   - ✅ Workfile Copies  
   - ✅ Part Provider XML
3. Set export destination to: `C:\CCC_EMS_EXPORTS\`
4. Enable auto-export on estimate completion

## 🏢 Multi-Location Deployment

### Location Configuration

During installation, you'll be prompted to configure location information:

```bash
npm run setup-location
```

This creates a `.env` file with your shop details:

```env
SHOP_NAME="Downtown Auto Body"
SHOP_ID="SHOP001"
SHOP_ADDRESS="123 Main St, City, State"
SHOP_REGION="Northeast"
SHOP_PHONE="555-0123"
SHOP_EMAIL="info@downtownautobody.com"
SHOP_TIMEZONE="America/New_York"
```

### Multi-Shop Deployment

Deploy on multiple computers:

1. **Install on each computer** with CCC ONE
2. **Configure unique shop details** for each location
3. **All data flows** to your central Supabase database
4. **Analytics by location** - filter estimates by shop, region, or computer

### Location Data Structure

Each estimate includes location metadata:

```json
{
  "shop_name": "Downtown Auto Body",
  "shop_id": "SHOP001", 
  "shop_address": "123 Main St, City, State",
  "shop_region": "Northeast",
  "computer_name": "WORKSTATION-1",
  "timezone": "America/New_York",
  "shop_contact": {
    "phone": "555-0123",
    "email": "info@downtownautobody.com"
  }
}
```

## 🚦 Running the Pipeline

### Start Real-time Monitoring

```bash
npm start
```

This will:
- Monitor `C:\CCC_EMS_EXPORTS\` for new EMS files
- Automatically process and upload estimates to Supabase
- Process associated images with OCR
- Log all activities

### Process Historical Files

```bash
npm run historical
```

This will process all existing EMS files in your export directory.

### Check Status

```bash
npm run status
```

Returns JSON status including processing statistics and system health.

## 📊 Database Schema

### Main Tables

- **`estimates`**: Primary estimate data (VIN, make, model, totals, etc.)
- **`estimate_line_items`**: Detailed line items for each estimate
- **`estimate_images`**: Photos and documents with OCR text
- **`parts`**: Normalized parts catalog
- **`processing_logs`**: Processing history and error tracking

### Example Estimate Record

```json
{
  "id": "uuid",
  "vin": "1HGBH41JXMN109186",
  "estimate_number": "EST-2024-001",
  "year": 2022,
  "make": "Toyota",
  "model": "Camry",
  "total_cost": 3250.00,
  "line_items": [...],
  "vehicle_data": {...},
  "damage_assessment": {...}
}
```

## 🔧 Configuration Options

### CCC Export Settings

```javascript
ccc: {
  exportPath: 'C:/CCC_EMS_EXPORTS',    // Where CCC exports files
  processedPath: './processed',         // Where processed files are moved
  logsPath: './logs'                   // Application logs directory
}
```

### Processing Settings

```javascript
processing: {
  enableOCR: true,           // Extract text from images
  enableImageProcessing: true, // Process damage photos  
  maxFileSizeMB: 50,         // Max image file size
  batchSize: 10              // Historical processing batch size
}
```

### Logging Settings

```javascript
logging: {
  level: 'info',             // debug, info, warn, error
  toFile: true              // Save logs to files
}
```

## 📁 File Structure

```
ems-ccc-pipeline/
├── src/
│   ├── clients/
│   │   └── supabaseClient.js      # Supabase database operations
│   ├── parsers/
│   │   └── emsParser.js           # EMS file format parser
│   ├── processors/
│   │   └── imageProcessor.js      # Image and OCR processing
│   ├── watchers/
│   │   └── fileWatcher.js         # File system monitoring
│   ├── utils/
│   │   └── logger.js              # Logging utilities
│   └── index.js                   # Main application
├── database/
│   └── schema.sql                 # Supabase database schema
├── scripts/
│   └── setup-database.js          # Database setup script
├── config.js                      # Configuration
└── package.json
```

## 🔍 EMS File Format

The parser handles various CCC EMS line types:

- **H**: Header (estimate number, dates, status)
- **V**: Vehicle (VIN, make, model, year)
- **I**: Insurance (company, claim number, deductible)
- **L**: Line Items (parts, labor, costs)
- **P**: Parts Data (part numbers, prices)
- **T**: Totals (labor, parts, tax totals)
- **N**: Notes and Comments
- **S**: Supplements

## 🖼️ Image Processing

The system automatically:

1. **Finds Associated Images**: Matches images to estimates by filename
2. **Uploads to Supabase Storage**: Secure cloud storage
3. **Performs OCR**: Extracts text using Tesseract.js
4. **Extracts Automotive Data**: VINs, claim numbers, damage descriptions
5. **Stores Metadata**: File size, dimensions, processing results

## 📈 Monitoring & Logs

### Real-time Monitoring

The application logs processing statistics every 5 minutes:

```
📊 System Status:
   File Watcher: ✅ Active
   Files Being Processed: 2
📊 Processing Statistics:
   Total Files: 150
   Successful: 147
   Failed: 3
   Total Records: 147
```

### Log Files

- **`logs/combined.log`**: All application logs
- **`logs/error.log`**: Error logs only
- **Console**: Real-time colored output

## 🚨 Error Handling

### Failed Files

Failed EMS files are moved to `processed/errors/` with error logs for manual review.

### Common Issues

1. **Invalid EMS Format**: File doesn't match expected CCC format
2. **Supabase Connection**: Network or authentication issues
3. **Image Processing**: Corrupted or unsupported image files
4. **Duplicate Estimates**: Handled by updating existing records

## 🎯 RAG & AI Integration

### Prepared for AI Applications

The structured data is optimized for:

- **Vector Embeddings**: Generate embeddings from estimate descriptions
- **Similarity Search**: Find similar estimates by damage patterns
- **Training Data**: Export structured estimates for model fine-tuning
- **Context Retrieval**: Use as context for LLM estimate generation

### Example Query for RAG

```sql
-- Find similar estimates for context
SELECT 
  estimate_number,
  make,
  model,
  year,
  total_cost,
  line_items,
  damage_assessment
FROM estimates 
WHERE make = 'Toyota' 
  AND model = 'Camry'
  AND year BETWEEN 2020 AND 2024
ORDER BY created_at DESC
LIMIT 10;
```

## 🔒 Security

- **Service Key**: Used for database operations (keep secure)
- **RLS Policies**: Row Level Security enabled on all tables
- **File Validation**: Images validated before processing
- **Error Logging**: Sensitive data excluded from logs

## 🆘 Troubleshooting

### CCC Export Issues

1. Verify CCC Data Transfer Application is running
2. Check export path permissions
3. Ensure Transfer Key is valid
4. Confirm EMS export is enabled in CCC ONE

### Database Issues

1. Test Supabase connection: `npm run status`
2. Verify service key permissions
3. Check Supabase project billing status
4. Review database logs in Supabase dashboard

### Processing Issues

1. Check logs in `logs/` directory
2. Review failed files in `processed/errors/`
3. Verify file formats and permissions
4. Test with small batch first

## 📞 Support

For issues or questions:

1. Check the logs for detailed error messages
2. Verify configuration settings
3. Test database connectivity
4. Review CCC export settings

## 🔄 Updates & Maintenance

### Regular Maintenance

1. **Monitor Disk Space**: Processed files and logs accumulate
2. **Database Cleanup**: Archive old processing logs
3. **Update Dependencies**: Keep Node.js packages current
4. **Backup Data**: Regular Supabase backups

### Performance Optimization

- Adjust `batchSize` for historical processing
- Enable/disable OCR based on needs
- Monitor memory usage for large file volumes
- Consider database indexing for frequent queries

---

**Ready to start collecting estimate data for your AI applications!** 🚀 