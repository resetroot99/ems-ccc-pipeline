const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EMS Parser');

class EMSParser {
  constructor() {
    this.lineTypes = {
      'H': 'header',
      'V': 'vehicle',
      'I': 'insurance',
      'L': 'lineitem',
      'P': 'parts',
      'T': 'totals',
      'N': 'notes',
      'S': 'supplement',
      'E': 'end'
    };
  }

  async parseFile(filePath) {
    try {
      logger.info(`Parsing EMS file: ${path.basename(filePath)}`);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const estimate = {
        sourceFile: path.basename(filePath),
        fileHash,
        lineItems: [],
        vehicleData: {},
        insuranceData: {},
        totals: {},
        notes: [],
        supplements: [],
        metadata: {
          parsedAt: new Date().toISOString(),
          totalLines: lines.length
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          this.parseLine(line, estimate);
        } catch (error) {
          logger.warn(`Error parsing line ${i + 1}: ${error.message}`);
          estimate.metadata.parsingErrors = estimate.metadata.parsingErrors || [];
          estimate.metadata.parsingErrors.push({
            line: i + 1,
            content: line,
            error: error.message
          });
        }
      }

      // Post-processing calculations
      this.calculateTotals(estimate);
      this.normalizeData(estimate);

      logger.info(`Successfully parsed EMS file with ${estimate.lineItems.length} line items`);
      return estimate;

    } catch (error) {
      logger.error(`Failed to parse EMS file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  parseLine(line, estimate) {
    const fields = line.split('|');
    if (fields.length === 0) return;

    const lineType = fields[0];
    const handler = this.getLineHandler(lineType);
    
    if (handler) {
      handler.call(this, fields, estimate);
    } else {
      logger.debug(`Unknown line type: ${lineType}`);
    }
  }

  getLineHandler(lineType) {
    const handlers = {
      'H': this.parseHeader,
      'V': this.parseVehicle,
      'I': this.parseInsurance,
      'L': this.parseLineItem,
      'P': this.parseParts,
      'T': this.parseTotals,
      'N': this.parseNotes,
      'S': this.parseSupplement,
      'A': this.parseAdjuster,
      'D': this.parseDamage,
      'R': this.parseRepair
    };
    return handlers[lineType];
  }

  parseHeader(fields, estimate) {
    estimate.estimateNumber = fields[1] || '';
    estimate.claimNumber = fields[2] || '';
    estimate.estimateDate = this.parseDate(fields[3]);
    estimate.completionDate = this.parseDate(fields[4]);
    estimate.status = fields[5] || 'imported';
    estimate.drpProvider = fields[6] || '';
  }

  parseVehicle(fields, estimate) {
    estimate.vehicleData = {
      vin: fields[1] || '',
      year: parseInt(fields[2]) || null,
      make: fields[3] || '',
      model: fields[4] || '',
      trimLevel: fields[5] || '',
      mileage: parseInt(fields[6]) || null,
      color: fields[7] || '',
      bodyStyle: fields[8] || '',
      engineSize: fields[9] || '',
      transmission: fields[10] || ''
    };
    
    // Copy key fields to main estimate object
    estimate.vin = estimate.vehicleData.vin;
    estimate.year = estimate.vehicleData.year;
    estimate.make = estimate.vehicleData.make;
    estimate.model = estimate.vehicleData.model;
    estimate.trimLevel = estimate.vehicleData.trimLevel;
    estimate.mileage = estimate.vehicleData.mileage;
  }

  parseInsurance(fields, estimate) {
    estimate.insuranceData = {
      company: fields[1] || '',
      policyNumber: fields[2] || '',
      claimNumber: fields[3] || '',
      deductible: parseFloat(fields[4]) || 0,
      coverage: fields[5] || ''
    };
    estimate.insuranceCompany = estimate.insuranceData.company;
  }

  parseLineItem(fields, estimate) {
    const lineItem = {
      lineNumber: parseInt(fields[1]) || estimate.lineItems.length + 1,
      operationType: fields[2] || 'repair',
      partDescription: fields[3] || '',
      partNumber: fields[4] || '',
      quantity: parseFloat(fields[5]) || 1,
      laborHours: parseFloat(fields[6]) || 0,
      laborRate: parseFloat(fields[7]) || 0,
      laborCost: parseFloat(fields[8]) || 0,
      partCost: parseFloat(fields[9]) || 0,
      totalCost: parseFloat(fields[10]) || 0,
      category: fields[11] || '',
      subcategory: fields[12] || '',
      notes: fields[13] || ''
    };

    // Calculate total if not provided
    if (!lineItem.totalCost) {
      lineItem.totalCost = lineItem.laborCost + lineItem.partCost;
    }

    estimate.lineItems.push(lineItem);
  }

  parseParts(fields, estimate) {
    const part = {
      partNumber: fields[1] || '',
      partName: fields[2] || '',
      oemNumber: fields[3] || '',
      aftermarketNumber: fields[4] || '',
      listPrice: parseFloat(fields[5]) || 0,
      cost: parseFloat(fields[6]) || 0,
      availability: fields[7] || '',
      supplier: fields[8] || '',
      category: fields[9] || '',
      description: fields[10] || ''
    };

    estimate.parts = estimate.parts || [];
    estimate.parts.push(part);
  }

  parseTotals(fields, estimate) {
    estimate.totals = {
      laborTotal: parseFloat(fields[1]) || 0,
      partsTotal: parseFloat(fields[2]) || 0,
      subletTotal: parseFloat(fields[3]) || 0,
      taxTotal: parseFloat(fields[4]) || 0,
      totalCost: parseFloat(fields[5]) || 0,
      salesTax: parseFloat(fields[6]) || 0,
      grandTotal: parseFloat(fields[7]) || 0
    };

    // Copy to main estimate
    estimate.laborTotal = estimate.totals.laborTotal;
    estimate.partsTotal = estimate.totals.partsTotal;
    estimate.taxTotal = estimate.totals.taxTotal;
    estimate.totalCost = estimate.totals.totalCost;
  }

  parseNotes(fields, estimate) {
    const note = {
      type: fields[1] || 'general',
      text: fields[2] || '',
      timestamp: this.parseDate(fields[3]),
      author: fields[4] || ''
    };
    estimate.notes.push(note);
  }

  parseSupplement(fields, estimate) {
    const supplement = {
      supplementNumber: fields[1] || '',
      date: this.parseDate(fields[2]),
      reason: fields[3] || '',
      amount: parseFloat(fields[4]) || 0,
      status: fields[5] || 'pending'
    };
    estimate.supplements.push(supplement);
  }

  parseAdjuster(fields, estimate) {
    estimate.adjusterData = {
      name: fields[1] || '',
      phone: fields[2] || '',
      email: fields[3] || '',
      company: fields[4] || ''
    };
    estimate.adjusterName = estimate.adjusterData.name;
  }

  parseDamage(fields, estimate) {
    const damage = {
      area: fields[1] || '',
      severity: fields[2] || '',
      description: fields[3] || '',
      operation: fields[4] || 'repair'
    };
    
    estimate.damageAssessment = estimate.damageAssessment || { areas: [] };
    estimate.damageAssessment.areas.push(damage);
  }

  parseRepair(fields, estimate) {
    const repair = {
      procedure: fields[1] || '',
      description: fields[2] || '',
      laborTime: parseFloat(fields[3]) || 0,
      skillLevel: fields[4] || '',
      refinishIncluded: fields[5] === 'Y'
    };
    
    estimate.repairProcedures = estimate.repairProcedures || [];
    estimate.repairProcedures.push(repair);
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    // Handle various date formats
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        if (format === formats[1]) { // YYYY-MM-DD
          return new Date(`${match[1]}-${match[2]}-${match[3]}`);
        } else { // MM/DD/YYYY or MM-DD-YYYY
          return new Date(`${match[3]}-${match[1]}-${match[2]}`);
        }
      }
    }

    return null;
  }

  calculateTotals(estimate) {
    if (estimate.lineItems.length === 0) return;

    let calculatedLaborTotal = 0;
    let calculatedPartsTotal = 0;
    let calculatedTotal = 0;

    estimate.lineItems.forEach(item => {
      calculatedLaborTotal += item.laborCost || 0;
      calculatedPartsTotal += item.partCost || 0;
      calculatedTotal += item.totalCost || 0;
    });

    // Use calculated values if totals section wasn't found or is empty
    if (!estimate.laborTotal) estimate.laborTotal = calculatedLaborTotal;
    if (!estimate.partsTotal) estimate.partsTotal = calculatedPartsTotal;
    if (!estimate.totalCost) estimate.totalCost = calculatedTotal;

    estimate.metadata.calculatedTotals = {
      laborTotal: calculatedLaborTotal,
      partsTotal: calculatedPartsTotal,
      totalCost: calculatedTotal
    };
  }

  normalizeData(estimate) {
    // Normalize make/model names
    if (estimate.make) {
      estimate.make = this.normalizeMake(estimate.make);
    }
    
    if (estimate.model) {
      estimate.model = this.normalizeModel(estimate.model);
    }

    // Normalize operation types
    estimate.lineItems.forEach(item => {
      item.operationType = this.normalizeOperation(item.operationType);
    });
  }

  normalizeMake(make) {
    const makeMap = {
      'CHEV': 'Chevrolet',
      'FORD': 'Ford',
      'TOYO': 'Toyota',
      'HOND': 'Honda',
      'NISS': 'Nissan',
      'HYUN': 'Hyundai',
      'SUBR': 'Subaru',
      'MAZD': 'Mazda',
      'BMW': 'BMW',
      'MERC': 'Mercedes-Benz',
      'AUDI': 'Audi',
      'VOLK': 'Volkswagen'
    };
    
    return makeMap[make.toUpperCase()] || make;
  }

  normalizeModel(model) {
    return model.charAt(0).toUpperCase() + model.slice(1).toLowerCase();
  }

  normalizeOperation(operation) {
    const operationMap = {
      'R': 'replace',
      'REP': 'repair',
      'REF': 'refinish',
      'I&R': 'remove_install',
      'O&A': 'overhaul_adjust',
      'SUPP': 'supplement'
    };
    
    return operationMap[operation.toUpperCase()] || operation.toLowerCase();
  }
}

module.exports = { EMSParser }; 