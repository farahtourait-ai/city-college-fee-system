'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './defaulters.module.css'

interface FeeRecord {
  id: string
  amount: number
  due_date: string
  academic_year: string
  status: string
  month: string
  year: number
}

interface Defaulter {
  id: string
  roll_number: string
  name: string
  email: string
  phone: string
  course: string
  created_at: string
  total_pending: number
  overdue_days: number
  fee_records: FeeRecord[]
}

export default function DefaultersPage() {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([])
  const [filteredDefaulters, setFilteredDefaulters] = useState<Defaulter[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchDefaulters()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDefaulters(defaulters)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = defaulters.filter(defaulter =>
        defaulter.roll_number.toLowerCase().includes(query) ||
        defaulter.name.toLowerCase().includes(query) ||
        defaulter.course.toLowerCase().includes(query) ||
        defaulter.phone.includes(query) ||
        defaulter.email.toLowerCase().includes(query)
      )
      setFilteredDefaulters(filtered)
    }
  }, [searchQuery, defaulters])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchDefaulters = async () => {
    try {
      console.log('🔄 Fetching defaulters...')
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          roll_number,
          name,
          email,
          phone,
          course,
          enrollment_date,
          fee_records (
            id,
            amount,
            due_date,
            academic_year,
            status,
            month,
            year
          )
        `)

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        throw studentsError
      }

      console.log(`✅ Loaded ${studentsData?.length || 0} students`)

      const defaultersList = studentsData
        .map(student => {
          const feeRecords = student.fee_records || []
          const pendingFees = feeRecords.filter((fee: FeeRecord) => fee.status === 'pending')
          const totalPending = pendingFees.reduce((sum: number, fee: FeeRecord) => sum + fee.amount, 0)
          
          let overdueDays = 0
          if (pendingFees.length > 0) {
            const sortedPending = pendingFees.sort((a: FeeRecord, b: FeeRecord) => 
              new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            )
            
            const earliestPending = sortedPending[0]
            const dueDate = new Date(earliestPending.due_date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            dueDate.setHours(0, 0, 0, 0)
            overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
          }

          return {
            id: student.id,
            roll_number: student.roll_number,
            name: student.name,
            email: student.email || 'No email',
            phone: student.phone || 'No phone',
            course: student.course || 'No course',
            created_at: student.enrollment_date || new Date().toISOString(),
            total_pending: totalPending,
            overdue_days: overdueDays,
            fee_records: pendingFees
          }
        })
        .filter(student => student.total_pending > 0)
        .sort((a, b) => b.total_pending - a.total_pending)

      console.log(`✅ Found ${defaultersList.length} defaulters`)
      setDefaulters(defaultersList)
      setFilteredDefaulters(defaultersList)
    } catch (error) {
      console.error('Error fetching defaulters:', error)
      setDefaulters([])
      setFilteredDefaulters([])
    } finally {
      setLoading(false)
    }
  }

  // Send individual email reminder to defaulter
  const sendEmailReminder = async (defaulter: Defaulter) => {
    if (!defaulter.email || defaulter.email === 'No email') {
      alert(`❌ Cannot send email: No email address for ${defaulter.name}`)
      return
    }

    const confirmSend = window.confirm(
      `Send email reminder to ${defaulter.name}?\n\n` +
      `Email: ${defaulter.email}\n` +
      `Pending Amount: ₹${defaulter.total_pending.toLocaleString()}\n` +
      `Overdue: ${defaulter.overdue_days} days`
    )
    
    if (!confirmSend) return

    try {
      // Send email using your existing API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: defaulter.email,
          name: defaulter.name,
          message: `Dear ${defaulter.name}, this is a reminder that your fee payment of ₹${defaulter.total_pending} is pending at City Computer College. Please visit the college office at your earliest convenience. Roll Number: ${defaulter.roll_number}`,
          rollNumber: defaulter.roll_number,
          course: defaulter.course,
          pendingAmount: defaulter.total_pending,
          overdueDays: defaulter.overdue_days
        })
      })

      const result = await response.json()

      // Log reminder in database
      const { error } = await supabase
        .from('reminders')
        .insert({
          student_id: defaulter.id,
          student_name: defaulter.name,
          amount: defaulter.total_pending,
          sent_at: new Date().toISOString(),
          reminder_type: 'email_reminder',
          email_sent: true,
          email_status: result.success ? 'sent' : 'failed'
        })

      if (error) {
        console.error('Error logging reminder:', error)
      }

      if (result.success) {
        alert(`✅ Email sent to ${defaulter.name}!\n\nEmail: ${defaulter.email}\nAmount: ₹${defaulter.total_pending.toLocaleString()}`)
      } else {
        alert(`❌ Email failed: ${result.error || 'Unknown error'}`)
      }

    } catch (error) {
      console.error('Email error:', error)
      alert('Failed to send email. Please try again.')
    }
  }

  const refreshDefaulters = () => {
    setLoading(true)
    setSearchQuery('')
    fetchDefaulters()
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  // Calculate statistics
  const totalPendingAmount = filteredDefaulters.reduce((sum, defaulter) => sum + defaulter.total_pending, 0)
  const criticalDefaulters = filteredDefaulters.filter(d => d.overdue_days > 30).length
  const recentDefaulters = filteredDefaulters.filter(d => d.overdue_days <= 7).length

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className="container">
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.title}>Defaulters List</h1>
                <p className={styles.subtitle}>Students with pending fees</p>
              </div>
              <Link href="/dashboard/fees" className={styles.addButton}>
                View All Fees
              </Link>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className="container">
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}>Loading defaulters list...</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Defaulters List</h1>
              <p className={styles.subtitle}>Students with pending fees</p>
            </div>
            <div className={styles.headerActions}>
              <button 
                onClick={refreshDefaulters} 
                className={styles.refreshButton}
              >
                🔄 Refresh
              </button>
              <Link href="/dashboard/fees" className={styles.addButton}>
                View All Fees
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Statistics Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{filteredDefaulters.length}</h3>
              <p className={styles.statLabel}>Showing</p>
              <small className={styles.statSubtext}>of {defaulters.length} total</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{totalPendingAmount.toLocaleString()}</h3>
              <p className={styles.statLabel}>Total Pending</p>
              <small className={styles.statSubtext}>Amount awaiting collection</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{criticalDefaulters}</h3>
              <p className={styles.statLabel}>Overdue 30+ Days</p>
              <small className={styles.statSubtext}>Critical defaulters</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{recentDefaulters}</h3>
              <p className={styles.statLabel}>Recent Defaulters</p>
              <small className={styles.statSubtext}>Within 7 days</small>
            </div>
          </div>

          {/* Search Bar */}
          <div className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by roll number, name, course, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button 
                  onClick={clearSearch}
                  className={styles.clearSearchButton}
                >
                  ✕
                </button>
              )}
              <div className={styles.searchInfo}>
                <span>
                  Showing {filteredDefaulters.length} of {defaulters.length} defaulters
                  {searchQuery && ` for "${searchQuery}"`}
                </span>
              </div>
            </div>
          </div>

          {/* Defaulters List */}
          <div className={styles.defaultersSection}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Defaulters ({filteredDefaulters.length})</h2>
                <p className={styles.sectionSubtitle}>
                  {searchQuery 
                    ? `Search results for "${searchQuery}"`
                    : 'Students with outstanding fee payments'
                  }
                </p>
              </div>
              <div className={styles.sectionActions}>
                <button 
                  onClick={refreshDefaulters} 
                  className={styles.refreshButtonSmall}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {filteredDefaulters.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  {searchQuery ? '🔍' : '🎉'}
                </div>
                <h3>
                  {searchQuery 
                    ? `No defaulters found for "${searchQuery}"`
                    : 'No Defaulters Found!'
                  }
                </h3>
                <p>
                  {searchQuery
                    ? 'Try a different search term or clear the search'
                    : 'All students have cleared their fees. Great job!'
                  }
                </p>
              </div>  
            ) : (
              <div className={styles.defaultersList}>
                {filteredDefaulters.map((defaulter) => (
                  <div key={defaulter.id} className={styles.defaulterCard}>
                    <div className={styles.defaulterHeader}>
                      <div className={styles.defaulterInfo}>
                        <div className={styles.avatarPlaceholder}>
                          {defaulter.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.studentTextInfo}>
                          <h3 className={styles.defaulterName}>
                            {defaulter.name}
                          </h3>
                          <p className={styles.defaulterDetails}>
                            <span>{defaulter.roll_number}</span>
                            • 
                            <span>{defaulter.course}</span>
                          </p>
                          <p className={styles.defaulterContact}>
                            {defaulter.email && defaulter.email !== 'No email' && (
                              <span className={styles.emailHighlight}>✉️ {defaulter.email}</span>
                            )}
                            {defaulter.phone && defaulter.phone !== 'No phone' && (
                              <span className={styles.phoneText}>📱 {defaulter.phone}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={styles.pendingAmount}>
                        <div className={styles.amount}>₹{defaulter.total_pending.toLocaleString()}</div>
                        <div className={styles.amountLabel}>Total Pending</div>
                      </div>
                    </div>

                    <div className={styles.defaulterMeta}>
                      <div className={styles.metaItem}>
                        <strong>Overdue:</strong> 
                        <span className={
                          defaulter.overdue_days > 60 ? styles.overdueCritical : 
                          defaulter.overdue_days > 30 ? styles.overdueWarning : 
                          styles.overdueNormal
                        }>
                          {defaulter.overdue_days} days
                          {defaulter.overdue_days > 30 && ' ⚠️'}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <strong>Pending Records:</strong> 
                        <span className={styles.recordCount}>{defaulter.fee_records.length}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <strong>Contact:</strong> 
                        <span className={
                          defaulter.email && defaulter.email !== 'No email' 
                            ? styles.hasEmail 
                            : styles.noEmail
                        }>
                          {defaulter.email && defaulter.email !== 'No email' ? 'Email ✓' : 'No Email'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.defaulterActions}>
                      <button 
                        onClick={() => sendEmailReminder(defaulter)}
                        className={styles.emailButton}
                        disabled={!defaulter.email || defaulter.email === 'No email'}
                      >
                        ✉️ Email Reminder
                      </button>
                      <Link 
                        href={`/dashboard/students/${defaulter.id}`}
                        className={styles.viewButton}
                      >
                        View Student
                      </Link>
                      <Link 
                        href={`/dashboard/fees/add?student=${defaulter.id}`}
                        className={styles.addFeeButton}
                      >
                        Add Payment
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {filteredDefaulters.length > 0 && (
            <div className={styles.summaryFooter}>
              <div className={styles.summaryStats}>
                <p>
                  <strong>Summary:</strong> {filteredDefaulters.length} defaulters 
                  {searchQuery && ` matching "${searchQuery}"`} • 
                  ₹{totalPendingAmount.toLocaleString()} pending
                </p>
                <div className={styles.summaryDetails}>
                  <span className={styles.summaryItem}>📧 With Email: {filteredDefaulters.filter(d => d.email && d.email !== 'No email').length}</span>
                  <span className={styles.summaryItem}>📱 With Phone: {filteredDefaulters.filter(d => d.phone && d.phone !== 'No phone').length}</span>
                  <span className={styles.summaryItem}>⚠️ Critical: {criticalDefaulters}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}