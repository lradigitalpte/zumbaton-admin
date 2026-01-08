/**
 * SMTP Test Script
 * Tests Gmail/Google Workspace SMTP connection
 * 
 * Usage:
 *   node scripts/test-smtp.js
 *   OR
 *   SMTP_PASSWORD=your_password node scripts/test-smtp.js
 */

const nodemailer = require('nodemailer');
const readline = require('readline');

// SMTP Configuration
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587, // Try 587 first (TLS), then 465 (SSL)
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'hello@zumbaton.sg',
    pass: process.env.SMTP_PASSWORD || '', // Will prompt if not set
  },
};

// Test email configuration
const TEST_EMAIL = {
  from: '"Zumbaton" <hello@zumbaton.sg>',
  to: process.env.TEST_EMAIL || '', // Will prompt if not set
  subject: 'SMTP Test - Zumbaton',
  html: `
    <h2>SMTP Test Email</h2>
    <p>This is a test email from Zumbaton SMTP configuration.</p>
    <p>If you received this email, your SMTP setup is working correctly!</p>
    <hr>
    <p style="color: #666; font-size: 12px;">
      Sent at: ${new Date().toLocaleString()}<br>
      From: hello@zumbaton.sg
    </p>
  `,
  text: `
    SMTP Test Email
    
    This is a test email from Zumbaton SMTP configuration.
    If you received this email, your SMTP setup is working correctly!
    
    Sent at: ${new Date().toLocaleString()}
    From: hello@zumbaton.sg
  `,
};

// Helper to prompt for input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Test SMTP connection
async function testSMTP(config, port, useSSL = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing SMTP on port ${port} (${useSSL ? 'SSL' : 'TLS'})...`);
  console.log(`${'='.repeat(60)}\n`);

  const testConfig = {
    ...config,
    port,
    secure: useSSL,
  };

  try {
    // Create transporter
    const transporter = nodemailer.createTransport(testConfig);

    // Verify connection
    console.log('1. Verifying SMTP connection...');
    await transporter.verify();
    console.log('   ✅ SMTP connection verified!\n');

    // Send test email
    console.log('2. Sending test email...');
    const info = await transporter.sendMail(TEST_EMAIL);
    console.log('   ✅ Test email sent successfully!\n');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);

    return { success: true, info };
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    if (error.code) {
      console.log('   Error Code:', error.code);
    }
    return { success: false, error };
  }
}

// Main function
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         Zumbaton SMTP Test Script                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Get password if not set
  if (!SMTP_CONFIG.auth.pass) {
    console.log('Please enter your SMTP password (app-specific password from Google):');
    SMTP_CONFIG.auth.pass = await askQuestion('Password: ');
    console.log('');
  }

  // Get test email if not set
  if (!TEST_EMAIL.to) {
    console.log('Enter the email address to send test email to:');
    TEST_EMAIL.to = await askQuestion('Email: ');
    console.log('');
  }

  // Validate inputs
  if (!SMTP_CONFIG.auth.pass) {
    console.error('❌ Error: Password is required');
    process.exit(1);
  }

  if (!TEST_EMAIL.to || !TEST_EMAIL.to.includes('@')) {
    console.error('❌ Error: Valid email address is required');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('  Host:', SMTP_CONFIG.host);
  console.log('  Username:', SMTP_CONFIG.auth.user);
  console.log('  Sender:', TEST_EMAIL.from);
  console.log('  Recipient:', TEST_EMAIL.to);
  console.log('');

  // Test port 587 (TLS) first
  const result587 = await testSMTP(SMTP_CONFIG, 587, false);

  if (result587.success) {
    console.log('\n✅ SUCCESS! SMTP is working correctly on port 587 (TLS)');
    console.log('\n📧 Check your inbox at:', TEST_EMAIL.to);
    console.log('   (Also check spam folder if not in inbox)');
    process.exit(0);
  }

  // If 587 fails, try 465 (SSL)
  console.log('\n⚠️  Port 587 failed, trying port 465 (SSL)...\n');
  const result465 = await testSMTP(SMTP_CONFIG, 465, true);

  if (result465.success) {
    console.log('\n✅ SUCCESS! SMTP is working correctly on port 465 (SSL)');
    console.log('\n📧 Check your inbox at:', TEST_EMAIL.to);
    console.log('   (Also check spam folder if not in inbox)');
    process.exit(0);
  }

  // Both failed
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    ❌ TEST FAILED                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('Both ports failed. Common issues:');
  console.log('  1. Wrong password (must be app-specific password, not regular password)');
  console.log('  2. 2-Step Verification not enabled on Google account');
  console.log('  3. App-specific password not generated correctly');
  console.log('  4. Firewall blocking SMTP ports');
  console.log('  5. "Less secure app access" needs to be enabled (older accounts)');
  console.log('\n');

  if (result587.error) {
    console.log('Port 587 Error:', result587.error.message);
  }
  if (result465.error) {
    console.log('Port 465 Error:', result465.error.message);
  }

  console.log('\n');
  console.log('Next steps:');
  console.log('  1. Go to: https://myaccount.google.com/apppasswords');
  console.log('  2. Generate a new app-specific password for "Mail"');
  console.log('  3. Copy the 16-character password (remove spaces)');
  console.log('  4. Update SMTP settings in Supabase dashboard');
  console.log('  5. Run this test again\n');

  process.exit(1);
}

// Run the test
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});

