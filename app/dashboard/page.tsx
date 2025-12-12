'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './dashboard.module.css'

interface Admin {
  id: string
  name: string
  email: string
  role: string
}

export default function Dashboard() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFees: 0,
    pendingFees: 0,
    defaulters: 0
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchDashboardStats = async () => {
    try {
      console.log('🔄 Fetching dashboard statistics...')
      
      // Get total students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id', { count: 'exact' })
        .eq('deleted', false)

      // Get fee statistics
      const { data: feesData, error: feesError } = await supabase
        .from('fee_records')
        .select('amount, status, student_id')

      if (!studentsError && !feesError) {
        const totalStudents = studentsData?.length || 0
        
        // Calculate total paid fees
        const paidFees = feesData.filter(f => f.status === 'paid')
        const totalFees = paidFees.reduce((sum, f) => sum + f.amount, 0) || 0
        
        // Calculate total pending fees
        const pendingFeesData = feesData.filter(f => f.status === 'pending')
        const pendingFees = pendingFeesData.reduce((sum, f) => sum + f.amount, 0) || 0
        
        // Get defaulters count - students with ANY pending fees (not just overdue)
        // Count unique students with pending fees
        const uniqueDefaulters = new Set(pendingFeesData.map(f => f.student_id))
        const defaultersCount = uniqueDefaulters.size

        console.log('Dashboard stats:', {
          totalStudents,
          totalFees,
          pendingFees,
          defaulters: defaultersCount,
          pendingFeesData: pendingFeesData.length,
          uniqueDefaulters: Array.from(uniqueDefaulters)
        })

        setStats({
          totalStudents,
          totalFees,
          pendingFees,
          defaulters: defaultersCount
        })
      } else {
        console.error('Error fetching stats:', studentsError || feesError)
        setStats({
          totalStudents: 0,
          totalFees: 0,
          pendingFees: 0,
          defaulters: 0
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setStats({
        totalStudents: 0,
        totalFees: 0,
        pendingFees: 0,
        defaulters: 0
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if admin is logged in
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      router.push('/login')
      return
    }
    
    setAdmin(JSON.parse(adminData))
    fetchDashboardStats()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('admin')
    router.push('/')
  }

  const refreshStats = () => {
    setLoading(true)
    fetchDashboardStats()
  }

  if (!admin) {
    return <div className={styles.loading}>Loading...</div>
  }

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div className="container">
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.headerTitle}>Admin Dashboard</h1>
                <p className={styles.headerSubtitle}>City Computer College</p>
              </div>
              <div className={styles.headerActions}>
                <span className={styles.adminName}>Welcome, {admin.name}</span>
                <button onClick={handleLogout} className={styles.logoutButton}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className="container">
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}>Loading dashboard statistics...</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.headerTitle}>Admin Dashboard</h1>
              <p className={styles.headerSubtitle}>City Computer College</p>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.adminName}>Welcome, {admin.name}</span>
              <button onClick={refreshStats} className={styles.refreshButton} title="Refresh Statistics">
                🔄
              </button>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Statistics Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{stats.totalStudents}</h3>
              <p className={styles.statLabel}>Total Students</p>
              <small className={styles.statSubtext}>Active students in system</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{stats.totalFees.toLocaleString()}</h3>
              <p className={styles.statLabel}>Total Fees Collected</p>
              <small className={styles.statSubtext}>All paid fees</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>₹{stats.pendingFees.toLocaleString()}</h3>
              <p className={styles.statLabel}>Pending Fees</p>
              <small className={styles.statSubtext}>Awaiting payment</small>
            </div>
            <div className={styles.statCard}>
              <h3 className={styles.statNumber}>{stats.defaulters}</h3>
              <p className={styles.statLabel}>Defaulters</p>
              <small className={styles.statSubtext}>Students with pending fees</small>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.actionsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Quick Actions</h2>
              <button onClick={refreshStats} className={styles.refreshButton}>
                🔄 Refresh
              </button>
            </div>
            <div className={styles.actionsGrid}>
              <Link href="/dashboard/students" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Manage Students</h3>
                <p>Add, edit, or view student records</p>
                <div className={styles.actionStats}>
                  <span>{stats.totalStudents} Students</span>
                </div>
              </Link>
              
              <Link href="/dashboard/fees" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Fee Records</h3>
                <p>Manage fee payments and records</p>
                <div className={styles.actionStats}>
                  <span>₹{stats.totalFees.toLocaleString()} Collected</span>
                </div>
              </Link>

              <Link href="/dashboard/signatures" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Manage Signatures</h3>
                <p>Add and manage authorized signatures</p>
                <div className={styles.actionStats}>
                  <span>Setup Signatures</span>
                </div>
              </Link>
              
              <Link href="/dashboard/defaulters" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Defaulters List</h3>
                <p>View students with pending fees</p>
                <div className={styles.actionStats}>
                  <span>{stats.defaulters} Defaulters</span>
                </div>
              </Link>
              
              <Link href="/dashboard/reports" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Reports</h3>
                <p>Generate fee reports and analytics</p>
                <div className={styles.actionStats}>
                  <span>View Analytics</span>
                </div>
              </Link>
              
              <Link href="/dashboard/notifications" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Send Reminders</h3>
                <p>Send fee reminders to defaulters</p>
                <div className={styles.actionStats}>
                  <span>{stats.defaulters} to notify</span>
                </div>
              </Link>

              <Link href="/dashboard/fees/challan" className={styles.actionCard}>
                <div className={styles.actionIcon}></div>
                <h3>Generate Challans</h3>
                <p>Create fee challans for students</p>
                <div className={styles.actionStats}>
                  <span>Monthly Fees</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className={styles.statsSummary}>
            <h3>Quick Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <strong>Collection Rate:</strong> 
                <span>
                  {stats.totalFees + stats.pendingFees > 0 
                    ? Math.round((stats.totalFees / (stats.totalFees + stats.pendingFees)) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className={styles.summaryItem}>
                <strong>Defaulter Rate:</strong> 
                <span>
                  {stats.totalStudents > 0 
                    ? Math.round((stats.defaulters / stats.totalStudents) * 100) 
                    : 0
                  }%
                </span>
              </div>
              <div className={styles.summaryItem}>
                <strong>Avg. Fee per Student:</strong> 
                <span>
                  ₹{stats.totalStudents > 0 
                    ? Math.round(stats.totalFees / stats.totalStudents).toLocaleString() 
                    : 0
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}