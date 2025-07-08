#!/usr/bin/env node

const config = require('../config');
const { FileWatcher } = require('./watchers/fileWatcher');
const { SupabaseClient } = require('./clients/supabaseClient');
const { createLogger, logStartup, logShutdown, logStats } = require('./utils/logger');

const logger = createLogger('Main');

class EMSPipeline {
  constructor() {
    this.fileWatcher = new FileWatcher();
    this.supabaseClient = new SupabaseClient();
    this.isRunning = false;
    this.statsInterval = null;
  }

  async start() {
    try {
      logStartup();
      
      // Test Supabase connection
      logger.info('Testing Supabase connection...');
      const connectionOk = await this.supabaseClient.testConnection();
      if (!connectionOk) {
        throw new Error('Failed to connect to Supabase. Please check your configuration.');
      }
      logger.info('✅ Supabase connection successful');

      // Start file watcher
      logger.info('Starting file monitoring...');
      this.fileWatcher.start();
      logger.info('✅ File monitoring started');

      // Start periodic stats logging
      this.startStatsLogging();

      this.isRunning = true;
      logger.info('🎉 EMS Pipeline is now running and monitoring for files');

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error(`Failed to start EMS Pipeline: ${error.message}`);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.stop().then(() => process.exit(1));
    });
  }

  startStatsLogging() {
    // Log stats every 5 minutes
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.supabaseClient.getProcessingStats();
        const watcherStats = this.fileWatcher.getStats();
        
        logger.info('📊 System Status:');
        logger.info(`   File Watcher: ${watcherStats.isWatching ? '✅ Active' : '❌ Inactive'}`);
        logger.info(`   Files Being Processed: ${watcherStats.processingCount}`);
        logStats(stats);
      } catch (error) {
        logger.warn(`Failed to get stats: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async stop() {
    if (!this.isRunning) return;

    logShutdown();
    this.isRunning = false;

    // Clear stats interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Stop file watcher
    if (this.fileWatcher) {
      this.fileWatcher.stop();
      logger.info('✅ File watcher stopped');
    }

    logger.info('✅ EMS Pipeline shutdown complete');
  }

  async processHistoricalFiles() {
    logger.info('🔍 Processing historical EMS files...');
    
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const glob = require('glob');
      
      // Find all EMS files in the export directory
      const emsPattern = path.join(config.ccc.exportPath, '**/*.{ems,EMS}');
      const emsFiles = glob.sync(emsPattern);
      
      logger.info(`Found ${emsFiles.length} historical EMS files`);
      
      if (emsFiles.length === 0) {
        logger.info('No historical files found to process');
        return;
      }

      // Process files in batches
      const batchSize = config.processing.batchSize || 10;
      for (let i = 0; i < emsFiles.length; i += batchSize) {
        const batch = emsFiles.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(emsFiles.length / batchSize)}`);
        
        const promises = batch.map(filePath => 
          this.fileWatcher.processEMSFile(filePath).catch(error => 
            logger.error(`Failed to process ${filePath}: ${error.message}`)
          )
        );
        
        await Promise.all(promises);
      }
      
      logger.info('✅ Historical file processing complete');
      
    } catch (error) {
      logger.error(`Failed to process historical files: ${error.message}`);
    }
  }

  async getStatus() {
    const watcherStats = this.fileWatcher.getStats();
    const dbStats = await this.supabaseClient.getProcessingStats();
    
    return {
      isRunning: this.isRunning,
      fileWatcher: watcherStats,
      database: dbStats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}

// CLI handling
if (require.main === module) {
  const pipeline = new EMSPipeline();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'start':
      pipeline.start();
      break;
      
    case 'historical':
      pipeline.processHistoricalFiles()
        .then(() => process.exit(0))
        .catch(error => {
          logger.error(`Historical processing failed: ${error.message}`);
          process.exit(1);
        });
      break;
      
    case 'status':
      pipeline.getStatus()
        .then(status => {
          console.log(JSON.stringify(status, null, 2));
          process.exit(0);
        })
        .catch(error => {
          logger.error(`Status check failed: ${error.message}`);
          process.exit(1);
        });
      break;
      
    default:
      console.log('EMS CCC Pipeline');
      console.log('');
      console.log('Usage:');
      console.log('  npm start                 Start the file monitoring pipeline');
      console.log('  npm run historical        Process existing historical files');
      console.log('  npm run status            Check pipeline status');
      console.log('');
      console.log('Commands:');
      console.log('  start                     Start real-time file monitoring');
      console.log('  historical                Process all existing EMS files');
      console.log('  status                    Display current status');
      process.exit(0);
  }
}

module.exports = { EMSPipeline }; 