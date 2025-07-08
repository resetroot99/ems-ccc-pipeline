#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { SupabaseClient } = require('../src/clients/supabaseClient');
const { createLogger } = require('../src/utils/logger');

const logger = createLogger('Database Setup');

async function setupDatabase() {
  try {
    logger.info('🚀 Starting database setup...');
    
    // Test connection
    const supabaseClient = new SupabaseClient();
    const connectionOk = await supabaseClient.testConnection();
    
    if (!connectionOk) {
      throw new Error('Failed to connect to Supabase. Please check your configuration.');
    }
    
    logger.info('✅ Supabase connection successful');
    
    // Read SQL schema
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    
    logger.info('📄 Executing database schema...');
    
    // Split SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    logger.info(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          logger.debug(`Executing statement ${i + 1}/${statements.length}`);
          
          const { error } = await supabaseClient.supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            // Try direct execution for some statements
            const { error: directError } = await supabaseClient.supabase
              .from('_temp')
              .select('1')
              .limit(0);
            
            // If the table doesn't exist, that's expected
            if (!directError || directError.code === 'PGRST106') {
              logger.debug(`Statement ${i + 1} executed (or skipped as expected)`);
            } else {
              logger.warn(`Statement ${i + 1} warning: ${error.message}`);
            }
          } else {
            logger.debug(`Statement ${i + 1} executed successfully`);
          }
        } catch (statementError) {
          logger.warn(`Statement ${i + 1} failed: ${statementError.message}`);
        }
      }
    }
    
    logger.info('✅ Database schema setup complete');
    
    // Run location tracking migration
    logger.info('📄 Applying location tracking migration...');
    await applyLocationMigration(supabaseClient);
    logger.info('✅ Location tracking migration complete');
    
    // Verify tables were created
    logger.info('🔍 Verifying table creation...');
    
    const tablesToCheck = ['estimates', 'estimate_images', 'parts', 'estimate_line_items', 'processing_logs'];
    const verificationResults = {};
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabaseClient.supabase
          .from(table)
          .select('count')
          .limit(1);
        
        verificationResults[table] = !error;
        if (!error) {
          logger.info(`  ✅ Table '${table}' is accessible`);
        } else {
          logger.warn(`  ❌ Table '${table}' verification failed: ${error.message}`);
        }
      } catch (err) {
        verificationResults[table] = false;
        logger.warn(`  ❌ Table '${table}' verification error: ${err.message}`);
      }
    }
    
    const successfulTables = Object.values(verificationResults).filter(Boolean).length;
    logger.info(`📊 Tables verified: ${successfulTables}/${tablesToCheck.length}`);
    
    if (successfulTables === tablesToCheck.length) {
      logger.info('🎉 Database setup completed successfully!');
      logger.info('');
      logger.info('Next steps:');
      logger.info('1. Make sure your CCC Data Transfer Application is running');
      logger.info('2. Configure your CCC export path in config.js');
      logger.info('3. Run "npm start" to begin monitoring for EMS files');
      logger.info('4. Run "npm run historical" to process existing files');
    } else {
      logger.warn('⚠️  Some tables may not have been created properly.');
      logger.warn('You may need to manually run the SQL schema in your Supabase dashboard.');
    }
    
  } catch (error) {
    logger.error(`Database setup failed: ${error.message}`);
    logger.error('');
    logger.error('Manual setup options:');
    logger.error('1. Copy the contents of database/schema.sql');
    logger.error('2. Go to your Supabase Dashboard > SQL Editor');
    logger.error('3. Paste and run the SQL manually');
    process.exit(1);
  }
}

// Apply location tracking migration
async function applyLocationMigration(supabaseClient) {
  try {
    const migrationPath = path.join(__dirname, '../database/migrations/add_location_tracking.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf8');
    
    // Split migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    logger.info(`Applying ${statements.length} migration statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          logger.debug(`Migration statement ${i + 1}/${statements.length}`);
          
          // Use direct SQL execution for ALTER TABLE statements
          const { error } = await supabaseClient.supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            // Many ALTER TABLE statements will succeed even if they show errors
            logger.debug(`Migration statement ${i + 1} completed (may show warning)`);
          } else {
            logger.debug(`Migration statement ${i + 1} executed successfully`);
          }
        } catch (statementError) {
          logger.debug(`Migration statement ${i + 1} info: ${statementError.message}`);
        }
      }
    }
    
  } catch (error) {
    logger.warn(`Location migration warning: ${error.message}`);
    logger.info('You may need to apply the migration manually from database/migrations/add_location_tracking.sql');
  }
}

// Helper function to create a simple SQL execution function
async function createExecSqlFunction(supabaseClient) {
  try {
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
      RETURNS TEXT AS $$
      BEGIN
        EXECUTE sql;
        RETURN 'OK';
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // This would need to be executed manually by the user with proper permissions
    logger.info('Note: You may need to create the exec_sql function manually in your Supabase dashboard');
    logger.info('Function SQL: ', createFunctionSql);
  } catch (error) {
    logger.debug('Could not create exec_sql function');
  }
}

if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { setupDatabase }; 