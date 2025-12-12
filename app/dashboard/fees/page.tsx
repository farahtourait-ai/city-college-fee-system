'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './fees.module.css'

interface FeeRecord {
  id: string
  student_id: string
  amount: number
  due_date: string
  status: string
  payment_date: string | null
  challan_number: string | null
  month: string
  year: number
  academic_year: string
  students: {
    name: string
    roll_number: string
    courses: {
      name: string
    }
  }
}

export default function FeesPage() {
  const currentYear = new Date().getFullYear();
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const router = useRouter()

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Generate years: from current year to 10 years in future
  const generateAllYears = () => {
    const years = [];
    for (let i = -1; i <= 10; i++) {
      years.push(currentYear + i);
    }
    return years.sort((a, b) => b - a);
  }

  const allPossibleYears = generateAllYears();

  useEffect(() => {
    checkAuth()
    fetchFeeRecords()
  }, [])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchFeeRecords = async () => {
    try {
      console.log('🔄 Fetching fee records...')
      
      // Simple query to get fee records with student names
      const { data: feeData, error: feeError } = await supabase
        .from('fee_records')
        .select(`
          *,
          students (
            name,
            roll_number,
            course
          )
        `)
        .order('due_date', { ascending: false })

      if (feeError) {
        console.error('Error fetching fee records:', feeError)
        setFeeRecords([])
        return
      }

      console.log(`✅ Loaded ${feeData?.length || 0} fee records`)

      // Transform the data to match our interface
      const transformedData = feeData?.map(record => ({
        ...record,
        students: {
          name: record.students?.name || 'Unknown Student',
          roll_number: record.students?.roll_number || 'N/A',
          courses: {
            name: record.students?.course || 'No Course'
          }
        }
      })) || []

      setFeeRecords(transformedData)
      
    } catch (error) {
      console.error('Error in fetchFeeRecords:', error)
      setFeeRecords([])
    } finally {
      setLoading(false)
    }
  }

  // Get unique years from actual fee records
  const uniqueYearsFromData = [...new Set(feeRecords.map(record => record.year))].sort((a, b) => b - a)

  const filteredRecords = feeRecords.filter(record => {
    // Status filter
    if (filter !== 'all' && record.status !== filter) return false
    // Month filter
    if (monthFilter !== 'all' && record.month !== monthFilter) return false
    // Year filter
    if (yearFilter !== 'all' && record.year !== parseInt(yearFilter)) return false
    return true
  })

  // ✅ NEW: Payment confirmation email function
  const sendPaymentConfirmationEmail = async (params: {
    studentName: string
    studentRoll: string
    amount: number
    paymentDate: string
    challanNumber?: string
    month: string
    year: number
  }) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'hassancitycollege222@gmail.com', // Your admin email
          name: 'Admin',
          message: `✅ PAYMENT CONFIRMED: ${params.studentName} (Roll: ${params.studentRoll}) paid ₹${params.amount} for ${params.month} ${params.year}. Challan No: ${params.challanNumber || 'Not provided'}.`,
          rollNumber: params.studentRoll,
          pendingAmount: params.amount,
          course: 'Fee Payment',
          overdueDays: 0
        })
      });

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Payment confirmation email error:', error);
      return false;
    }
  }

  // ✅ UPDATED: Mark as paid with email confirmation
  const markAsPaid = async (feeRecord: FeeRecord) => {
    const challanNumber = prompt('Enter Challan Number (optional):');
    
    try {
      const { error } = await supabase
        .from('fee_records')
        .update({ 
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0],
          challan_number: challanNumber || null
        })
        .eq('id', feeRecord.id)

      if (error) throw error

      // ✅ Send payment confirmation email to admin
      const emailSent = await sendPaymentConfirmationEmail({
        studentName: feeRecord.students.name,
        studentRoll: feeRecord.students.roll_number,
        amount: feeRecord.amount,
        paymentDate: new Date().toISOString(),
        challanNumber: challanNumber || undefined,
        month: feeRecord.month,
        year: feeRecord.year
      })

      // Refresh the data
      fetchFeeRecords()
      
      if (emailSent) {
        alert('✅ Fee marked as paid! Confirmation email sent to admin.')
      } else {
        alert('✅ Fee marked as paid! (Email notification failed)')
      }
    } catch (error) {
      console.error('Error updating fee:', error)
      alert('Error marking fee as paid. Please try again.')
    }
  }

  const generateReceipt = (feeRecord: FeeRecord) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Fee Receipt - ${feeRecord.students.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                line-height: 1.6;
                color: #333;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
              }
              .college-name {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
              }
              .receipt-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .details { 
                margin: 20px 0; 
              }
              .section { 
                margin: 15px 0; 
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 5px;
              }
              .section h3 {
                margin-top: 0;
                color: #2563eb;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
              }
              .footer { 
                margin-top: 40px; 
                text-align: center;
                border-top: 1px solid #333;
                padding-top: 20px;
              }
              .signature-area {
                margin-top: 60px;
                text-align: right;
              }
              .amount-box {
                background: #f8fafc;
                padding: 10px;
                border: 2px solid #2563eb;
                border-radius: 5px;
                text-align: center;
                font-size: 18px;
                font-weight: bold;
                margin: 10px 0;
              }
              @media print {
                body { margin: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="college-name">CITY COMPUTER COLLEGE</div>
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
              <div>Official Fee Payment Document</div>
            </div>
            
            <div class="details">
              <div class="section">
                <table width="100%">
                  <tr>
                    <td><strong>Receipt No:</strong> ${feeRecord.challan_number || 'N/A'}</td>
                    <td align="right"><strong>Date:</strong> ${new Date().toLocaleDateString()}</td>
                  </tr>
                </table>
              </div>
              
              <div class="section">
                <h3>Student Details</h3>
                <table width="100%">
                  <tr>
                    <td><strong>Name:</strong> ${feeRecord.students.name}</td>
                    </Tr>
                  <tr>
                    <td><strong>Roll No:</strong> ${feeRecord.students.roll_number}</td>
                  </tr>
                  <tr>
                    <td colspan="2"><strong>Course:</strong> ${feeRecord.students.courses?.name || 'N/A'}</td>
                  </tr>
                </table>
              </div>
              
              <div class="section">
                <h3>Payment Details</h3>
                <div class="amount-box">
                  Amount Paid: ₹${feeRecord.amount.toLocaleString()}
                </div>
                <table width="100%">
                  <tr>
                    <td><strong>For Month:</strong> ${feeRecord.month} ${feeRecord.year}</td>
                    <td><strong>Due Date:</strong> ${new Date(feeRecord.due_date).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td><strong>Payment Date:</strong> ${feeRecord.payment_date ? new Date(feeRecord.payment_date).toLocaleDateString() : 'N/A'}</td>
                    <td><strong>Status:</strong> ${feeRecord.status.toUpperCase()}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <div class="footer">
                <p><strong>College Administration</strong><br>
                City Computer College<br>
                9876543210 | College Address</p>
              </div>
              <div style="margin-top: 20px; font-size: 12px; color: #666; Text-align: center;">
                This is a computer generated receipt. No signature required.
              </div>
            </div>
            
            <div class="no-print" style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Print Receipt
              </button>
              <button onclick="window.close()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                Close Window
              </button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading fee records...</div>
      </div>
    )
  }

  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0)
  const paidAmount = filteredRecords
    .filter(record => record.status === 'paid')
    .reduce((sum, record) => sum + record.amount, 0)
  const pendingAmount = filteredRecords
    .filter(record => record.status === 'pending')
    .reduce((sum, record) => sum + record.amount, 0)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Monthly Fee Management</h1>
              <p className={styles.subtitle}>Manage all monthly fee records and payments</p>
            </div>
        
<div className={styles.headerActions}>
  <Link href="/dashboard/fees/challan" className={styles.bulkButton}>
    Generate Challan
  </Link>
  <Link href="/dashboard/signatures" className={styles.bulkButton}>
    Manage Signatures
  </Link>
  {/* Update this line to point to the correct defaulters route */}
  <Link href="/dashboard/defaulters" className={styles.bulkButton}>
    View Defaulters
  </Link>
  <Link href="/dashboard/fees/add" className={styles.addButton}>
    + Add Monthly Fee
  </Link>
</div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Statistics */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{filteredRecords.length}</h3>
              <p className={styles.statLabel}>Total Records</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{totalAmount.toLocaleString()}</h3>
              <p className={styles.statLabel}>Total Amount</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{paidAmount.toLocaleString()}</h3>
              <p className={styles.statLabel}>Paid Amount</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{pendingAmount.toLocaleString()}</h3>
              <p className={styles.statLabel}>Pending Amount</p>
            </div>
          </div>

          {/* Filters */}
          <div className={styles.filtersSection}>
            <div className={styles.filterGroup}>
              <label>Status:</label>
              <div className={styles.filters}>
                <button 
                  className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All Fees
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'paid' ? styles.active : ''}`}
                  onClick={() => setFilter('paid')}
                >
                  Paid
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'pending' ? styles.active : ''}`}
                  onClick={() => setFilter('pending')}
                >
                  Pending
                </button>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label>Month:</label>
              <select 
                value={monthFilter} 
                onChange={(e) => setMonthFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Months</option>
                {months.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Year:</label>
              <select 
                value={yearFilter} 
                onChange={(e) => setYearFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Years</option>
                {allPossibleYears.map(year => (
                  <option key={year} value={year}>
                    {year} {uniqueYearsFromData.includes(year) ? '' : '(No fees)'}
                  </option>
                ))}
              </select>
              <small className={styles.helperText}>
                Shows years ${currentYear - 1} to ${currentYear + 10}
              </small>
            </div>
          </div>

          {/* Fees Table */}
          <div className={styles.feesSection}>
            <div className={styles.sectionHeader}>
              <h2>Monthly Fee Records ({filteredRecords.length})</h2>
              {(monthFilter !== 'all' || yearFilter !== 'all' || filter !== 'all') && (
                <div className={styles.activeFilters}>
                  Active filters: 
                  {filter !== 'all' && <span className={styles.filterTag}>{filter}</span>}
                  {monthFilter !== 'all' && <span className={styles.filterTag}>{monthFilter}</span>}
                  {yearFilter !== 'all' && <span className={styles.filterTag}>{yearFilter}</span>}
                  <button 
                    onClick={() => {
                      setFilter('all')
                      setMonthFilter('all')
                      setYearFilter('all')
                    }}
                    className={styles.clearFilters}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {filteredRecords.length === 0 ? (
              <div className={styles.emptyState}>
                <p>
                  {feeRecords.length === 0 
                    ? "No fee records found in the system." 
                    : "No fee records match your current filters."
                  }
                </p>
                <Link href="/dashboard/fees/add" className={styles.addButton}>
                  Add Your First Monthly Fee
                </Link>
              </div>
            ) : (
              <div className={styles.feesTable}>
                <div className={styles.tableHeader}>
                  <div>Student</div>
                  <div>Amount</div>
                  <div>Month</div>
                  <div>Due Date</div>
                  <div>Status</div>
                  <div>Challan No.</div>
                  <div>Actions</div>
                </div>
                <div className={styles.tableBody}>
                  {filteredRecords.map((record) => (
                    <div key={record.id} className={styles.tableRow}>
                      <div className={styles.studentInfo}>
                        <div className={styles.studentName}>{record.students.name}</div>
                        <div className={styles.studentDetails}>
                          {record.students.roll_number} • {record.students.courses?.name || 'No Course'}
                        </div>
                      </div>
                      <div className={styles.amount}>
                        ₹{record.amount.toLocaleString()}
                      </div>
                      <div className={styles.monthYear}>
                        {record.month} {record.year}
                      </div>
                      <div className={styles.dueDate}>
                        {new Date(record.due_date).toLocaleDateString()}
                      </div>
                      <div className={`${styles.status} ${styles[record.status]}`}>
                        {record.status.toUpperCase()}
                      </div>
                      <div className={styles.challanNumber}>
                        {record.challan_number || '-'}
                      </div>
                      <div className={styles.actions}>
                        {record.status === 'pending' && (
                          <button 
                            onClick={() => markAsPaid(record)}
                            className={styles.payButton}
                            title="Mark this fee as paid"
                          >
                            Mark Paid
                          </button>
                        )}
                        <Link 
                          href={`/dashboard/students/${record.student_id}`}
                          className={styles.viewButton}
                          title="View student details"
                        >
                          View Student
                        </Link>
                        {record.status === 'paid' && (
                          <button 
                            onClick={() => generateReceipt(record)}
                            className={styles.receiptButton}
                            title="Generate payment receipt"
                          >
                            🧾 Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}