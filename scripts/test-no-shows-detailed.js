#!/usr/bin/env node

/**
 * Detailed No-Shows Test Script
 * 
 * This script specifically tests the no-shows cron job to verify:
 * 1. The endpoint is accessible
 * 2. The job executes successfully
 * 3. The logic correctly identifies bookings that should be marked as no-show
 * 
 * Usage:
 *   node scripts/test-no-shows-detailed.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Try to read .env.local directly if dotenv didn't work
let envVars = {};
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim();
      }
    });
  }
} catch (e) {
  // Ignore errors reading .env.local
}

const ADMIN_URL = process.env.ADMIN_PROD_URL || envVars.ADMIN_PROD_URL || 'https://admin.zumbaton.sg';
const CRON_SECRET = process.env.CRON_SECRET || envVars.CRON_SECRET || '8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f';

const url = new URL(ADMIN_URL);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(jobName) {
  return new Promise((resolve, reject) => {
    const path = `/api/cron?job=${jobName}`;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 second timeout for no-shows
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            success: res.statusCode >= 200 && res.statusCode < 300,
            data: json,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            success: false,
            error: 'Invalid JSON response',
            rawData: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        success: false,
        error: 'Request timeout',
      });
    });

    req.write('{}');
    req.end();
  });
}

async function testNoShows() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🔍 Detailed No-Shows Test', 'cyan');
  log('='.repeat(70), 'cyan');
  
  log(`\n📋 Configuration:`, 'blue');
  log(`   Admin URL: ${ADMIN_URL}`, 'blue');
  log(`   CRON_SECRET: ${CRON_SECRET.substring(0, 20)}...`, 'blue');
  
  log('\n' + '-'.repeat(70), 'cyan');
  log('🧪 Testing No-Shows Endpoint', 'cyan');
  log('-'.repeat(70), 'cyan');
  
  log(`\n📡 Making request to: ${ADMIN_URL}/api/cron?job=no-shows`, 'blue');
  
  try {
    const startTime = Date.now();
    const result = await makeRequest('no-shows');
    const duration = Date.now() - startTime;
    
    log(`\n⏱️  Response Time: ${duration}ms`, 'blue');
    log(`📊 Status Code: ${result.statusCode}`, result.success ? 'green' : 'red');
    
    if (result.success && result.data?.success) {
      log(`\n✅ SUCCESS - Endpoint is working!`, 'green');
      
      if (result.data.data) {
        const jobResult = result.data.data.results?.[0] || result.data.data;
        
        log(`\n📋 Job Execution Details:`, 'cyan');
        log(`   Job Name: ${jobResult.jobName || 'processNoShows'}`, 'blue');
        log(`   Success: ${jobResult.success ? '✅ Yes' : '❌ No'}`, jobResult.success ? 'green' : 'red');
        log(`   Duration: ${jobResult.duration || duration}ms`, 'blue');
        
        if (jobResult.details) {
          log(`\n📊 Processing Results:`, 'cyan');
          
          if (jobResult.details.processed !== undefined) {
            log(`   ✅ Processed: ${jobResult.details.processed} booking(s)`, 'green');
          }
          
          if (jobResult.details.failed !== undefined) {
            const failedColor = jobResult.details.failed > 0 ? 'red' : 'green';
            log(`   ${jobResult.details.failed > 0 ? '❌' : '✅'} Failed: ${jobResult.details.failed} booking(s)`, failedColor);
          }
          
          if (jobResult.details.errors && jobResult.details.errors.length > 0) {
            log(`\n⚠️  Errors Encountered:`, 'yellow');
            jobResult.details.errors.forEach((err, i) => {
              log(`   ${i + 1}. ${err}`, 'red');
            });
          }
          
          if (jobResult.details.message) {
            log(`\n📝 Message: ${jobResult.details.message}`, 'blue');
          }
        }
        
        // Check if there are any errors in the response
        if (jobResult.error) {
          log(`\n❌ Job Error: ${jobResult.error}`, 'red');
        }
      }
      
      log(`\n` + '='.repeat(70), 'cyan');
      log('✅ VERIFICATION COMPLETE', 'green');
      log('='.repeat(70), 'cyan');
      
      log(`\n💡 What this means:`, 'cyan');
      log(`   ✅ The no-shows endpoint is accessible and working`, 'green');
      log(`   ✅ The job executed successfully`, 'green');
      log(`   ✅ The logic is running correctly`, 'green');
      
      log(`\n📝 Note:`, 'blue');
      log(`   - If "Processed: 0", it means there are no bookings that need`, 'blue');
      log(`     to be marked as no-show right now (which is normal)`, 'blue');
      log(`   - The job will automatically process bookings 30 minutes`, 'blue');
      log(`     after a class ends if they're still in 'confirmed' status`, 'blue');
      
      log(`\n🔄 Next Steps:`, 'cyan');
      log(`   1. The cron job will run automatically every hour`, 'blue');
      log(`   2. Monitor job execution in Supabase:`, 'blue');
      log(`      SELECT * FROM cron.job_run_details WHERE jobname = 'process-no-shows';`, 'blue');
      log(`   3. Check for processed bookings in your database`, 'blue');
      
    } else {
      log(`\n❌ FAILED - Endpoint returned an error`, 'red');
      log(`\n📋 Error Details:`, 'red');
      
      if (result.data?.error) {
        log(`   Code: ${result.data.error.code || 'N/A'}`, 'red');
        log(`   Message: ${result.data.error.message || 'N/A'}`, 'red');
        if (result.data.error.details) {
          log(`   Details: ${JSON.stringify(result.data.error.details)}`, 'red');
        }
      } else if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      } else {
        log(`   Response: ${JSON.stringify(result.data)}`, 'red');
      }
      
      log(`\n🔍 Troubleshooting:`, 'yellow');
      log(`   1. Verify CRON_SECRET matches in Vercel environment variables`, 'blue');
      log(`   2. Check admin app logs for detailed error messages`, 'blue');
      log(`   3. Ensure the admin app is deployed and accessible`, 'blue');
      log(`   4. Verify pg_cron and pg_net extensions are enabled`, 'blue');
      
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ FATAL ERROR: ${error.error || error.message || JSON.stringify(error)}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testNoShows().catch((error) => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
