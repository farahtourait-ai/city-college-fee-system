import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Create Gmail transporter (reuse your existing)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      studentName,
      studentRoll,
      amount,
      paymentDate,
      challanNumber,
      month,
      year
    } = body;

    console.log('💰 Payment Confirmation Request:', { 
      studentName,
      studentRoll,
      amount 
    });

    // ===== VALIDATION =====
    if (!studentName || !studentRoll || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Missing required payment details' },
        { status: 400 }
      );
    }

    // Get admin email (configure this in .env.local)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Admin email not configured' },
        { status: 500 }
      );
    }

    // ===== CREATE EMAIL CONTENT =====
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: #059669; color: white; padding: 25px; text-align: center; }
        .content { padding: 30px; }
        .success-icon { text-align: center; font-size: 40px; margin: 10px 0; color: #059669; }
        .payment-details { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; text-align: center; margin: 15px 0; }
        .detail-row { display: flex; margin: 10px 0; }
        .label { font-weight: bold; color: #374151; min-width: 120px; }
        .value { color: #1e293b; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Payment Confirmation</h1>
            <p>City Computer College</p>
        </div>
        <div class="content">
            <div class="success-icon">✅</div>
            <h2 style="text-align: center; color: #059669;">Payment Recorded Successfully</h2>
            
            <div class="payment-details">
                <div class="amount">₹${Number(amount).toLocaleString('en-IN')}</div>
                
                <div class="detail-row">
                    <div class="label">Student:</div>
                    <div class="value">${studentName}</div>
                </div>
                <div class="detail-row">
                    <div class="label">Roll No:</div>
                    <div class="value">${studentRoll}</div>
                </div>
                <div class="detail-row">
                    <div class="label">For Month:</div>
                    <div class="value">${month} ${year}</div>
                </div>
                <div class="detail-row">
                    <div class="label">Payment Date:</div>
                    <div class="value">${new Date(paymentDate).toLocaleDateString('en-IN')}</div>
                </div>
                ${challanNumber ? `
                <div class="detail-row">
                    <div class="label">Challan No:</div>
                    <div class="value">${challanNumber}</div>
                </div>
                ` : ''}
            </div>
            
            <p><em>This payment has been recorded in the Fee Management System.</em></p>
            
            <div class="footer">
                <p>Fee Management System • Automated Notification</p>
                <p>${new Date().toLocaleDateString('en-IN')}</p>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    const textContent = `
PAYMENT CONFIRMATION - City Computer College
============================================

✅ Payment Recorded Successfully

Amount: ₹${Number(amount).toLocaleString('en-IN')}
Student: ${studentName}
Roll No: ${studentRoll}
For Month: ${month} ${year}
Payment Date: ${new Date(paymentDate).toLocaleDateString('en-IN')}
${challanNumber ? `Challan No: ${challanNumber}` : ''}

This payment has been recorded in the Fee Management System.

Automated Notification • ${new Date().toLocaleDateString('en-IN')}
============================================
    `.trim();

    // ===== SEND EMAIL =====
    const mailOptions = {
      from: `"City Computer College" <${process.env.GMAIL_USER}>`,
      to: adminEmail,
      subject: `✅ Payment: ${studentName} - ₹${amount}`,
      html: htmlContent,
      text: textContent
    };

    console.log('📧 Sending payment confirmation to admin:', adminEmail);

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Payment confirmation email sent successfully!');
    console.log('📧 Message ID:', info.messageId);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      sentTo: adminEmail,
      message: 'Payment confirmation email sent to admin',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Payment confirmation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send payment confirmation',
        details: error.message
      },
      { status: 500 }
    );
  }
}