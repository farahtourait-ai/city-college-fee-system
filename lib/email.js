// lib/email.js
/**
 * Email Service for payment confirmations
 */

export async function sendPaymentConfirmation(params) {
  try {
    // Send to admin email (your email)
    const adminEmail = 'hassancitycollege222@gmail.com';
    
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: adminEmail,
        name: 'Admin',
        message: `✅ PAYMENT CONFIRMED: ${params.studentName} (Roll: ${params.studentRoll}) paid ₹${params.amount} for ${params.month} ${params.year}.`,
        rollNumber: params.studentRoll,
        pendingAmount: params.amount,
        course: 'Fee Payment',
        overdueDays: 0
      })
    });

    const result = await response.json();
    
    return {
      success: result.success === true,
      messageId: result.messageId,
      sentTo: adminEmail
    };

  } catch (error) {
    console.error('❌ Payment confirmation error:', error);
    return { success: false, error: error.message };
  }
}