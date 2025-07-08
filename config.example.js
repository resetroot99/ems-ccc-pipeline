// Copy this file to config.js and update with your actual values
module.exports = {
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key',
    serviceKey: 'your-service-key'
  },
  
  ccc: {
    exportPath: 'C:/CCC_EMS_EXPORTS',
    processedPath: './processed',
    logsPath: './logs'
  },
  
  processing: {
    enableOCR: true,
    enableImageProcessing: true,
    maxFileSizeMB: 50,
    batchSize: 10
  },
  
  logging: {
    level: 'info',
    toFile: true
  },
  
  environment: 'production'
}; 