'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './notifications.module.css'

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

interface NotificationLog {
  id: string
  student_id: string
  type: string
  status: string
  sent_at: string
  students: {
    name: string
    roll_number: string
  }
}

export default function NotificationsPage() {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([])
  const [filteredDefaulters, setFilteredDefaulters] = useState<Defaulter[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [notificationType, setNotificationType] = useState('email')
  const [sendResults, setSendResults] = useState<{
    success: number;
    failed: number;
    details: Array<{name: string; type: string; status: string; error?: string}>
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const router = useRouter()

  // Default message template
  const defaultMessage = `Dear Student,

This is a reminder from City Computer College regarding your pending fees.

Please clear your dues at the earliest to avoid any inconvenience.

Thank you,
College Administration
City Computer College`

  useEffect(() => {
    checkAuth()
    fetchDefaulters()
    fetchNotificationLogs()
  }, [])

  // Filter defaulters when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDefaulters(defaulters)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = defaulters.filter(defaulter => {
        const rollNumber = defaulter.roll_number || ''
        const name = defaulter.name || ''
        const course = defaulter.course || ''
        const phone = defaulter.phone || ''
        const email = defaulter.email || ''
        
        return (
          rollNumber.toLowerCase().includes(query) ||
          name.toLowerCase().includes(query) ||
          course.toLowerCase().includes(query) ||
          phone.includes(query) ||
          email.toLowerCase().includes(query)
        )
      })
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
      setMessage(generateDynamicMessage(defaultersList))
    } catch (error) {
      console.error('Error fetching defaulters:', error)
      setDefaulters([])
      setFilteredDefaulters([])
    } finally {
      setLoading(false)
    }
  }

  const fetchNotificationLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          students (
            name,
            roll_number
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotificationLogs(data || [])
    } catch (error) {
      console.error('Error fetching notification logs:', error)
    }
  }

  const generateDynamicMessage = (defaultersList: Defaulter[]) => {
    if (defaultersList.length === 0) return defaultMessage

    const totalPending = defaultersList.reduce((sum, def) => sum + def.total_pending, 0)
    const maxOverdue = Math.max(...defaultersList.map(def => def.overdue_days))

    return `Dear Student,

This is a reminder from City Computer College regarding your pending fees.

Please clear your outstanding dues of ₹${totalPending.toLocaleString()} at the earliest to avoid any inconvenience.

You can make the payment at the college office during working hours.

Thank you,
College Administration
City Computer College
📞 Contact: 9876543210
🏫 Office Hours: 9 AM - 5 PM (Mon-Fri)`
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAllStudents = () => {
    const idsToSelect = filteredDefaulters.map(def => def.id)
    setSelectedStudents(idsToSelect)
  }

  const clearSelection = () => {
    setSelectedStudents([])
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const sendNotifications = async () => {
    if (selectedStudents.length === 0) {
      alert('Please select at least one student')
      return
    }

    if (!message.trim()) {
      alert('Please enter a message')
      return
    }

    setSending(true)
    setSendResults(null)

    const selectedDefaulters = defaulters.filter(def => selectedStudents.includes(def.id))
    const results = {
      success: 0,
      failed: 0,
      details: [] as Array<{name: string; type: string; status: string; error?: string}>
    }

    try {
      for (const defaulter of selectedDefaulters) {
        try {
          let sendSuccess = false
          let errorMessage = ''

          // Send REAL notification based on type
          if (notificationType === 'email' && defaulter.email && defaulter.email !== 'No email') {
            const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: defaulter.email,
                name: defaulter.name,
                message: formatMessageForStudent(defaulter),
                rollNumber: defaulter.roll_number,
                course: defaulter.course || '',
                pendingAmount: defaulter.total_pending,
                overdueDays: defaulter.overdue_days
              })
            })

            const result = await response.json()
            
            if (response.ok && result.success) {
              sendSuccess = true
            } else {
              errorMessage = result.error || 'Failed to send email'
            }
          } 
          else if (notificationType === 'sms' && defaulter.phone && defaulter.phone !== 'No phone') {
            const response = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: defaulter.phone,
                name: defaulter.name,
                message: formatMessageForStudent(defaulter),
                rollNumber: defaulter.roll_number,
                pendingAmount: defaulter.total_pending,
                overdueDays: defaulter.overdue_days
              })
            })

            const result = await response.json()
            
            if (response.ok && result.success) {
              sendSuccess = true
              if (result.simulated) {
                errorMessage = 'SMS simulation mode - Add real SMS service'
                sendSuccess = true
              }
            } else {
              errorMessage = result.error || 'Failed to send SMS'
            }
          }
          else {
            errorMessage = notificationType === 'email' 
              ? 'No email address' 
              : 'No phone number'
          }

          // Log to database if sending was successful
          if (sendSuccess) {
            const { error } = await supabase
              .from('notification_logs')
              .insert([
                {
                  student_id: defaulter.id,
                  type: notificationType,
                  status: 'sent',
                  message: formatMessageForStudent(defaulter),
                  sent_at: new Date().toISOString()
                }
              ])

            if (!error) {
              results.success++
              results.details.push({
                name: defaulter.name,
                type: notificationType,
                status: '✅ Sent'
              })
            } else {
              results.failed++
              results.details.push({
                name: defaulter.name,
                type: notificationType,
                status: '❌ Failed',
                error: 'Database error'
              })
            }
          } else {
            results.failed++
            results.details.push({
              name: defaulter.name,
              type: notificationType,
              status: '❌ Failed',
              error: errorMessage
            })
          }

          await new Promise(resolve => setTimeout(resolve, 300))

        } catch (error: any) {
          console.error(`Error sending to ${defaulter.name}:`, error)
          results.failed++
          results.details.push({
            name: defaulter.name,
            type: notificationType,
            status: '❌ Failed',
            error: error.message || 'Unknown error'
          })
        }
      }

      setSendResults(results)
      fetchNotificationLogs()
      
      if (results.failed === 0) {
        setSelectedStudents([])
      }

    } catch (error) {
      console.error('Error in sendNotifications:', error)
      alert('Error sending notifications. Please check console for details.')
    } finally {
      setSending(false)
    }
  }

  const getSelectedStudentsCount = () => {
    return selectedStudents.length
  }

  const getTotalPendingForSelected = () => {
    return defaulters
      .filter(def => selectedStudents.includes(def.id))
      .reduce((sum, def) => sum + def.total_pending, 0)
  }

  const formatMessageForStudent = (student: Defaulter) => {
    return message
      .replace(/{student_name}/g, student.name)
      .replace(/{roll_number}/g, student.roll_number)
      .replace(/{course}/g, student.course || '')
      .replace(/{pending_amount}/g, `₹${student.total_pending.toLocaleString()}`)
      .replace(/{overdue_days}/g, student.overdue_days.toString())
  }

  // Calculate statistics
  const totalPendingAmount = filteredDefaulters.reduce((sum, defaulter) => sum + defaulter.total_pending, 0)
  const defaultersWithEmail = filteredDefaulters.filter(d => d.email && d.email !== 'No email').length
  const defaultersWithPhone = filteredDefaulters.filter(d => d.phone && d.phone !== 'No phone').length

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className="container">
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.title}>Fee Reminders</h1>
                <p className={styles.subtitle}>Send automatic notifications to defaulters</p>
              </div>
              <Link href="/dashboard" className={styles.backButton}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className="container">
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}>Loading notifications...</div>
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
              <h1 className={styles.title}>Fee Reminders</h1>
              <p className={styles.subtitle}>Send automatic notifications to defaulters</p>
            </div>
            <Link href="/dashboard" className={styles.backButton}>
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>
      
      <main className={styles.main}>
        <div className="container">
          {/* Statistics */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{filteredDefaulters.length}</h3>
              <p className={styles.statLabel}>Showing</p>
              <small className={styles.statSubtext}>of {defaulters.length} total</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{getSelectedStudentsCount()}</h3>
              <p className={styles.statLabel}>Selected</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{totalPendingAmount.toLocaleString()}</h3>
              <p className={styles.statLabel}>Total Pending</p>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{notificationLogs.length}</h3>
              <p className={styles.statLabel}>Total Sent</p>
            </div>
          </div>

          {/* Search Section */}
          <div className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search defaulters by roll number, name, course, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button 
                  onClick={clearSearch}
                  className={styles.clearSearchButton}
                  title="Clear search"
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
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

          {/* Send Results Summary */}
          {sendResults && (
            <div className={styles.resultsSummary}>
              <div className={sendResults.failed > 0 ? styles.resultsWarning : styles.resultsSuccess}>
                <h3>
                  {sendResults.failed === 0 ? '✅ All notifications sent successfully!' : '⚠️ Send Results'}
                </h3>
                <p>
                  <strong>Success:</strong> {sendResults.success} | 
                  <strong> Failed:</strong> {sendResults.failed}
                </p>
                
                {sendResults.details.length > 0 && (
                  <div className={styles.resultsDetails}>
                    {sendResults.details.map((detail, index) => (
                      <div key={index} className={detail.status.includes('✅') ? styles.resultSuccess : styles.resultFailed}>
                        <strong>{detail.name}</strong> - {detail.type.toUpperCase()}: {detail.status}
                        {detail.error && <span> ({detail.error})</span>}
                      </div>
                    ))}
                  </div>
                )}
                
                <button 
                  onClick={() => setSendResults(null)}
                  className={styles.closeResultsButton}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <div className={styles.contentGrid}>
            {/* Left: Student Selection */}
            <div className={styles.studentsSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Select Defaulters ({filteredDefaulters.length})</h2>
                  <p className={styles.sectionSubtitle}>
                    {searchQuery 
                      ? `Search results for "${searchQuery}"`
                      : 'Select students to send notifications'
                    }
                  </p>
                </div>
                <div className={styles.selectionActions}>
                  <button onClick={selectAllStudents} className={styles.selectAllButton}>
                    Select All
                  </button>
                  <button onClick={clearSelection} className={styles.clearButton}>
                    Clear All
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
                  {searchQuery && (
                    <button 
                      onClick={clearSearch}
                      className={styles.clearSearchBtn}
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.studentsList}>
                  {filteredDefaulters.map((defaulter) => {
                    const rollNumber = defaulter.roll_number || ''
                    const name = defaulter.name || ''
                    const course = defaulter.course || ''
                    const phone = defaulter.phone || ''
                    const email = defaulter.email || ''
                    
                    return (
                      <div
                        key={defaulter.id}
                        className={`${styles.studentCard} ${
                          selectedStudents.includes(defaulter.id) ? styles.selected : ''
                        }`}
                        onClick={() => toggleStudentSelection(defaulter.id)}
                      >
                        <div className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(defaulter.id)}
                            onChange={() => {}}
                            readOnly
                          />
                        </div>
                        <div className={styles.studentInfo}>
                          <h4>
                            {name}
                            {searchQuery && name.toLowerCase().includes(searchQuery.toLowerCase()) && (
                              <span className={styles.highlightMatch}> 🔍</span>
                            )}
                          </h4>
                          <p>
                            <span className={
                              searchQuery && rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) 
                                ? styles.highlightText 
                                : ''
                            }>
                              {rollNumber || 'No roll number'}
                            </span>
                            {' • '}
                            <span className={
                              searchQuery && course.toLowerCase().includes(searchQuery.toLowerCase()) 
                                ? styles.highlightText 
                                : ''
                            }>
                              {course || 'No course'}
                            </span>
                          </p>
                          <p className={styles.contact}>
                            {email && email !== 'No email' && (
                              <span className={
                                searchQuery && email.toLowerCase().includes(searchQuery.toLowerCase()) 
                                  ? styles.highlightText 
                                  : ''
                              }>
                                📧 {email}
                              </span>
                            )}
                            {email && email !== 'No email' && phone && phone !== 'No phone' && <span> • </span>}
                            {phone && phone !== 'No phone' && (
                              <span className={
                                searchQuery && phone.includes(searchQuery) 
                                  ? styles.highlightText 
                                  : ''
                              }>
                                📱 {phone}
                              </span>
                            )}
                            {(!phone || phone === 'No phone') && (!email || email === 'No email') && <span>No contact info</span>}
                          </p>
                          <div className={styles.feeDetails}>
                            <span className={styles.amount}>₹{defaulter.total_pending.toLocaleString()}</span>
                            <span className={styles.overdue}>
                              {defaulter.overdue_days} day{defaulter.overdue_days !== 1 ? 's' : ''} overdue
                              {defaulter.overdue_days > 30 && ' ⚠️'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Notification Controls */}
            <div className={styles.notificationSection}>
              <div className={styles.controlsCard}>
                <h3>Send Notifications</h3>
                
                {/* Notification Type */}
                <div className={styles.controlGroup}>
                  <label>Notification Type:</label>
                  <div className={styles.typeButtons}>
                    <button
                      className={`${styles.typeButton} ${notificationType === 'email' ? styles.active : ''}`}
                      onClick={() => setNotificationType('email')}
                    >
                      📧 Email
                    </button>
                    <button
                      className={`${styles.typeButton} ${notificationType === 'sms' ? styles.active : ''}`}
                      onClick={() => setNotificationType('sms')}
                    >
                      📱 SMS
                    </button>
                  </div>
                  <small className={styles.helperText}>
                    {notificationType === 'email' 
                      ? `Emails will be sent to ${defaultersWithEmail} students with email addresses`
                      : `SMS will be sent to ${defaultersWithPhone} students with phone numbers`}
                  </small>
                </div>

                {/* Message Editor */}
                <div className={styles.controlGroup}>
                  <label>Message Template:</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={styles.messageInput}
                    rows={8}
                    placeholder="Enter your notification message..."
                  />
                  <small className={styles.helperText}>
                    Variables: <code>{`{student_name}`}</code>, <code>{`{roll_number}`}</code>, 
                    <code>{`{course}`}</code>, <code>{`{pending_amount}`}</code>, <code>{`{overdue_days}`}</code>
                  </small>
                </div>

                {/* Preview for Selected Student */}
                {selectedStudents.length === 1 && (
                  <div className={styles.controlGroup}>
                    <label>Preview for selected student:</label>
                    <div className={styles.previewBox}>
                      {formatMessageForStudent(defaulters.find(d => d.id === selectedStudents[0])!)}
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <div className={styles.sendActions}>
                  <button
                    onClick={sendNotifications}
                    disabled={sending || selectedStudents.length === 0}
                    className={styles.sendButton}
                  >
                    {sending ? (
                      <>
                        <span className={styles.spinner}></span>
                        Sending... ({selectedStudents.length} {notificationType}s)
                      </>
                    ) : (
                      `Send ${selectedStudents.length} ${notificationType}(s)`
                    )}
                  </button>
                  
                  <div className={styles.sendInfo}>
                    <p>Selected: <strong>{getSelectedStudentsCount()}</strong> students</p>
                    <p>Total Amount: <strong>₹{getTotalPendingForSelected().toLocaleString()}</strong></p>
                    {notificationType === 'email' && (
                      <p className={styles.contactCount}>
                        {defaulters.filter(d => selectedStudents.includes(d.id) && d.email && d.email !== 'No email').length} have email
                      </p>
                    )}
                    {notificationType === 'sms' && (
                      <p className={styles.contactCount}>
                        {defaulters.filter(d => selectedStudents.includes(d.id) && d.phone && d.phone !== 'No phone').length} have phone
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notification History */}
              <div className={styles.historyCard}>
                <h3>Recent Notifications</h3>
                {notificationLogs.length === 0 ? (
                  <p className={styles.noHistory}>No notifications sent yet.</p>
                ) : (
                  <div className={styles.historyList}>
                    {notificationLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className={styles.historyItem}>
                        <div className={styles.historyHeader}>
                          <span className={styles.studentName}>{log.students.name}</span>
                          <span className={styles.logType}>
                            {log.type === 'email' ? '📧' : '📱'} {log.type.toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.historyDetails}>
                          <span>{log.students.roll_number}</span>
                          <span className={styles.sentTime}>
                            {new Date(log.sent_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notificationLogs.length > 10 && (
                  <p className={styles.showingText}>
                    Showing 10 of {notificationLogs.length} notifications
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className={styles.setupInstructions}>
            <h4>Setup Instructions</h4>
            <ol>
              <li><strong>Email:</strong> Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local</li>
              <li><strong>SMS:</strong> For real SMS, sign up for Twilio, TextLocal, or Fast2SMS</li>
              <li>Update API keys in your .env.local file</li>
              <li>Restart your development server: <code>npm run dev</code></li>
            </ol>
            <p className={styles.note}>
              <strong>Note:</strong> Currently in simulation mode. Add real API keys to send actual notifications.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}