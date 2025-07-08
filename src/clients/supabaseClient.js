const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Supabase Client');

class SupabaseClient {
  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    this.bucketName = 'estimate-images';
  }

  async uploadEstimate(estimateData) {
    try {
      logger.info(`Uploading estimate: ${estimateData.estimateNumber || 'Unknown'}`);
      
      // Check if estimate already exists
      const existingEstimate = await this.findExistingEstimate(estimateData);
      if (existingEstimate) {
        logger.info(`Estimate already exists, updating: ${estimateData.estimateNumber}`);
        return await this.updateEstimate(existingEstimate.id, estimateData);
      }

      // Insert main estimate record
      const estimate = await this.insertEstimate(estimateData);
      
      // Insert line items
      if (estimateData.lineItems && estimateData.lineItems.length > 0) {
        await this.insertLineItems(estimate.id, estimateData.lineItems);
      }

      // Insert parts data
      if (estimateData.parts && estimateData.parts.length > 0) {
        await this.insertParts(estimateData.parts);
      }

      logger.info(`Successfully uploaded estimate with ID: ${estimate.id}`);
      return estimate;

    } catch (error) {
      logger.error(`Failed to upload estimate: ${error.message}`);
      throw error;
    }
  }

  async findExistingEstimate(estimateData) {
    const { data, error } = await this.supabase
      .from('estimates')
      .select('id, estimate_number, file_hash')
      .or(`estimate_number.eq.${estimateData.estimateNumber},file_hash.eq.${estimateData.fileHash}`)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data;
  }

  async insertEstimate(estimateData) {
    const estimateRecord = {
      id: uuidv4(),
      vin: estimateData.vin,
      claim_number: estimateData.claimNumber,
      estimate_number: estimateData.estimateNumber,
      year: estimateData.year,
      make: estimateData.make,
      model: estimateData.model,
      trim_level: estimateData.trimLevel,
      mileage: estimateData.mileage,
      drp_provider: estimateData.drpProvider,
      insurance_company: estimateData.insuranceCompany,
      adjuster_name: estimateData.adjusterName,
      total_cost: estimateData.totalCost,
      labor_total: estimateData.laborTotal,
      parts_total: estimateData.partsTotal,
      tax_total: estimateData.taxTotal,
      estimate_date: estimateData.estimateDate,
      completion_date: estimateData.completionDate,
      status: estimateData.status || 'imported',
      line_items: estimateData.lineItems || [],
      vehicle_data: estimateData.vehicleData || {},
      damage_assessment: estimateData.damageAssessment || {},
      source_file: estimateData.sourceFile,
      file_hash: estimateData.fileHash,
      // Location tracking fields
      shop_name: config.location.shopName,
      shop_id: config.location.shopId,
      shop_address: config.location.address,
      shop_region: config.location.region,
      computer_name: config.location.computerName,
      timezone: config.location.timezone,
      shop_contact: config.location.contact
    };

    const { data, error } = await this.supabase
      .from('estimates')
      .insert(estimateRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert estimate: ${error.message}`);
    }

    return data;
  }

  async updateEstimate(estimateId, estimateData) {
    const updateRecord = {
      vin: estimateData.vin,
      claim_number: estimateData.claimNumber,
      year: estimateData.year,
      make: estimateData.make,
      model: estimateData.model,
      trim_level: estimateData.trimLevel,
      mileage: estimateData.mileage,
      drp_provider: estimateData.drpProvider,
      insurance_company: estimateData.insuranceCompany,
      adjuster_name: estimateData.adjusterName,
      total_cost: estimateData.totalCost,
      labor_total: estimateData.laborTotal,
      parts_total: estimateData.partsTotal,
      tax_total: estimateData.taxTotal,
      estimate_date: estimateData.estimateDate,
      completion_date: estimateData.completionDate,
      status: estimateData.status || 'updated',
      line_items: estimateData.lineItems || [],
      vehicle_data: estimateData.vehicleData || {},
      damage_assessment: estimateData.damageAssessment || {},
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('estimates')
      .update(updateRecord)
      .eq('id', estimateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update estimate: ${error.message}`);
    }

    // Update line items
    if (estimateData.lineItems && estimateData.lineItems.length > 0) {
      await this.replaceLineItems(estimateId, estimateData.lineItems);
    }

    return data;
  }

  async insertLineItems(estimateId, lineItems) {
    const lineItemRecords = lineItems.map(item => ({
      id: uuidv4(),
      estimate_id: estimateId,
      line_number: item.lineNumber,
      operation_type: item.operationType,
      part_description: item.partDescription,
      quantity: item.quantity,
      labor_hours: item.laborHours,
      labor_rate: item.laborRate,
      labor_cost: item.laborCost,
      part_cost: item.partCost,
      total_cost: item.totalCost,
      notes: item.notes
    }));

    const { data, error } = await this.supabase
      .from('estimate_line_items')
      .insert(lineItemRecords)
      .select();

    if (error) {
      throw new Error(`Failed to insert line items: ${error.message}`);
    }

    return data;
  }

  async replaceLineItems(estimateId, lineItems) {
    // Delete existing line items
    await this.supabase
      .from('estimate_line_items')
      .delete()
      .eq('estimate_id', estimateId);

    // Insert new line items
    return await this.insertLineItems(estimateId, lineItems);
  }

  async insertParts(parts) {
    const partRecords = parts.map(part => ({
      id: uuidv4(),
      part_number: part.partNumber,
      part_name: part.partName,
      oem_number: part.oemNumber,
      aftermarket_number: part.aftermarketNumber,
      list_price: part.listPrice,
      cost: part.cost,
      availability: part.availability,
      supplier: part.supplier,
      category: part.category,
      description: part.description
    }));

    // Use upsert to handle duplicates
    const { data, error } = await this.supabase
      .from('parts')
      .upsert(partRecords, { 
        onConflict: 'part_number',
        ignoreDuplicates: true 
      })
      .select();

    if (error) {
      logger.warn(`Failed to insert some parts: ${error.message}`);
    }

    return data || [];
  }

  async uploadImage(filePath, estimateId, imageType = 'damage') {
    try {
      const fileName = path.basename(filePath);
      const fileBuffer = await fs.readFile(filePath);
      const stats = await fs.stat(filePath);
      
      // Generate unique filename
      const fileExt = path.extname(fileName);
      const uniqueFileName = `${estimateId}/${uuidv4()}${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, fileBuffer, {
          contentType: this.getMimeType(fileExt),
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      // Insert image record
      const imageRecord = {
        id: uuidv4(),
        estimate_id: estimateId,
        file_name: fileName,
        file_path: uniqueFileName,
        file_size: stats.size,
        mime_type: this.getMimeType(fileExt),
        image_type: imageType,
        storage_url: urlData.publicUrl,
        metadata: {
          originalPath: filePath,
          uploadedAt: new Date().toISOString()
        }
      };

      const { data, error } = await this.supabase
        .from('estimate_images')
        .insert(imageRecord)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert image record: ${error.message}`);
      }

      logger.info(`Successfully uploaded image: ${fileName}`);
      return data;

    } catch (error) {
      logger.error(`Failed to upload image ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async updateImageOCR(imageId, ocrText) {
    const { data, error } = await this.supabase
      .from('estimate_images')
      .update({ ocr_text: ocrText })
      .eq('id', imageId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update OCR text: ${error.message}`);
    }

    return data;
  }

  async logProcessing(fileName, status, details = {}) {
    const logRecord = {
      id: uuidv4(),
      file_name: fileName,
      file_path: details.filePath,
      processing_status: status,
      records_processed: details.recordsProcessed || 0,
      errors_count: details.errorsCount || 0,
      error_details: details.errors || null,
      processing_time_ms: details.processingTime || 0,
      // Location tracking fields
      shop_name: config.location.shopName,
      shop_id: config.location.shopId,
      computer_name: config.location.computerName
    };

    const { data, error } = await this.supabase
      .from('processing_logs')
      .insert(logRecord)
      .select()
      .single();

    if (error) {
      logger.warn(`Failed to log processing: ${error.message}`);
    }

    return data;
  }

  async getProcessingStats() {
    const { data, error } = await this.supabase
      .from('processing_logs')
      .select('processing_status, records_processed, errors_count')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to get processing stats: ${error.message}`);
    }

    return {
      totalFiles: data.length,
      successful: data.filter(log => log.processing_status === 'completed').length,
      failed: data.filter(log => log.processing_status === 'error').length,
      totalRecords: data.reduce((sum, log) => sum + (log.records_processed || 0), 0),
      totalErrors: data.reduce((sum, log) => sum + (log.errors_count || 0), 0)
    };
  }

  getMimeType(fileExtension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.ems': 'text/plain'
    };
    
    return mimeTypes[fileExtension.toLowerCase()] || 'application/octet-stream';
  }

  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('estimates')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      logger.info('Supabase connection test successful');
      return true;
    } catch (error) {
      logger.error(`Supabase connection test failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = { SupabaseClient }; 