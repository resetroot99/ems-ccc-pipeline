const winston = require('winston');
const path = require('path');
const config = require('../../config');

// Create logs directory if it doesn't exist
const fs = require('fs-extra');
fs.ensureDirSync(config.ccc.logsPath);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, stack }) => {
    const servicePrefix = service ? `[${service}] ` : '';
    const logMessage = `${timestamp} ${level.toUpperCase()}: ${servicePrefix}${message}`;
    return stack ? `${logMessage}\n${stack}` : logMessage;
  })
);

// Create main logger
const mainLogger = winston.createLogger({
  level: config.logging.level || 'info',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Add file transport if enabled
if (config.logging.toFile) {
  mainLogger.add(new winston.transports.File({
    filename: path.join(config.ccc.logsPath, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  mainLogger.add(new winston.transports.File({
    filename: path.join(config.ccc.logsPath, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * Create a child logger with a service name
 * @param {string} serviceName - Name of the service/component
 * @returns {winston.Logger} Child logger instance
 */
function createLogger(serviceName) {
  return mainLogger.child({ service: serviceName });
}

/**
 * Log application startup information
 */
function logStartup() {
  mainLogger.info('='.repeat(50));
  mainLogger.info('🚀 EMS CCC Pipeline Starting');
  mainLogger.info(`📁 Export Path: ${config.ccc.exportPath}`);
  mainLogger.info(`📁 Processed Path: ${config.ccc.processedPath}`);
  mainLogger.info(`📁 Logs Path: ${config.ccc.logsPath}`);
  mainLogger.info(`🔧 OCR Enabled: ${config.processing.enableOCR}`);
  mainLogger.info(`🖼️  Image Processing Enabled: ${config.processing.enableImageProcessing}`);
  mainLogger.info(`📊 Log Level: ${config.logging.level}`);
  mainLogger.info('='.repeat(50));
}

/**
 * Log application shutdown information
 */
function logShutdown() {
  mainLogger.info('='.repeat(50));
  mainLogger.info('🛑 EMS CCC Pipeline Shutting Down');
  mainLogger.info('='.repeat(50));
}

/**
 * Log processing statistics
 * @param {Object} stats - Processing statistics
 */
function logStats(stats) {
  mainLogger.info('📊 Processing Statistics:');
  mainLogger.info(`   Total Files: ${stats.totalFiles || 0}`);
  mainLogger.info(`   Successful: ${stats.successful || 0}`);
  mainLogger.info(`   Failed: ${stats.failed || 0}`);
  mainLogger.info(`   Total Records: ${stats.totalRecords || 0}`);
  mainLogger.info(`   Total Errors: ${stats.totalErrors || 0}`);
}

module.exports = {
  createLogger,
  logStartup,
  logShutdown,
  logStats,
  mainLogger
}; 