'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../students.module.css'

interface Student {
  id: string
  roll_number: string
  name: string
  email: string
  phone: string
  course: string
  semester: number
  profile_photo: string | null
  created_at: string
}
interface FeeRecord {
  id: string
  amount: number
  due_date: string
  status: string
  payment_date: string | null
  academic_year: string
}

export default function StudentDetails() {
  const [student, setStudent] = useState<Student | null>(null)
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const studentId = params.id as string

  useEffect(() => {
    checkAuth()
    fetchStudentData()
  }, [studentId])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchStudentData = async () => {
    try {
      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) throw studentError

      // Fetch fee records for this student
      const { data: feeData, error: feeError } = await supabase
        .from('fee_records')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: false })

      if (feeError) throw feeError

      setStudent(studentData)
      setFeeRecords(feeData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading student details...</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Student not found</h2>
          <Link href="/dashboard/students" className={styles.addButton}>
            Back to Students
          </Link>
        </div>
      </div>
    )
  }

  const totalPaid = feeRecords
    .filter(fee => fee.status === 'paid')
    .reduce((sum, fee) => sum + fee.amount, 0)

  const totalPending = feeRecords
    .filter(fee => fee.status === 'pending')
    .reduce((sum, fee) => sum + fee.amount, 0)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Student Details</h1>
              <p className={styles.subtitle}>{student.name}</p>
            </div>
            <Link href="/dashboard/students" className={styles.addButton}>
              ← Back to Students
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <div className={styles.detailsGrid}>
            {/* Student Information Card */}
            <div className={styles.detailsCard}>
              <h2>Student Information</h2>
              <div className={styles.studentHeader}>
                <div className={styles.avatarPlaceholder}>
                  {student.name.charAt(0)}
                </div>
                <div>
                  <h3>{student.name}</h3>
                  <p>Roll No: {student.roll_number}</p>
                </div>
              </div>
              
              <div className={styles.detailsList}>
                <div className={styles.detailItem}>
                  <strong>Email:</strong> {student.email || 'Not provided'}
                </div>
                <div className={styles.detailItem}>
                  <strong>Phone:</strong> {student.phone || 'Not provided'}
                </div>
                <div className={styles.detailItem}>
                  <strong>Course:</strong> {student.course}
                </div>
                <div className={styles.detailItem}>
                  <strong>Semester:</strong> {student.semester}
                </div>
                <div className={styles.detailItem}>
                  <strong>Joined:</strong> {new Date(student.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Fee Summary Card */}
            <div className={styles.detailsCard}>
              <h2>Fee Summary</h2>
              <div className={styles.feeSummary}>
                <div className={styles.feeStat}>
                  <div className={styles.feeAmount}>₹{totalPaid.toLocaleString()}</div>
                  <div className={styles.feeLabel}>Total Paid</div>
                </div>
                <div className={styles.feeStat}>
                  <div className={styles.feeAmount}>₹{totalPending.toLocaleString()}</div>
                  <div className={styles.feeLabel}>Pending Fees</div>
                </div>
                <div className={styles.feeStat}>
                  <div className={styles.feeAmount}>{feeRecords.length}</div>
                  <div className={styles.feeLabel}>Fee Records</div>
                </div>
              </div>
            </div>

            {/* Fee Records Card */}
            <div className={styles.detailsCard}>
              <h2>Fee Records</h2>
              {feeRecords.length === 0 ? (
                <p className={styles.noRecords}>No fee records found.</p>
              ) : (
                <div className={styles.feeRecords}>
                  {feeRecords.map((fee) => (
                    <div key={fee.id} className={styles.feeRecord}>
                      <div className={styles.feeInfo}>
                        <div className={styles.feeAmount}>₹{fee.amount.toLocaleString()}</div>
                        <div className={styles.feeDetails}>
                          <div>Due: {new Date(fee.due_date).toLocaleDateString()}</div>
                          <div>Academic Year: {fee.academic_year}</div>
                          {fee.payment_date && (
                            <div>Paid: {new Date(fee.payment_date).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                      <div className={`${styles.status} ${styles[fee.status]}`}>
                        {fee.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link 
                href={`/dashboard/students/${studentId}/add-fee`}
                className={styles.addFeeButton}
              >
                + Add Fee Record
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}