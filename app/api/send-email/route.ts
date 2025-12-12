import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') // Remove spaces from app password
  }
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      to, 
      name, 
      message, 
      rollNumber = 'Not provided', 
      course = 'Not provided', 
      pendingAmount = 0, 
      overdueDays = 0 
    } = body;

    console.log('📧 Starting Gmail email send to:', { 
      to, 
      name,
      from: process.env.GMAIL_USER 
    });

    // ===== VALIDATION =====
    if (!to || !name || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient email, student name, or message' },
        { status: 400 }
      );
    }

    // Check if Gmail credentials are configured
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ Gmail credentials missing in .env.local');
      return NextResponse.json(
        { 
          error: 'Gmail configuration missing',
          instructions: 'Please add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local file'
        },
        { status: 500 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: `Invalid email address format: ${to}` },
        { status: 400 }
      );
    }

    // ===== CREATE EMAIL CONTENT =====
    const htmlContent = createEmailHTML({
      name,
      message,
      rollNumber,
      course,
      pendingAmount,
      overdueDays
    });

    const textContent = `
FEE REMINDER - ${process.env.COLLEGE_NAME || 'City Computer College'}
===========================================

Dear ${name},

${message}

STUDENT DETAILS:
----------------
Roll Number: ${rollNumber}
Course: ${course}
${pendingAmount > 0 ? `Pending Amount: ₹${Number(pendingAmount).toLocaleString('en-IN')}` : ''}
${overdueDays > 0 ? `Overdue Days: ${overdueDays} days` : ''}

COLLEGE CONTACT:
----------------
📞 Phone: ${process.env.COLLEGE_PHONE || '9876543210'}
🏫 Office Hours: 9:00 AM - 5:00 PM (Monday to Friday)
📍 Address: ${process.env.COLLEGE_ADDRESS || '123 College Road, City'}

Please visit the college office at your earliest convenience to clear the pending dues.

Best Regards,
Accounts Department
${process.env.COLLEGE_NAME || 'City Computer College'}
===========================================
This is an automated reminder. Please do not reply to this email.
    `.trim();

    // ===== EMAIL CONFIGURATION =====
    const mailOptions = {
      from: `"${process.env.COLLEGE_NAME || 'City Computer College'}" <${process.env.GMAIL_USER}>`,
      to: to,
      replyTo: process.env.COLLEGE_EMAIL || process.env.GMAIL_USER,
      subject: `Fee Payment Reminder - ${process.env.COLLEGE_NAME || 'City Computer College'}`,
      html: htmlContent,
      text: textContent,
      // Priority headers
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    console.log('📧 Sending email via Gmail...');

    // ===== SEND EMAIL =====
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Gmail email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('👤 Sent to:', name, `<${to}>`);
    console.log('📤 Sent from:', process.env.GMAIL_USER);

    // Test URL for development
    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log('🔗 Preview URL:', testUrl);
    }

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      previewUrl: testUrl,
      message: `Email sent successfully to ${name}`,
      recipient: to,
      sentAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Gmail error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack
    });

    // User-friendly error messages
    let userMessage = 'Failed to send email';
    let errorDetails = error.message;
    
    if (error.code === 'EAUTH') {
      userMessage = 'Gmail authentication failed';
      errorDetails = 'Please check your GMAIL_USER and GMAIL_APP_PASSWORD in .env.local file. Make sure: 1) 2-Step Verification is ON, 2) App password is correct, 3) No spaces in password.';
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address';
    } else if (error.code === 'ECONNECTION') {
      userMessage = 'Network connection failed';
      errorDetails = 'Please check your internet connection.';
    }

    return NextResponse.json(
      { 
        success: false,
        error: userMessage,
        details: errorDetails,
        code: error.code,
        help: 'See console for detailed error log'
      },
      { status: 500 }
    );
  }
}

// ===== HELPER FUNCTION =====
function createEmailHTML(data: {
  name: string;
  message: string;
  rollNumber: string;
  course: string;
  pendingAmount: number;
  overdueDays: number;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fee Reminder - City Computer College</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1e293b;
        }
        .message-box {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #059669;
            margin: 20px 0;
            white-space: pre-line;
            font-size: 15px;
            line-height: 1.8;
        }
        .student-info {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .student-info h3 {
            color: #059669;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .info-row {
            display: flex;
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: 600;
            color: #374151;
            min-width: 140px;
        }
        .info-value {
            color: #1e293b;
        }
        .highlight {
            color: #dc2626;
            font-weight: bold;
        }
        .contact-box {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .contact-box h3 {
            color: #0369a1;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            text-align: center;
            font-size: 14px;
        }
        .note {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 15px;
            font-style: italic;
        }
        @media (max-width: 600px) {
            .content {
                padding: 20px;
            }
            .info-row {
                flex-direction: column;
            }
            .info-label {
                min-width: auto;
                margin-bottom: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>${process.env.COLLEGE_NAME || 'City Computer College'}</h1>
            <p>Fee Payment Reminder</p>
        </div>
        
        <div class="content">
            <p class="greeting"><strong>Dear ${data.name},</strong></p>
            
            <div class="message-box">
                ${data.message.replace(/\n/g, '<br>')}
            </div>
            
            <div class="student-info">
                <h3>📋 Student Details</h3>
                <div class="info-row">
                    <span class="info-label">Roll Number:</span>
                    <span class="info-value">${data.rollNumber}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Course:</span>
                    <span class="info-value">${data.course}</span>
                </div>
                ${data.pendingAmount > 0 ? `
                <div class="info-row">
                    <span class="info-label">Pending Amount:</span>
                    <span class="info-value highlight">₹${Number(data.pendingAmount).toLocaleString('en-IN')}</span>
                </div>
                ` : ''}
                ${data.overdueDays > 0 ? `
                <div class="info-row">
                    <span class="info-label">Overdue Days:</span>
                    <span class="info-value highlight">${data.overdueDays} days</span>
                </div>
                ` : ''}
            </div>
            
            <div class="contact-box">
                <h3>🏫 College Contact Information</h3>
                <p>📞 Phone: ${process.env.COLLEGE_PHONE || '9876543210'}</p>
                <p>🕒 Office Hours: 9:00 AM - 5:00 PM (Monday to Friday)</p>
                <p>📍 Address: ${process.env.COLLEGE_ADDRESS || '123 College Road, City'}</p>
            </div>
            
            <p>Please visit the college office at your earliest convenience to clear the pending dues and avoid any inconvenience.</p>
            
            <div class="footer">
                <p><strong>Best Regards,</strong><br>
                Accounts Department<br>
                ${process.env.COLLEGE_NAME || 'City Computer College'}</p>
                <p class="note">
                    This is an automated reminder. Please do not reply to this email.<br>
                    For queries, please contact: ${process.env.COLLEGE_PHONE || '9876543210'}
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `.trim();
}