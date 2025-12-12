const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔧 Testing Gmail Configuration...\n');

// Check environment variables
console.log('1. Checking .env.local variables:');
console.log('   GMAIL_USER:', process.env.GMAIL_USER ? '✓ ' + process.env.GMAIL_USER : '✗ Missing');
console.log('   GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✓ Present (hidden)' : '✗ Missing');

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error('\n❌ ERROR: Gmail credentials missing in .env.local');
  console.log('\n📝 Add these to your .env.local file:');
  console.log('GMAIL_USER=your.email@gmail.com');
  console.log('GMAIL_APP_PASSWORD=your-16-char-app-password');
  process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') // Remove spaces
  }
});

console.log('\n2. Testing Gmail connection...');

// Test connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Gmail connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure 2-Step Verification is ON in Google Account');
    console.log('2. Generate new App Password: https://myaccount.google.com/apppasswords');
    console.log('3. Copy 16-char password (no spaces between characters)');
    console.log('4. Update .env.local and restart server');
  } else {
    console.log('✅ Gmail connection successful!');
    console.log('\n🎉 Ready to send emails!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart your server: npm run dev');
    console.log('2. Go to /dashboard/notifications');
    console.log('3. Select a student and send test email');
  }
});