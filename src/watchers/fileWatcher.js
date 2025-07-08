const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { EMSParser } = require('../parsers/emsParser');
const { SupabaseClient } = require('../clients/supabaseClient');
const { ImageProcessor } = require('../processors/imageProcessor');
const { createLogger } = require('../utils/logger');

const logger = createLogger('File Watcher');

class FileWatcher {
  constructor() {
    this.parser = new EMSParser();
    this.supabaseClient = new SupabaseClient();
    this.imageProcessor = new ImageProcessor();
    this.isProcessing = new Set();
    this.watchPaths = [
      path.join(config.ccc.exportPath, '*.ems'),
      path.join(config.ccc.exportPath, '*.EMS'),
      path.join(config.ccc.exportPath, '**/*.ems'),
      path.join(config.ccc.exportPath, '**/*.EMS')
    ];
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.ensureDir(config.ccc.processedPath);
      await fs.ensureDir(config.ccc.logsPath);
      logger.info('Required directories ensured');
    } catch (error) {
      logger.error(`Failed to create directories: ${error.message}`);
    }
  }

  start() {
    logger.info('Starting file watcher...');
    logger.info(`Watching paths: ${this.watchPaths.join(', ')}`);

    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', this.handleFileAdded.bind(this))
      .on('change', this.handleFileChanged.bind(this))
      .on('unlink', this.handleFileRemoved.bind(this))
      .on('error', this.handleError.bind(this))
      .on('ready', () => {
        logger.info('File watcher ready and monitoring for changes');
      });

    // Also watch for image files
    this.startImageWatcher();

    return this.watcher;
  }

  startImageWatcher() {
    const imagePaths = [
      path.join(config.ccc.exportPath, '*.jpg'),
      path.join(config.ccc.exportPath, '*.jpeg'),
      path.join(config.ccc.exportPath, '*.png'),
      path.join(config.ccc.exportPath, '*.gif'),
      path.join(config.ccc.exportPath, '*.pdf'),
      path.join(config.ccc.exportPath, '**/*.jpg'),
      path.join(config.ccc.exportPath, '**/*.jpeg'),
      path.join(config.ccc.exportPath, '**/*.png'),
      path.join(config.ccc.exportPath, '**/*.gif'),
      path.join(config.ccc.exportPath, '**/*.pdf')
    ];

    this.imageWatcher = chokidar.watch(imagePaths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.imageWatcher
      .on('add', this.handleImageAdded.bind(this))
      .on('error', this.handleError.bind(this));

    logger.info('Image watcher started');
  }

  async handleFileAdded(filePath) {
    try {
      const fileName = path.basename(filePath);
      
      if (this.isProcessing.has(filePath)) {
        logger.debug(`File ${fileName} is already being processed, skipping`);
        return;
      }

      logger.info(`New EMS file detected: ${fileName}`);
      await this.processEMSFile(filePath);
    } catch (error) {
      logger.error(`Error handling file added ${filePath}: ${error.message}`);
    }
  }

  async handleFileChanged(filePath) {
    try {
      const fileName = path.basename(filePath);
      logger.info(`EMS file changed: ${fileName}`);
      
      // Wait a bit to ensure file is completely written
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.processEMSFile(filePath);
    } catch (error) {
      logger.error(`Error handling file changed ${filePath}: ${error.message}`);
    }
  }

  async handleFileRemoved(filePath) {
    const fileName = path.basename(filePath);
    logger.info(`EMS file removed: ${fileName}`);
    this.isProcessing.delete(filePath);
  }

  async handleImageAdded(filePath) {
    try {
      const fileName = path.basename(filePath);
      logger.info(`New image file detected: ${fileName}`);
      
      // Try to find associated estimate by looking for similar file names
      const associatedEstimate = await this.findAssociatedEstimate(filePath);
      if (associatedEstimate) {
        await this.processImage(filePath, associatedEstimate.id);
      } else {
        logger.warn(`No associated estimate found for image: ${fileName}`);
      }
    } catch (error) {
      logger.error(`Error handling image ${filePath}: ${error.message}`);
    }
  }

  handleError(error) {
    logger.error(`File watcher error: ${error.message}`);
  }

  async processEMSFile(filePath) {
    const fileName = path.basename(filePath);
    const startTime = Date.now();
    
    try {
      // Mark as processing
      this.isProcessing.add(filePath);
      
      // Log processing start
      await this.supabaseClient.logProcessing(fileName, 'processing', {
        filePath,
        startTime: new Date().toISOString()
      });

      logger.info(`Processing EMS file: ${fileName}`);

      // Parse the EMS file
      const estimateData = await this.parser.parseFile(filePath);
      
      // Upload to Supabase
      const uploadedEstimate = await this.supabaseClient.uploadEstimate(estimateData);
      
      // Look for associated images
      await this.processAssociatedImages(filePath, uploadedEstimate.id);

      // Move file to processed directory
      await this.moveToProcessed(filePath);

      const processingTime = Date.now() - startTime;
      
      // Log successful processing
      await this.supabaseClient.logProcessing(fileName, 'completed', {
        filePath,
        recordsProcessed: 1,
        processingTime,
        estimateId: uploadedEstimate.id
      });

      logger.info(`Successfully processed EMS file: ${fileName} (${processingTime}ms)`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log error
      await this.supabaseClient.logProcessing(fileName, 'error', {
        filePath,
        errorsCount: 1,
        errors: [{ message: error.message, stack: error.stack }],
        processingTime
      });

      logger.error(`Failed to process EMS file ${fileName}: ${error.message}`);
      
      // Move file to error directory for manual review
      await this.moveToError(filePath, error);
    } finally {
      this.isProcessing.delete(filePath);
    }
  }

  async processAssociatedImages(emsFilePath, estimateId) {
    try {
      const baseDir = path.dirname(emsFilePath);
      const baseName = path.basename(emsFilePath, path.extname(emsFilePath));
      
      // Look for images with similar names
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
      const imagePromises = [];

      for (const ext of imageExtensions) {
        const imagePath = path.join(baseDir, `${baseName}${ext}`);
        if (await fs.pathExists(imagePath)) {
          imagePromises.push(this.processImage(imagePath, estimateId));
        }
        
        // Also check for numbered variants
        for (let i = 1; i <= 10; i++) {
          const numberedImagePath = path.join(baseDir, `${baseName}_${i}${ext}`);
          if (await fs.pathExists(numberedImagePath)) {
            imagePromises.push(this.processImage(numberedImagePath, estimateId));
          }
        }
      }

      if (imagePromises.length > 0) {
        await Promise.all(imagePromises);
        logger.info(`Processed ${imagePromises.length} associated images`);
      }

    } catch (error) {
      logger.warn(`Error processing associated images: ${error.message}`);
    }
  }

  async processImage(imagePath, estimateId) {
    try {
      // Upload image to Supabase
      const imageRecord = await this.supabaseClient.uploadImage(imagePath, estimateId, 'damage');
      
      // Process OCR if enabled
      if (config.processing.enableOCR) {
        const ocrText = await this.imageProcessor.extractText(imagePath);
        if (ocrText) {
          await this.supabaseClient.updateImageOCR(imageRecord.id, ocrText);
          logger.info(`OCR processed for image: ${path.basename(imagePath)}`);
        }
      }

      return imageRecord;
    } catch (error) {
      logger.error(`Failed to process image ${imagePath}: ${error.message}`);
      throw error;
    }
  }

  async findAssociatedEstimate(imagePath) {
    try {
      const baseName = path.basename(imagePath, path.extname(imagePath));
      
      // Try to find estimate by matching file names
      const { data, error } = await this.supabaseClient.supabase
        .from('estimates')
        .select('id, estimate_number, source_file')
        .like('source_file', `%${baseName}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.warn(`Error finding associated estimate: ${error.message}`);
      return null;
    }
  }

  async moveToProcessed(filePath) {
    try {
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const processedPath = path.join(config.ccc.processedPath, `${timestamp}_${fileName}`);
      
      await fs.move(filePath, processedPath);
      logger.debug(`Moved file to processed: ${fileName}`);
    } catch (error) {
      logger.warn(`Failed to move file to processed: ${error.message}`);
    }
  }

  async moveToError(filePath, error) {
    try {
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const errorDir = path.join(config.ccc.processedPath, 'errors');
      await fs.ensureDir(errorDir);
      
      const errorPath = path.join(errorDir, `${timestamp}_${fileName}`);
      const errorLogPath = path.join(errorDir, `${timestamp}_${fileName}.error.log`);
      
      await fs.move(filePath, errorPath);
      await fs.writeFile(errorLogPath, `Error: ${error.message}\nStack: ${error.stack}\nTimestamp: ${new Date().toISOString()}`);
      
      logger.debug(`Moved file to error directory: ${fileName}`);
    } catch (moveError) {
      logger.warn(`Failed to move file to error directory: ${moveError.message}`);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      logger.info('File watcher stopped');
    }
    if (this.imageWatcher) {
      this.imageWatcher.close();
      logger.info('Image watcher stopped');
    }
  }

  getStats() {
    return {
      isWatching: this.watcher && !this.watcher.closed,
      processingCount: this.isProcessing.size,
      watchedPaths: this.watchPaths
    };
  }
}

module.exports = { FileWatcher }; 