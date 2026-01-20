#!/usr/bin/env node

/**
 * Test Cron Jobs Script
 * 
 * This script tests all cron job endpoints to verify they're working correctly.
 * 
 * Usage:
 *   node scripts/test-cron-jobs.js
 * 
 * Requirements:
 *   - CRON_SECRET must be set in .env.local
 *   - Admin app must be deployed and accessible
 */

// Try to load dotenv if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, that's okay
}

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

// Use production URL by default for testing cron jobs
const ADMIN_URL = process.env.ADMIN_PROD_URL || envVars.ADMIN_PROD_URL || 'https://admin.zumbaton.sg';
const CRON_SECRET = process.env.CRON_SECRET || envVars.CRON_SECRET || '8283abb2addb741136e7db7501653b3352531dba695807dc983fd937b0da7e7f';

// Parse URL
const url = new URL(ADMIN_URL);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

const jobs = [
  { name: 'class-reminders', description: 'Send class reminders' },
  { name: 'waitlist-expiry', description: 'Process waitlist expiry' },
  { name: 'no-shows', description: 'Process no-shows' },
  { name: 'token-warnings', description: 'Send token expiry warnings' },
  { name: 'mark-completed-classes', description: 'Mark completed classes' },
  { name: 'expired-packages', description: 'Process expired packages' },
  { name: 'frozen-packages', description: 'Process frozen packages' },
  { name: 'all', description: 'Run all jobs' },
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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
      timeout: 30000, // 30 second timeout
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

async function testJob(job) {
  log(`\n🧪 Testing: ${job.description} (${job.name})`, 'cyan');
  log(`   URL: ${ADMIN_URL}/api/cron?job=${job.name}`, 'blue');

  try {
    const startTime = Date.now();
    const result = await makeRequest(job.name);
    const duration = Date.now() - startTime;

    if (result.success && result.data?.success) {
      log(`   ✅ SUCCESS (${duration}ms)`, 'green');
      
      if (result.data.data) {
        if (result.data.data.results) {
          // Multiple jobs result
          const summary = result.data.data.summary || {};
          log(`   📊 Summary:`, 'blue');
          log(`      - Total Jobs: ${summary.totalJobs || 'N/A'}`, 'blue');
          log(`      - Successful: ${summary.successful || 'N/A'}`, 'green');
          log(`      - Failed: ${summary.failed || 'N/A'}`, summary.failed > 0 ? 'red' : 'green');
          log(`      - Duration: ${summary.totalDuration || duration}ms`, 'blue');
          
          if (result.data.data.results && result.data.data.results.length > 0) {
            log(`   📋 Job Results:`, 'blue');
            result.data.data.results.forEach((r, i) => {
              const status = r.success ? '✅' : '❌';
              const color = r.success ? 'green' : 'red';
              log(`      ${status} ${r.jobName || `Job ${i + 1}`}: ${r.message || r.error || 'Completed'}`, color);
            });
          }
        } else if (result.data.data.message) {
          log(`   📝 Message: ${result.data.data.message}`, 'blue');
        }
      }
      
      return { success: true, duration, result: result.data };
    } else {
      log(`   ❌ FAILED`, 'red');
      log(`   Status Code: ${result.statusCode}`, 'red');
      if (result.data?.error) {
        log(`   Error: ${JSON.stringify(result.data.error)}`, 'red');
      } else if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      } else {
        log(`   Response: ${JSON.stringify(result.data)}`, 'red');
      }
      return { success: false, duration, error: result.data?.error || result.error };
    }
  } catch (error) {
    log(`   ❌ ERROR: ${error.error || error.message || JSON.stringify(error)}`, 'red');
    return { success: false, error: error.error || error.message };
  }
}

async function testAllJobs() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🚀 Cron Jobs Test Script', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\n📋 Configuration:`, 'blue');
  log(`   Admin URL: ${ADMIN_URL}`, 'blue');
  log(`   CRON_SECRET: ${CRON_SECRET.substring(0, 20)}...`, 'blue');
  
  if (!CRON_SECRET) {
    log('\n❌ ERROR: CRON_SECRET not found in .env.local', 'red');
    log('   Please add CRON_SECRET to your .env.local file', 'yellow');
    process.exit(1);
  }

  log('\n' + '-'.repeat(60), 'cyan');
  log('Starting tests...', 'cyan');
  log('-'.repeat(60), 'cyan');

  const results = [];
  
  // Test individual jobs first
  for (const job of jobs.filter(j => j.name !== 'all')) {
    const result = await testJob(job);
    results.push({ ...job, ...result });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test "all" job last
  const allJob = jobs.find(j => j.name === 'all');
  if (allJob) {
    log('\n' + '-'.repeat(60), 'cyan');
    log('Testing "all" job (runs all jobs)...', 'cyan');
    log('-'.repeat(60), 'cyan');
    const result = await testJob(allJob);
    results.push({ ...allJob, ...result });
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Test Summary', 'cyan');
  log('='.repeat(60), 'cyan');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  log(`\n✅ Successful: ${successful}/${results.length}`, successful === results.length ? 'green' : 'yellow');
  log(`❌ Failed: ${failed}/${results.length}`, failed > 0 ? 'red' : 'green');
  log(`⏱️  Total Duration: ${totalDuration}ms`, 'blue');

  log('\n📋 Detailed Results:', 'blue');
  results.forEach((r) => {
    const status = r.success ? '✅' : '❌';
    const color = r.success ? 'green' : 'red';
    log(`   ${status} ${r.description} (${r.name})`, color);
    if (r.duration) {
      log(`      Duration: ${r.duration}ms`, 'blue');
    }
    if (r.error) {
      log(`      Error: ${r.error}`, 'red');
    }
  });

  // Recommendations
  log('\n' + '='.repeat(60), 'cyan');
  log('💡 Recommendations', 'cyan');
  log('='.repeat(60), 'cyan');

  if (failed === 0) {
    log('\n🎉 All tests passed! Your cron jobs are working correctly.', 'green');
    log('\n✅ Next steps:', 'green');
    log('   1. Verify jobs are scheduled in Supabase:', 'blue');
    log('      SELECT * FROM cron.job;', 'blue');
    log('   2. Check job run history:', 'blue');
    log('      SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;', 'blue');
    log('   3. Monitor jobs regularly to ensure they keep running', 'blue');
  } else {
    log('\n⚠️  Some tests failed. Please check:', 'yellow');
    
    const failedJobs = results.filter(r => !r.success);
    failedJobs.forEach((r) => {
      log(`\n   ❌ ${r.description} (${r.name}):`, 'red');
      if (r.error) {
        log(`      Error: ${r.error}`, 'red');
      }
    });

    log('\n🔍 Troubleshooting:', 'yellow');
    log('   1. Verify CRON_SECRET is set in Vercel environment variables', 'blue');
    log('   2. Ensure admin app is deployed and accessible', 'blue');
    log('   3. Check admin app logs for API errors', 'blue');
    log('   4. Verify pg_cron and pg_net extensions are enabled in Supabase', 'blue');
    log('   5. Check Supabase job run history for errors:', 'blue');
    log('      SELECT * FROM cron.job_run_details WHERE status = \'failed\';', 'blue');
  }

  log('\n' + '='.repeat(60), 'cyan');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
testAllJobs().catch((error) => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
