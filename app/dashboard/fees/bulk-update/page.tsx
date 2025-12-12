'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../fees.module.css'

interface PendingFee {
  id: string
  student_id: string
  amount: number
  due_date: string
  month: string
  year: number
  students: {
    name: string
    roll_number: string
    course: string
    email: string
    phone: string
  }
}

interface PaymentUpdate {
  feeId: string
  studentId: string
  rollNumber: string
  studentName: string
  amount: number
  month: string
  year: number
  paid: boolean
  challanNumber: string
}

export default function BulkUpdateFees() {
  const [pendingFees, setPendingFees] = useState<PendingFee[]>([])
  const [paymentUpdates, setPaymentUpdates] = useState<PaymentUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const router = useRouter()

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  useEffect(() => {
    checkAuth()
    fetchPendingFees()
  }, [])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchPendingFees = async () => {
    try {
      const { data, error } = await supabase
        .from('fee_records')
        .select(`
          *,
          students (
            name,
            roll_number,
            course,
            email,
            phone
          )
        `)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })

      if (error) throw error

      setPendingFees(data || [])
      
      // Initialize payment updates
      const updates = (data || []).map(fee => ({
        feeId: fee.id,
        studentId: fee.student_id,
        rollNumber: fee.students.roll_number,
        studentName: fee.students.name,
        amount: fee.amount,
        month: fee.month,
        year: fee.year,
        paid: false,
        challanNumber: ''
      }))
      
      setPaymentUpdates(updates)
    } catch (error) {
      console.error('Error fetching pending fees:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ NEW: Payment confirmation email function for bulk updates
  const sendBulkPaymentConfirmationEmail = async (payments: Array<{
    studentName: string
    studentRoll: string
    amount: number
    paymentDate: string
    challanNumber?: string
    month: string
    year: number
  }>) => {
    try {
      // Send single summary email for all bulk payments
      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
      const studentList = payments.map(p => 
        `• ${p.studentName} (${p.studentRoll}): ₹${p.amount} for ${p.month} ${p.year}`
      ).join('\n')

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'hassancitycollege222@gmail.com', // Your admin email
          name: 'Admin',
          message: `📋 BULK PAYMENT CONFIRMED - ${payments.length} Students\n\n${studentList}\n\nTotal Amount: ₹${totalAmount.toLocaleString()}\nDate: ${new Date().toLocaleDateString()}`,
          rollNumber: 'BULK',
          pendingAmount: totalAmount,
          course: 'Bulk Fee Payment',
          overdueDays: 0
        })
      });

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Bulk payment confirmation email error:', error);
      return false;
    }
  }

  const filteredFees = pendingFees.filter(fee => {
    if (filterCourse !== 'all' && fee.students.course !== filterCourse) return false
    if (filterMonth !== 'all' && fee.month !== filterMonth) return false
    if (filterYear !== 'all' && fee.year !== parseInt(filterYear)) return false
    return true
  })

  const uniqueCourses = [...new Set(pendingFees.map(fee => fee.students.course))]

  const togglePaymentStatus = (feeId: string, paid: boolean) => {
    setPaymentUpdates(prev => 
      prev.map(update => 
        update.feeId === feeId 
          ? { ...update, paid, challanNumber: paid ? update.challanNumber : '' }
          : update
      )
    )
  }

  const updateChallanNumber = (feeId: string, challanNumber: string) => {
    setPaymentUpdates(prev => 
      prev.map(update => 
        update.feeId === feeId 
          ? { ...update, challanNumber }
          : update
      )
    )
  }

  const bulkMarkAsPaid = async () => {
    const paidUpdates = paymentUpdates.filter(update => update.paid)
    
    if (paidUpdates.length === 0) {
      alert('Please select at least one fee to mark as paid')
      return
    }

    // Validate challan numbers for paid fees
    const missingChallan = paidUpdates.filter(update => !update.challanNumber.trim())
    if (missingChallan.length > 0) {
      const proceed = confirm(
        `${missingChallan.length} selected fees don't have challan numbers. Continue without challan numbers?`
      )
      if (!proceed) return
    }

    setUpdating(true)

    try {
      const paymentDetails = []
      
      for (const update of paidUpdates) {
        const { error } = await supabase
          .from('fee_records')
          .update({ 
            status: 'paid',
            payment_date: new Date().toISOString().split('T')[0],
            challan_number: update.challanNumber || null
          })
          .eq('id', update.feeId)

        if (error) throw error
        
        // Collect payment details for email
        const fee = pendingFees.find(f => f.id === update.feeId)
        if (fee) {
          paymentDetails.push({
            studentName: fee.students.name,
            studentRoll: fee.students.roll_number,
            amount: update.amount,
            paymentDate: new Date().toISOString(),
            challanNumber: update.challanNumber || undefined,
            month: update.month,
            year: update.year
          })
        }
      }

      // ✅ Send bulk payment confirmation email
      const emailSent = await sendBulkPaymentConfirmationEmail(paymentDetails)

      alert(`✅ Successfully marked ${paidUpdates.length} fees as paid! ${emailSent ? 'Confirmation email sent to admin.' : '(Email notification failed)'}`)
      router.push('/dashboard/fees')
    } catch (error) {
      console.error('Error updating fees:', error)
      alert('Error updating fees. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const selectAll = () => {
    setPaymentUpdates(prev => 
      prev.map(update => ({ ...update, paid: true }))
    )
  }

  const clearAll = () => {
    setPaymentUpdates(prev => 
      prev.map(update => ({ ...update, paid: false, challanNumber: '' }))
    )
  }

  const selectByCourse = (course: string) => {
    setPaymentUpdates(prev => 
      prev.map(update => {
        const fee = pendingFees.find(f => f.id === update.feeId)
        return fee?.students.course === course 
          ? { ...update, paid: true }
          : update
      })
    )
  }

  const getSelectedCount = () => {
    return paymentUpdates.filter(update => update.paid).length
  }

  const getTotalSelectedAmount = () => {
    return paymentUpdates
      .filter(update => update.paid)
      .reduce((sum, update) => sum + update.amount, 0)
  }

  const generateBulkChallanNumbers = () => {
    let studentsToProcess = paymentUpdates.filter(update => update.paid)
    
    // If no students selected, ask if they want to select all
    if (studentsToProcess.length === 0) {
      const confirmSelectAll = confirm('No students selected for challan generation. Would you like to select ALL pending fees and generate challan numbers?')
      
      if (confirmSelectAll) {
        // Select all students
        const updatedPayments = paymentUpdates.map(update => ({ ...update, paid: true }))
        setPaymentUpdates(updatedPayments)
        studentsToProcess = updatedPayments
      } else {
        return // User cancelled
      }
    }

    const baseChallan = `CH${currentYear}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
    
    // Generate unique challan numbers
    let challanCounter = 1
    const updatedPayments = paymentUpdates.map(update => {
      if (update.paid) {
        return {
          ...update,
          challanNumber: `${baseChallan}${String(challanCounter++).padStart(3, '0')}`
        }
      }
      return update
    })
    
    setPaymentUpdates(updatedPayments)
    alert(`✅ Generated challan numbers for ${studentsToProcess.length} students!`)
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading pending fees...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Bulk Payment Update</h1>
              <p className={styles.subtitle}>Mark multiple fees as paid at once</p>
            </div>
            <Link href="/dashboard/fees" className={styles.addButton}>
              ← Back to Fees
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Statistics */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{pendingFees.length}</h3>
              <p className={styles.statLabel}>Total Pending</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{getSelectedCount()}</h3>
              <p className={styles.statLabel}>Selected</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{getTotalSelectedAmount().toLocaleString()}</h3>
              <p className={styles.statLabel}>Selected Amount</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{filteredFees.length}</h3>
              <p className={styles.statLabel}>Filtered</p>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className={styles.bulkActions}>
            <h3>Quick Selection</h3>
            <div className={styles.actionButtons}>
              <button onClick={selectAll} className={styles.actionButton}>
                Select All ({pendingFees.length})
              </button>
              <button onClick={clearAll} className={styles.actionButton}>
                Clear All
              </button>
              <button onClick={generateBulkChallanNumbers} className={styles.actionButton}>
                🔢 Generate Challan Numbers
              </button>
              
              {/* Course-specific selection */}
              {uniqueCourses.map(course => (
                <button 
                  key={course}
                  onClick={() => selectByCourse(course)}
                  className={styles.courseButton}
                >
                  Select {course}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className={styles.filtersSection}>
            <div className={styles.filterGroup}>
              <label>Course:</label>
              <select 
                value={filterCourse} 
                onChange={(e) => setFilterCourse(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Courses</option>
                {uniqueCourses.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Month:</label>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
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
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Table */}
          <div className={styles.paymentSection}>
            <div className={styles.sectionHeader}>
              <h2>Pending Fees ({filteredFees.length})</h2>
              <div className={styles.selectedInfo}>
                <strong>{getSelectedCount()}</strong> selected • 
                Total: <strong>₹{getTotalSelectedAmount().toLocaleString()}</strong>
              </div>
            </div>

            {filteredFees.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No pending fees found for the selected filters.</p>
                <Link href="/dashboard/fees" className={styles.addButton}>
                  View All Fees
                </Link>
              </div>
            ) : (
              <>
                <div className={styles.paymentTable}>
                  <div className={styles.tableHeader}>
                    <div style={{ width: '50px' }}>Paid</div>
                    <div>Student</div>
                    <div>Amount</div>
                    <div>Month</div>
                    <div>Due Date</div>
                    <div>Challan Number</div>
                  </div>
                  <div className={styles.tableBody}>
                    {filteredFees.map((fee) => {
                      const paymentUpdate = paymentUpdates.find(p => p.feeId === fee.id)
                      return (
                        <div key={fee.id} className={styles.paymentRow}>
                          <div className={styles.checkboxCell}>
                            <input
                              type="checkbox"
                              checked={paymentUpdate?.paid || false}
                              onChange={(e) => togglePaymentStatus(fee.id, e.target.checked)}
                              className={styles.paymentCheckbox}
                            />
                          </div>
                          <div className={styles.studentInfo}>
                            <div className={styles.studentName}>{fee.students.name}</div>
                            <div className={styles.studentDetails}>
                              {fee.students.roll_number} • {fee.students.course}
                            </div>
                            <div className={styles.contactInfo}>
                              {fee.students.phone} • {fee.students.email}
                            </div>
                          </div>
                          <div className={styles.amount}>
                            ₹{fee.amount.toLocaleString()}
                          </div>
                          <div className={styles.monthYear}>
                            {fee.month} {fee.year}
                          </div>
                          <div className={styles.dueDate}>
                            {new Date(fee.due_date).toLocaleDateString()}
                          </div>
                          <div className={styles.challanInput}>
                            <input
                              type="text"
                              value={paymentUpdate?.challanNumber || ''}
                              onChange={(e) => updateChallanNumber(fee.id, e.target.value)}
                              placeholder="Enter challan number"
                              className={styles.challanField}
                              disabled={!paymentUpdate?.paid}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Update Button */}
                <div className={styles.updateActions}>
                  <button 
                    onClick={bulkMarkAsPaid}
                    disabled={updating || getSelectedCount() === 0}
                    className={styles.updateButton}
                  >
                    {updating ? (
                      <>
                        <span className={styles.spinner}></span>
                        Updating {getSelectedCount()} Payments...
                      </>
                    ) : (
                      `Mark ${getSelectedCount()} Fees as Paid`
                    )}
                  </button>
                  <div className={styles.updateSummary}>
                    <p>
                      <strong>{getSelectedCount()}</strong> fees selected • 
                      Total Amount: <strong>₹{getTotalSelectedAmount().toLocaleString()}</strong>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      ✅ Email confirmation will be sent to admin for all payments
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}