const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Image Processor');

class ImageProcessor {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
    this.ocrConfig = {
      lang: 'eng',
      oem: 1,
      psm: 3
    };
  }

  async extractText(imagePath) {
    try {
      if (!config.processing.enableOCR) {
        logger.debug('OCR is disabled, skipping text extraction');
        return null;
      }

      const fileExt = path.extname(imagePath).toLowerCase();
      if (!this.supportedFormats.includes(fileExt)) {
        logger.warn(`Unsupported image format: ${fileExt}`);
        return null;
      }

      logger.info(`Extracting text from image: ${path.basename(imagePath)}`);

      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(imagePath);
      
      // Perform OCR
      const result = await Tesseract.recognize(processedImagePath, this.ocrConfig.lang, {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Clean up processed image if it's different from original
      if (processedImagePath !== imagePath) {
        await fs.remove(processedImagePath);
      }

      const extractedText = result.data.text.trim();
      
      if (extractedText) {
        logger.info(`Successfully extracted ${extractedText.length} characters from image`);
        
        // Extract specific automotive data
        const structuredData = this.extractAutomotiveData(extractedText);
        
        return {
          rawText: extractedText,
          confidence: result.data.confidence,
          structuredData
        };
      } else {
        logger.warn('No text detected in image');
        return null;
      }

    } catch (error) {
      logger.error(`Failed to extract text from ${imagePath}: ${error.message}`);
      return null;
    }
  }

  async preprocessImage(imagePath) {
    try {
      const fileExt = path.extname(imagePath).toLowerCase();
      
      // Skip preprocessing for PDFs
      if (fileExt === '.pdf') {
        return imagePath;
      }

      const outputPath = path.join(
        path.dirname(imagePath),
        `processed_${path.basename(imagePath, fileExt)}.png`
      );

      // Get image metadata
      const metadata = await sharp(imagePath).metadata();
      
      // Apply preprocessing for better OCR
      await sharp(imagePath)
        .resize(metadata.width * 2, metadata.height * 2, { // Upscale for better OCR
          kernel: sharp.kernel.cubic
        })
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .threshold(128) // Apply threshold for better text detection
        .png()
        .toFile(outputPath);

      logger.debug(`Preprocessed image saved: ${path.basename(outputPath)}`);
      return outputPath;

    } catch (error) {
      logger.warn(`Failed to preprocess image, using original: ${error.message}`);
      return imagePath;
    }
  }

  extractAutomotiveData(text) {
    const data = {
      vins: [],
      licensePlates: [],
      claimNumbers: [],
      estimateNumbers: [],
      phoneNumbers: [],
      emails: [],
      damages: [],
      parts: []
    };

    // VIN extraction (17 characters, alphanumeric, no I, O, Q)
    const vinRegex = /[A-HJ-NPR-Z0-9]{17}/g;
    data.vins = [...new Set((text.match(vinRegex) || []))];

    // License plate patterns (various formats)
    const licensePlateRegex = /[A-Z0-9]{2,8}[-\s]?[A-Z0-9]{0,4}/g;
    const potentialPlates = text.match(licensePlateRegex) || [];
    data.licensePlates = potentialPlates.filter(plate => 
      plate.length >= 3 && plate.length <= 8
    );

    // Claim number patterns
    const claimRegex = /(?:claim|file|ref)[\s#:]*([A-Z0-9-]{6,20})/gi;
    const claimMatches = text.matchAll(claimRegex);
    for (const match of claimMatches) {
      data.claimNumbers.push(match[1]);
    }

    // Estimate number patterns
    const estimateRegex = /(?:estimate|est)[\s#:]*([A-Z0-9-]{6,20})/gi;
    const estimateMatches = text.matchAll(estimateRegex);
    for (const match of estimateMatches) {
      data.estimateNumbers.push(match[1]);
    }

    // Phone numbers
    const phoneRegex = /\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    data.phoneNumbers = [...new Set((text.match(phoneRegex) || []))];

    // Email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    data.emails = [...new Set((text.match(emailRegex) || []))];

    // Common automotive damage terms
    const damageKeywords = [
      'dent', 'scratch', 'cracked', 'broken', 'damaged', 'bent', 'torn',
      'collision', 'impact', 'bumper', 'hood', 'door', 'fender', 'quarter panel',
      'headlight', 'taillight', 'windshield', 'mirror', 'paint'
    ];
    
    data.damages = damageKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    );

    // Common automotive parts
    const partKeywords = [
      'airbag', 'alternator', 'battery', 'brake', 'clutch', 'engine',
      'exhaust', 'filter', 'radiator', 'starter', 'transmission', 'tire',
      'wheel', 'axle', 'suspension', 'catalytic converter'
    ];
    
    data.parts = partKeywords.filter(part => 
      text.toLowerCase().includes(part)
    );

    return data;
  }

  async resizeImage(imagePath, maxWidth = 1920, maxHeight = 1080) {
    try {
      const outputPath = path.join(
        path.dirname(imagePath),
        `resized_${path.basename(imagePath)}`
      );

      await sharp(imagePath)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      logger.debug(`Resized image: ${path.basename(outputPath)}`);
      return outputPath;

    } catch (error) {
      logger.error(`Failed to resize image: ${error.message}`);
      return imagePath;
    }
  }

  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = await fs.stat(imagePath);
      
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        fileSize: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error(`Failed to get image metadata: ${error.message}`);
      return null;
    }
  }

  async validateImage(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      
      // Check file size
      const maxSizeMB = config.processing.maxFileSizeMB || 50;
      if (stats.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`Image exceeds maximum size of ${maxSizeMB}MB`);
      }

      // Check if file is actually an image
      const metadata = await sharp(imagePath).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
      }

      // Check supported format
      const fileExt = path.extname(imagePath).toLowerCase();
      if (!this.supportedFormats.includes(fileExt)) {
        throw new Error(`Unsupported image format: ${fileExt}`);
      }

      return true;
    } catch (error) {
      logger.error(`Image validation failed for ${imagePath}: ${error.message}`);
      return false;
    }
  }

  async extractImageFromPDF(pdfPath, pageNumber = 1) {
    try {
      // This would require additional PDF processing libraries
      // For now, return the PDF path as-is for direct OCR processing
      logger.warn('PDF image extraction not implemented, processing PDF directly');
      return pdfPath;
    } catch (error) {
      logger.error(`Failed to extract image from PDF: ${error.message}`);
      throw error;
    }
  }

  getImageType(imagePath, ocrData = null) {
    const fileName = path.basename(imagePath).toLowerCase();
    const ocrText = ocrData?.rawText?.toLowerCase() || '';
    
    // Determine image type based on filename and OCR content
    if (fileName.includes('vin') || ocrText.includes('vin')) {
      return 'vin';
    } else if (fileName.includes('damage') || fileName.includes('photo')) {
      return 'damage';
    } else if (fileName.includes('before')) {
      return 'before';
    } else if (fileName.includes('after')) {
      return 'after';
    } else if (fileName.includes('supplement') || ocrText.includes('supplement')) {
      return 'supplement';
    } else if (ocrText.includes('estimate') || ocrText.includes('claim')) {
      return 'document';
    } else {
      return 'damage'; // Default to damage photo
    }
  }
}

module.exports = { ImageProcessor }; 