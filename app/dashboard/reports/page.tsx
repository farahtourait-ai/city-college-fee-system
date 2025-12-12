'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './reports.module.css' // Create this new file

// Define proper TypeScript interfaces
interface MonthlyCollection {
  month: string
  year: number
  total: number
  paid: number
  pending: number
}

interface CourseReport {
  course: string
  totalStudents: number
  totalFees: number
  pendingFees: number
  collectionRate: number
}

interface YearlySummary {
  year: string
  total_collected: number
  total_pending: number
  student_count: number
}

interface TransactionReport {
  student_name: string
  roll_number: string
  amount: number
  month: string
  year: number
  payment_date: string
  status: string
  challan_number: string
}

interface AnalyticsData {
  monthlyCollections: MonthlyCollection[]
  courseWise: CourseReport[]
  yearlySummary: YearlySummary[]
  recentTransactions: TransactionReport[]
}

// Type for fee records from Supabase
interface FeeRecord {
  amount: number
  status: string
  month: string
  year: number
  payment_date?: string
  challan_number?: string
  student_id: string
}

export default function ReportsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    monthlyCollections: [],
    courseWise: [],
    yearlySummary: [],
    recentTransactions: []
  })
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [reportType, setReportType] = useState<'monthly' | 'course' | 'yearly' | 'transactions' | 'all'>('all')
  const [exporting, setExporting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchAnalyticsData()
  }, [dateRange, reportType])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      console.log('📊 Fetching analytics data...')

      const [
        monthlyData,
        courseData,
        yearlyData,
        transactionData
      ] = await Promise.all([
        fetchMonthlyCollections(),
        fetchCourseWiseReport(),
        fetchYearlySummary(),
        fetchRecentTransactions()
      ])

      setAnalyticsData({
        monthlyCollections: monthlyData,
        courseWise: courseData,
        yearlySummary: yearlyData,
        recentTransactions: transactionData
      })

    } catch (error) {
      console.error('Error fetching analytics data:', error)
      alert('Error loading analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyCollections = async (): Promise<MonthlyCollection[]> => {
    const { data, error } = await supabase
      .from('fee_records')
      .select(`
        amount,
        status,
        month,
        year
      `)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate)

    if (error) {
      console.error('Error fetching monthly data:', error)
      return []
    }

    const feeRecords = data as FeeRecord[]

    // Group by month and year
    const grouped = feeRecords.reduce((acc: Record<string, MonthlyCollection>, record) => {
      const key = `${record.month}_${record.year}`
      if (!acc[key]) {
        acc[key] = {
          month: record.month,
          year: record.year,
          total: 0,
          paid: 0,
          pending: 0
        }
      }
      
      acc[key].total += record.amount
      if (record.status === 'paid') {
        acc[key].paid += record.amount
      } else {
        acc[key].pending += record.amount
      }
      
      return acc
    }, {})

    const results = Object.values(grouped)
    
    // Sort by year and month
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    
    return results.sort((a: any, b: any) => {
      return (b.year - a.year) || (months.indexOf(b.month) - months.indexOf(a.month))
    }) as MonthlyCollection[]
  }

  interface StudentWithFees {
    id: string
    roll_number: string
    name: string
    course?: string
    course_fee?: number
  }

  const fetchCourseWiseReport = async (): Promise<CourseReport[]> => {
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, roll_number, name, course, course_fee')
      .eq('deleted', false)

    if (studentsError) {
      console.error('Error fetching students:', studentsError)
      return []
    }

    const students = studentsData as StudentWithFees[]

    const { data: feesData, error: feesError } = await supabase
      .from('fee_records')
      .select('amount, status, student_id')

    if (feesError) {
      console.error('Error fetching fees:', feesError)
      return []
    }

    const feeRecords = feesData as FeeRecord[]

    const courseMap = new Map<string, CourseReport>()

    students.forEach(student => {
      const courseName = student.course || 'No Course'
      if (!courseMap.has(courseName)) {
        courseMap.set(courseName, {
          course: courseName,
          totalStudents: 0,
          totalFees: 0,
          pendingFees: 0,
          collectionRate: 0
        })
      }

      const courseData = courseMap.get(courseName)!
      courseData.totalStudents++

      const studentFees = feeRecords.filter(fee => fee.student_id === student.id)
      
      studentFees.forEach(fee => {
        if (fee.status === 'paid') {
          courseData.totalFees += fee.amount
        } else {
          courseData.pendingFees += fee.amount
        }
      })

      const total = courseData.totalFees + courseData.pendingFees
      courseData.collectionRate = total > 0 
        ? Math.round((courseData.totalFees / total) * 100)
        : 0
    })

    return Array.from(courseMap.values()).sort((a, b) => b.totalFees - a.totalFees)
  }

  const fetchYearlySummary = async (): Promise<YearlySummary[]> => {
    const { data, error } = await supabase
      .from('fee_records')
      .select('amount, status, year, student_id')

    if (error) {
      console.error('Error fetching yearly data:', error)
      return []
    }

    const records = data as { amount: number; status: string; year: number; student_id: string }[]

    const yearMap = new Map<string, {
      year: string
      total_collected: number
      total_pending: number
      student_count: Set<string>
    }>()

    records.forEach(record => {
      const year = record.year.toString()
      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year: year,
          total_collected: 0,
          total_pending: 0,
          student_count: new Set<string>()
        })
      }

      const yearData = yearMap.get(year)!
      if (record.status === 'paid') {
        yearData.total_collected += record.amount
      } else {
        yearData.total_pending += record.amount
      }
      yearData.student_count.add(record.student_id)
    })

    return Array.from(yearMap.values())
      .map(item => ({
        year: item.year,
        total_collected: item.total_collected,
        total_pending: item.total_pending,
        student_count: item.student_count.size
      }))
      .sort((a, b) => parseInt(b.year) - parseInt(a.year))
  }

  const fetchRecentTransactions = async (): Promise<TransactionReport[]> => {
    const { data, error } = await supabase
      .from('fee_records')
      .select(`
        amount,
        status,
        month,
        year,
        payment_date,
        challan_number,
        student_id
      `)
      .order('payment_date', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching transaction data:', error)
      return []
    }

    const transactions = data as FeeRecord[]

    if (transactions.length === 0) {
      return []
    }

    const studentIds = [...new Set(transactions.map(t => t.student_id))]
    
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, roll_number')
      .in('id', studentIds)

    if (studentsError) {
      console.error('Error fetching students for transactions:', studentsError)
      return []
    }

    const students = studentsData as { id: string; name: string; roll_number: string }[]
    const studentMap = new Map<string, { name: string; roll_number: string }>()
    students.forEach(student => {
      studentMap.set(student.id, {
        name: student.name,
        roll_number: student.roll_number
      })
    })

    return transactions.map(record => {
      const studentInfo = studentMap.get(record.student_id) || { name: 'Unknown', roll_number: 'N/A' }
      return {
        student_name: studentInfo.name,
        roll_number: studentInfo.roll_number,
        amount: record.amount || 0,
        month: record.month || '',
        year: record.year || 0,
        payment_date: record.payment_date || 'N/A',
        status: record.status || '',
        challan_number: record.challan_number || 'N/A'
      }
    })
  }

  // Calculate analytics metrics
  const calculateMetrics = () => {
    const monthly = analyticsData.monthlyCollections
    
    const totalCollected = monthly.reduce((sum, row) => sum + row.paid, 0)
    const totalPending = monthly.reduce((sum, row) => sum + row.pending, 0)
    const totalAmount = totalCollected + totalPending
    const collectionRate = totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0
    
    // Course with highest collection rate
    const topCourse = [...analyticsData.courseWise].sort((a, b) => b.collectionRate - a.collectionRate)[0]
    
    // Best performing month
    const bestMonth = [...monthly].sort((a, b) => b.paid - a.paid)[0]
    
    return {
      totalCollected,
      totalPending,
      totalAmount,
      collectionRate,
      topCourse: topCourse?.course || 'N/A',
      topCourseRate: topCourse?.collectionRate || 0,
      bestMonth: bestMonth ? `${bestMonth.month} ${bestMonth.year}` : 'N/A',
      bestMonthAmount: bestMonth?.paid || 0
    }
  }

  const exportToCSV = async () => {
    setExporting(true)
    try {
      let csvContent = "data:text/csv;charset=utf-8,"
      
      switch (reportType) {
        case 'monthly':
          csvContent += "Month,Year,Total Amount,Paid Amount,Pending Amount,Collection Rate(%)\n"
          analyticsData.monthlyCollections.forEach(row => {
            const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
            csvContent += `${row.month},${row.year},${row.total},${row.paid},${row.pending},${rate}\n`
          })
          break
        
        case 'course':
          csvContent += "Course,Total Students,Total Fees,Pending Fees,Collection Rate(%),Status\n"
          analyticsData.courseWise.forEach(row => {
            let status = 'Needs Attention'
            if (row.collectionRate > 80) status = 'Excellent'
            else if (row.collectionRate > 60) status = 'Good'
            
            csvContent += `${row.course},${row.totalStudents},${row.totalFees},${row.pendingFees},${row.collectionRate},${status}\n`
          })
          break
        
        case 'yearly':
          csvContent += "Year,Total Collected,Total Pending,Total Students,Collection Rate(%)\n"
          analyticsData.yearlySummary.forEach(row => {
            const total = row.total_collected + row.total_pending
            const rate = total > 0 ? Math.round((row.total_collected / total) * 100) : 0
            csvContent += `${row.year},${row.total_collected},${row.total_pending},${row.student_count},${rate}\n`
          })
          break
        
        case 'transactions':
          csvContent += "Date,Student Name,Roll Number,Amount,Month,Year,Status,Challan No\n"
          analyticsData.recentTransactions.forEach(row => {
            csvContent += `${row.payment_date},${row.student_name},${row.roll_number},${row.amount},${row.month},${row.year},${row.status},${row.challan_number}\n`
          })
          break
        
        case 'all':
        default:
          const metrics = calculateMetrics()
          csvContent += "ANALYTICS SUMMARY REPORT\n"
          csvContent += `Generated On,${new Date().toLocaleDateString()}\n`
          csvContent += `Date Range,${dateRange.startDate} to ${dateRange.endDate}\n`
          csvContent += `Total Collected,₹${metrics.totalCollected.toLocaleString()}\n`
          csvContent += `Total Pending,₹${metrics.totalPending.toLocaleString()}\n`
          csvContent += `Overall Collection Rate,${metrics.collectionRate}%\n`
          csvContent += `Top Performing Course,${metrics.topCourse} (${metrics.topCourseRate}%)\n`
          csvContent += `Best Month,${metrics.bestMonth} (₹${metrics.bestMonthAmount.toLocaleString()})\n\n`
          
          // Monthly Collections
          csvContent += "MONTHLY COLLECTIONS\n"
          csvContent += "Month,Year,Total,Paid,Pending,Collection Rate(%)\n"
          analyticsData.monthlyCollections.forEach(row => {
            const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
            csvContent += `${row.month},${row.year},${row.total},${row.paid},${row.pending},${rate}\n`
          })
          
          csvContent += "\nCOURSE-WISE ANALYSIS\n"
          csvContent += "Course,Students,Total Fees,Pending Fees,Collection Rate(%),Status\n"
          analyticsData.courseWise.forEach(row => {
            let status = 'Needs Attention'
            if (row.collectionRate > 80) status = 'Excellent'
            else if (row.collectionRate > 60) status = 'Good'
            
            csvContent += `${row.course},${row.totalStudents},${row.totalFees},${row.pendingFees},${row.collectionRate},${status}\n`
          })
          
          csvContent += "\nYEARLY SUMMARY\n"
          csvContent += "Year,Collected,Pending,Students,Collection Rate(%)\n"
          analyticsData.yearlySummary.forEach(row => {
            const total = row.total_collected + row.total_pending
            const rate = total > 0 ? Math.round((row.total_collected / total) * 100) : 0
            csvContent += `${row.year},${row.total_collected},${row.total_pending},${row.student_count},${rate}\n`
          })
      }

      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `analytics_report_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Error exporting report.')
    } finally {
      setExporting(false)
    }
  }

  const printReport = () => {
    const metrics = calculateMetrics()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Analytics Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
            .report-title { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
            .subtitle { color: #64748b; margin-bottom: 20px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0; }
            .metric-card { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
            .metric-value { font-size: 24px; font-weight: bold; color: #1e293b; }
            .metric-label { color: #64748b; font-size: 14px; }
            .section { margin: 30px 0; }
            .section-title { color: #1e293b; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { background: #f1f5f9; padding: 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
            td { padding: 10px; border: 1px solid #e2e8f0; }
            .total-row { background: #f0f9ff; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .highlight { color: #059669; font-weight: bold; }
            .warning { color: #dc2626; font-weight: bold; }
            @media print {
              body { margin: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="report-title">City Computer College - Analytics Report</div>
            <div class="subtitle">Date Range: ${dateRange.startDate} to ${dateRange.endDate}</div>
            <div>Generated on: ${new Date().toLocaleString()}</div>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">₹${metrics.totalCollected.toLocaleString()}</div>
              <div class="metric-label">Total Collected</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">₹${metrics.totalPending.toLocaleString()}</div>
              <div class="metric-label">Total Pending</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${metrics.collectionRate}%</div>
              <div class="metric-label">Collection Rate</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${metrics.topCourse}</div>
              <div class="metric-label">Top Course (${metrics.topCourseRate}%)</div>
            </div>
          </div>

          ${reportType === 'all' || reportType === 'monthly' ? `
            <div class="section">
              <h3 class="section-title">Monthly Collections Analysis</h3>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Year</th>
                    <th>Total Amount</th>
                    <th>Collected</th>
                    <th>Pending</th>
                    <th>Collection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${analyticsData.monthlyCollections.map(row => {
                    const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
                    return `
                    <tr>
                      <td>${row.month}</td>
                      <td>${row.year}</td>
                      <td>₹${row.total.toLocaleString()}</td>
                      <td class="highlight">₹${row.paid.toLocaleString()}</td>
                      <td class="warning">₹${row.pending.toLocaleString()}</td>
                      <td>${rate}%</td>
                    </tr>
                  `}).join('')}
                  ${analyticsData.monthlyCollections.length > 0 ? `
                    <tr class="total-row">
                      <td colspan="2"><strong>Total</strong></td>
                      <td><strong>₹${analyticsData.monthlyCollections.reduce((sum, row) => sum + row.total, 0).toLocaleString()}</strong></td>
                      <td><strong class="highlight">₹${analyticsData.monthlyCollections.reduce((sum, row) => sum + row.paid, 0).toLocaleString()}</strong></td>
                      <td><strong class="warning">₹${analyticsData.monthlyCollections.reduce((sum, row) => sum + row.pending, 0).toLocaleString()}</strong></td>
                      <td><strong>${metrics.collectionRate}%</strong></td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${reportType === 'all' || reportType === 'course' ? `
            <div class="section">
              <h3 class="section-title">Course-wise Performance</h3>
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Students</th>
                    <th>Total Fees</th>
                    <th>Pending Fees</th>
                    <th>Collection Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${analyticsData.courseWise.map(row => {
                    let status = 'Needs Attention'
                    let statusClass = 'warning'
                    if (row.collectionRate > 80) {
                      status = 'Excellent'
                      statusClass = 'highlight'
                    } else if (row.collectionRate > 60) {
                      status = 'Good'
                      statusClass = ''
                    }
                    return `
                    <tr>
                      <td>${row.course}</td>
                      <td>${row.totalStudents}</td>
                      <td>₹${row.totalFees.toLocaleString()}</td>
                      <td class="warning">₹${row.pendingFees.toLocaleString()}</td>
                      <td>${row.collectionRate}%</td>
                      <td class="${statusClass}">${status}</td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${reportType === 'all' || reportType === 'yearly' ? `
            <div class="section">
              <h3 class="section-title">Yearly Summary</h3>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Collected</th>
                    <th>Pending</th>
                    <th>Students</th>
                    <th>Collection Rate</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  ${analyticsData.yearlySummary.map((row, index, array) => {
                    const total = row.total_collected + row.total_pending
                    const rate = total > 0 ? Math.round((row.total_collected / total) * 100) : 0
                    
                    let trend = '→'
                    if (index > 0) {
                      const prevRate = array[index-1].total_collected + array[index-1].total_pending > 0 
                        ? Math.round((array[index-1].total_collected / (array[index-1].total_collected + array[index-1].total_pending)) * 100)
                        : 0
                      if (rate > prevRate) trend = '↑'
                      else if (rate < prevRate) trend = '↓'
                    }
                    
                    return `
                    <tr>
                      <td>${row.year}</td>
                      <td class="highlight">₹${row.total_collected.toLocaleString()}</td>
                      <td class="warning">₹${row.total_pending.toLocaleString()}</td>
                      <td>${row.student_count}</td>
                      <td>${rate}%</td>
                      <td>${trend}</td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="footer">
            <p>This analytics report was generated by City Computer College Fee Management System</p>
            <p>For strategic planning and decision making</p>
          </div>

          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Print Report
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
              Close
            </button>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className="container">
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.title}>Analytics & Reports</h1>
                <p className={styles.subtitle}>Data-driven insights for better decisions</p>
              </div>
              <Link href="/dashboard" className={styles.addButton}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </header>
        <main className={styles.main}>
          <div className="container">
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}>Loading analytics data...</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const metrics = calculateMetrics()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Analytics & Reports</h1>
              <p className={styles.subtitle}>Data-driven insights for strategic decision making</p>
            </div>
            <Link href="/dashboard" className={styles.addButton}>
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Key Metrics Summary */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>₹{metrics.totalCollected.toLocaleString()}</div>
              <div className={styles.metricLabel}>Total Collected</div>
              <small className={styles.metricSubtext}>In selected period</small>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>₹{metrics.totalPending.toLocaleString()}</div>
              <div className={styles.metricLabel}>Total Pending</div>
              <small className={styles.metricSubtext}>Requires attention</small>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.collectionRate}%</div>
              <div className={styles.metricLabel}>Collection Rate</div>
              <small className={styles.metricSubtext}>
                {metrics.collectionRate > 80 ? 'Excellent' : 
                 metrics.collectionRate > 60 ? 'Good' : 'Needs Improvement'}
              </small>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.topCourse}</div>
              <div className={styles.metricLabel}>Top Performing Course</div>
              <small className={styles.metricSubtext}>{metrics.topCourseRate}% collection rate</small>
            </div>
          </div>

          {/* Report Controls */}
          <div className={styles.filtersSection}>
            <div className={styles.filterGroup}>
              <label>Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="all">All Analytics</option>
                <option value="monthly">Monthly Collections</option>
                <option value="course">Course Performance</option>
                <option value="yearly">Yearly Trends</option>
                <option value="transactions">Recent Transactions</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                className={styles.filterSelect}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                className={styles.filterSelect}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Actions</label>
              <div className={styles.actionButtons}>
                <button 
                  onClick={fetchAnalyticsData}
                  className={styles.actionButton}
                  style={{ background: '#2563eb', color: 'white' }}
                >
                  Refresh Data
                </button>
                <button 
                  onClick={exportToCSV}
                  disabled={exporting}
                  className={styles.actionButton}
                  style={{ background: '#059669', color: 'white' }}
                >
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
                <button 
                  onClick={printReport}
                  className={styles.actionButton}
                  style={{ background: '#dc2626', color: 'white' }}
                >
                  Print Report
                </button>
              </div>
            </div>
          </div>

          {/* Monthly Collections Analytics */}
          {(reportType === 'all' || reportType === 'monthly') && (
            <div className={styles.analyticsSection}>
              <div className={styles.sectionHeader}>
                <h2>Monthly Collections Analysis</h2>
                <div className={styles.dateInfo}>
                  {dateRange.startDate} to {dateRange.endDate}
                </div>
              </div>
              
              {analyticsData.monthlyCollections.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No monthly collection data found for the selected date range.</p>
                </div>
              ) : (
                <div className={styles.analyticsTable}>
                  <div className={styles.tableHeader}>
                    <div>Month</div>
                    <div>Year</div>
                    <div>Total Amount</div>
                    <div>Collected</div>
                    <div>Pending</div>
                    <div>Collection Rate</div>
                    <div>Performance</div>
                  </div>
                  <div className={styles.tableBody}>
                    {analyticsData.monthlyCollections.map((row, index) => {
                      const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
                      let performance = 'Poor'
                      let performanceClass = styles.poor
                      if (rate > 80) {
                        performance = 'Excellent'
                        performanceClass = styles.excellent
                      } else if (rate > 60) {
                        performance = 'Good'
                        performanceClass = styles.good
                      } else if (rate > 40) {
                        performance = 'Average'
                        performanceClass = styles.average
                      }

                      return (
                        <div key={index} className={styles.tableRow}>
                          <div className={styles.monthCell}>{row.month}</div>
                          <div>{row.year}</div>
                          <div className={styles.amount}>₹{row.total.toLocaleString()}</div>
                          <div className={`${styles.amount} ${styles.collected}`}>
                            ₹{row.paid.toLocaleString()}
                          </div>
                          <div className={`${styles.amount} ${styles.pending}`}>
                            ₹{row.pending.toLocaleString()}
                          </div>
                          <div>
                            <span className={`${styles.rateBadge} ${performanceClass}`}>
                              {rate}%
                            </span>
                          </div>
                          <div className={performanceClass}>{performance}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Course Performance Analytics */}
          {(reportType === 'all' || reportType === 'course') && (
            <div className={styles.analyticsSection}>
              <div className={styles.sectionHeader}>
                <h2>Course Performance Analysis</h2>
                <div className={styles.insight}>
                  {analyticsData.courseWise.length} courses analyzed
                </div>
              </div>
              
              {analyticsData.courseWise.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No course performance data available.</p>
                </div>
              ) : (
                <div className={styles.analyticsTable}>
                  <div className={styles.tableHeader}>
                    <div>Course</div>
                    <div>Students</div>
                    <div>Total Fees</div>
                    <div>Pending Fees</div>
                    <div>Collection Rate</div>
                    <div>Status</div>
                    <div>Action</div>
                  </div>
                  <div className={styles.tableBody}>
                    {analyticsData.courseWise.map((row, index) => {
                      let status = 'Needs Attention'
                      let statusClass = styles.needsAttention
                      if (row.collectionRate > 80) {
                        status = 'Excellent'
                        statusClass = styles.excellent
                      } else if (row.collectionRate > 60) {
                        status = 'Good'
                        statusClass = styles.good
                      } else if (row.collectionRate > 40) {
                        status = 'Average'
                        statusClass = styles.average
                      }

                      return (
                        <div key={index} className={styles.tableRow}>
                          <div className={styles.courseName}>{row.course}</div>
                          <div>{row.totalStudents}</div>
                          <div className={styles.amount}>₹{row.totalFees.toLocaleString()}</div>
                          <div className={`${styles.amount} ${styles.pending}`}>
                            ₹{row.pendingFees.toLocaleString()}
                          </div>
                          <div>
                            <span className={`${styles.rateBadge} ${statusClass}`}>
                              {row.collectionRate}%
                            </span>
                          </div>
                          <div className={statusClass}>{status}</div>
                          <div>
                            {row.collectionRate < 60 && (
                              <Link 
                                href={`/dashboard/defaulters?course=${encodeURIComponent(row.course)}`}
                                className={styles.insightLink}
                              >
                                View Issues
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Yearly Trends */}
          {(reportType === 'all' || reportType === 'yearly') && (
            <div className={styles.analyticsSection}>
              <div className={styles.sectionHeader}>
                <h2>Yearly Trends Analysis</h2>
              </div>
              
              {analyticsData.yearlySummary.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No yearly trend data available.</p>
                </div>
              ) : (
                <div className={styles.analyticsTable}>
                  <div className={styles.tableHeader}>
                    <div>Year</div>
                    <div>Total Collected</div>
                    <div>Total Pending</div>
                    <div>Total Students</div>
                    <div>Collection Rate</div>
                    <div>Year-over-Year</div>
                  </div>
                  <div className={styles.tableBody}>
                    {analyticsData.yearlySummary.map((row, index, array) => {
                      const total = row.total_collected + row.total_pending
                      const rate = total > 0 ? Math.round((row.total_collected / total) * 100) : 0
                      
                      let yoyTrend = '→ Stable'
                      let trendClass = styles.stable
                      if (index > 0) {
                        const prevTotal = array[index-1].total_collected + array[index-1].total_pending
                        const prevRate = prevTotal > 0 
                          ? Math.round((array[index-1].total_collected / prevTotal) * 100)
                          : 0
                        
                        if (rate > prevRate + 5) {
                          yoyTrend = `↑ Up ${rate - prevRate}%`
                          trendClass = styles.improving
                        } else if (rate < prevRate - 5) {
                          yoyTrend = `↓ Down ${prevRate - rate}%`
                          trendClass = styles.declining
                        }
                      }

                      return (
                        <div key={index} className={styles.tableRow}>
                          <div className={styles.yearCell}>{row.year}</div>
                          <div className={`${styles.amount} ${styles.collected}`}>
                            ₹{row.total_collected.toLocaleString()}
                          </div>
                          <div className={`${styles.amount} ${styles.pending}`}>
                            ₹{row.total_pending.toLocaleString()}
                          </div>
                          <div>{row.student_count}</div>
                          <div>
                            <span className={`${styles.rateBadge} ${
                              rate > 80 ? styles.excellent :
                              rate > 60 ? styles.good :
                              rate > 40 ? styles.average : styles.poor
                            }`}>
                              {rate}%
                            </span>
                          </div>
                          <div className={trendClass}>{yoyTrend}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Transactions (Optional - for audit trail) */}
          {(reportType === 'all' || reportType === 'transactions') && (
            <div className={styles.analyticsSection}>
              <div className={styles.sectionHeader}>
                <h2>Recent Transactions Audit</h2>
                <div className={styles.insight}>Last 20 transactions for tracking</div>
              </div>
              
              {analyticsData.recentTransactions.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No recent transaction data available.</p>
                </div>
              ) : (
                <div className={styles.analyticsTable}>
                  <div className={styles.tableHeader}>
                    <div>Date</div>
                    <div>Student</div>
                    <div>Roll No</div>
                    <div>Amount</div>
                    <div>Month/Year</div>
                    <div>Status</div>
                    <div>Challan No</div>
                  </div>
                  <div className={styles.tableBody}>
                    {analyticsData.recentTransactions.map((row, index) => (
                      <div key={index} className={styles.tableRow}>
                        <div className={styles.dateCell}>
                          {row.payment_date !== 'N/A' 
                            ? new Date(row.payment_date).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                        <div className={styles.studentName}>{row.student_name}</div>
                        <div>{row.roll_number}</div>
                        <div className={styles.amount}>₹{row.amount.toLocaleString()}</div>
                        <div>{row.month} {row.year}</div>
                        <div>
                          <span className={`${styles.status} ${
                            row.status === 'paid' ? styles.paidStatus : styles.pendingStatus
                          }`}>
                            {row.status.toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.challanCell}>{row.challan_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Links to Action Pages */}
          <div className={styles.actionLinks}>
            <h3>Need to take action?</h3>
            <div className={styles.linkGrid}>
              <Link href="/dashboard/defaulters" className={styles.actionLink}>
                <span className={styles.linkIcon}></span>
                <div>
                  <strong>Manage Defaulters</strong>
                  <small>View and manage students with pending fees</small>
                </div>
              </Link>
              <Link href="/dashboard/notifications" className={styles.actionLink}>
                <span className={styles.linkIcon}></span>
                <div>
                  <strong>Send Reminders</strong>
                  <small>Send email/SMS reminders to defaulters</small>
                </div>
              </Link>
              <Link href="/dashboard/fees" className={styles.actionLink}>
                <span className={styles.linkIcon}></span>
                <div>
                  <strong>Fee Management</strong>
                  <small>Manage individual fee records</small>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}