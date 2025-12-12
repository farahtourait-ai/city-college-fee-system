'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../fees.module.css'

interface Student {
  id: string
  roll_number: string
  name: string
  email: string
  phone: string
  course_id: string
  course: string
  enrollment_date: string
  courses?: {
    name: string
    duration_months: number
    monthly_fee: number
    category: string
  } | null  // Added null here
}

// Create a separate component that uses useSearchParams
function AddFeeContent() {
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    due_date: '',
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: currentYear.toString(),
    status: 'pending',
    challan_number: ''
  })
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const [debugInfo, setDebugInfo] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()  // This is now inside the Suspense boundary
  const preselectedStudent = searchParams.get('student')

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const generateYears = () => {
    const years = [];
    for (let i = 0; i <= 10; i++) {
      years.push(currentYear + i);
    }
    return years;
  }
  
  const years = generateYears();

  useEffect(() => {
    checkAuth()
    fetchCourses()
    fetchStudents()
  }, [])

  useEffect(() => {
    // Auto-fill amount when student is selected
    if (formData.student_id && courses.length > 0) {
      const selectedStudent = students.find(s => s.id === formData.student_id);
      if (selectedStudent) {
        const courseFee = getStudentCourseFee(selectedStudent);
        console.log('Auto-filling fee for student:', {
          student: selectedStudent.name,
          courseName: selectedStudent.course,
          courseId: selectedStudent.course_id,
          fee: courseFee
        });
        
        if (courseFee > 0) {
          setFormData(prev => ({
            ...prev,
            amount: courseFee.toString()
          }));
        }
      }
    }
  }, [formData.student_id, students, courses])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }
  
  // NEW: Payment confirmation email function
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
          to: process.env.ADMIN_EMAIL || 'hassancitycollege222@gmail.com',
          name: 'Admin',
          message: `PAYMENT CONFIRMED: ${params.studentName} (Roll: ${params.studentRoll}) paid ₹${params.amount} for ${params.month} ${params.year}. Challan No: ${params.challanNumber || 'Not provided'}.`,
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
  
  const fetchCourses = async () => {
    try {
      console.log('🔄 Fetching courses for fee lookup...')
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, duration_months, monthly_fee, category')
        .order('name')

      if (error) {
        console.error('Error fetching courses:', error)
        return
      }

      console.log(` Loaded ${data?.length || 0} courses:`)
      data?.forEach(course => {
        console.log(`  - ${course.name}: ₹${course.monthly_fee}/month`)
      })
      
      setCourses(data || [])
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }
  
  const fetchStudents = async () => {
    try {
      setIsLoadingStudents(true);
      console.log('🔄 Fetching students...')
      const { data, error } = await supabase
        .from('students')
        .select('id, roll_number, name, email, phone, course_id, course, enrollment_date')
        .order('name')

      if (error) {
        console.error('Error fetching students:', error)
        setError('Failed to load students list')
        setStudents([])
        return
      }

      console.log(`Loaded ${data?.length || 0} students`)
      
      // Fetch course details for each student
      if (data && data.length > 0) {
        const studentsWithCourses = await Promise.all(
          data.map(async (student) => {
            let courseData = null
            
            // Try to find course by name first
            if (student.course) {
              console.log(`Looking for course: "${student.course}"`)
              const { data: course, error: courseError } = await supabase
                .from('courses')
                .select('name, duration_months, monthly_fee, category')
                .ilike('name', `%${student.course}%`)
                .single()

              if (!courseError && course) {
                console.log(`Found course for ${student.name}: ${course.name} (₹${course.monthly_fee})`)
                courseData = course
              } else if (student.course_id) {
                // If course name not found, try by ID
                console.log(`Trying to find course by ID: ${student.course_id}`)
                const { data: courseById } = await supabase
                  .from('courses')
                  .select('name, duration_months, monthly_fee, category')
                  .eq('id', student.course_id)
                  .single()

                if (courseById) {
                  console.log(`Found course by ID for ${student.name}: ${courseById.name} (₹${courseById.monthly_fee})`)
                  courseData = courseById
                }
              }
            }

            return {
              ...student,
              courses: courseData
            }
          })
        )

        setStudents(studentsWithCourses)
        
        // Set debug info
        const debug = studentsWithCourses.map(s => ({
          name: s.name,
          roll: s.roll_number,
          courseName: s.course,
          courseId: s.course_id,
          foundCourse: s.courses?.name || 'Not found',
          foundFee: s.courses?.monthly_fee || 0
        }))
        setDebugInfo(JSON.stringify(debug, null, 2))
      } else {
        setStudents([])
      }

    } catch (error) {
      console.error('Error in fetchStudents:', error)
      setError('Failed to load students list')
      setStudents([])
    } finally {
      setIsLoadingStudents(false);
    }
  }

  // Get the correct course fee for a student
  const getStudentCourseFee = (student: Student): number => {
    console.log('Looking up fee for student:', student.name)
    console.log('Student course info:', {
      courseName: student.course,
      courseId: student.course_id,
      joinedCourseData: student.courses
    })
    
    // First check if we have course data from join
    if (student.courses?.monthly_fee) {
      console.log(`Using joined course data: ${student.courses.name} - ₹${student.courses.monthly_fee}`)
      return student.courses.monthly_fee;
    }
    
    // If not, try to find course by name in courses array
    if (student.course) {
      // Try exact match first
      let course = courses.find(c => 
        c.name.toLowerCase() === student.course.toLowerCase()
      );
      
      // Try partial match
      if (!course) {
        course = courses.find(c => 
          student.course.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(student.course.toLowerCase())
        );
      }
      
      // Try very loose match for office management
      if (!course && student.course.toLowerCase().includes('office')) {
        course = courses.find(c => 
          c.name.toLowerCase().includes('office')
        );
      }
      
      if (course?.monthly_fee) {
        console.log(`Found course by name match: ${course.name} - ₹${course.monthly_fee}`)
        return course.monthly_fee;
      }
    }
    
    // Fallback: Try to find course by ID
    if (student.course_id) {
      const course = courses.find(c => c.id === student.course_id);
      if (course?.monthly_fee) {
        console.log(`Found course by ID: ${course.name} - ₹${course.monthly_fee}`)
        return course.monthly_fee;
      }
    }
    
    console.warn(`Could not find fee for student ${student.name}, course: "${student.course}"`)
    console.warn('Available courses:', courses.map(c => `${c.name}: ₹${c.monthly_fee}`))
    
    // Default fallback
    return 0;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'student_id') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        amount: ''
      }));
      
      const selectedStudent = students.find(s => s.id === value);
      if (selectedStudent) {
        const courseFee = getStudentCourseFee(selectedStudent);
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            amount: courseFee.toString()
          }));
        }, 0);
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    if (error) setError('')
    if (success) setSuccess('')
  }

  const calculateDueDate = (month: string, year: string) => {
    const monthIndex = months.indexOf(month)
    const dueDate = new Date(parseInt(year), monthIndex, 10)
    return dueDate.toISOString().split('T')[0]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!formData.student_id) {
      setError('Please select a student')
      setLoading(false)
      return
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount')
      setLoading(false)
      return
    }

    try {
      const { data: existingFees, error: checkError } = await supabase
        .from('fee_records')
        .select('*')
        .eq('student_id', formData.student_id)
        .eq('month', formData.month)
        .eq('year', formData.year)

      if (checkError) {
        console.error('Error checking existing fees:', checkError)
      }

      if (existingFees && existingFees.length > 0) {
        setError(`Monthly fee already exists for ${formData.month} ${formData.year}`)
        setLoading(false)
        return
      }
    } catch (err) {
      console.error('Error checking existing fees:', err)
    }

    try {
      const dueDate = calculateDueDate(formData.month, formData.year)
      const paymentDate = formData.status === 'paid' ? new Date().toISOString().split('T')[0] : null
      
      const feeData = {
        student_id: formData.student_id,
        amount: parseFloat(formData.amount),
        due_date: dueDate,
        month: formData.month,
        year: parseInt(formData.year),
        status: formData.status,
        payment_date: paymentDate,
        challan_number: formData.status === 'paid' ? formData.challan_number : null,
        academic_year: `${formData.year}-${parseInt(formData.year) + 1}`
      }

      console.log('Inserting fee data:', feeData)

      const { data, error } = await supabase
        .from('fee_records')
        .insert([feeData])
        .select()

      if (error) {
        console.error('Error adding fee:', error)
        setError(error.message || 'Failed to add fee record')
      } else {
        setSuccess(`Monthly fee for ${formData.month} ${formData.year} added successfully!`)
        
        // Send payment confirmation email if status is "paid"
        if (formData.status === 'paid') {
          const selectedStudent = students.find(s => s.id === formData.student_id)
          if (selectedStudent) {
            const emailSent = await sendPaymentConfirmationEmail({
              studentName: selectedStudent.name,
              studentRoll: selectedStudent.roll_number,
              amount: parseFloat(formData.amount),
              paymentDate: new Date().toISOString(),
              challanNumber: formData.challan_number || undefined,
              month: formData.month,
              year: parseInt(formData.year)
            })
            
            if (emailSent) {
              setSuccess(prev => prev + ' Confirmation email sent to admin.')
            } else {
              setSuccess(prev => prev + ' (Email notification failed)')
            }
          }
        }
        
        // Reset form
        const selectedStudent = students.find(s => s.id === (preselectedStudent || formData.student_id));
        const courseFee = selectedStudent ? getStudentCourseFee(selectedStudent) : 0;
        
        setFormData({
          student_id: preselectedStudent || '',
          amount: courseFee.toString() || '',
          due_date: '',
          month: new Date().toLocaleString('default', { month: 'long' }),
          year: currentYear.toString(),
          status: 'pending',
          challan_number: ''
        })
        
        if (!preselectedStudent) {
          setTimeout(() => {
            router.push('/dashboard/fees')
          }, 2000)
        }
      }
    } catch (err) {
      console.error('Error in fee submission:', err)
      setError('Failed to add fee record. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentMonth = () => {
    return new Date().toLocaleString('default', { month: 'long' })
  }

  const getNextMonth = () => {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return nextMonth.toLocaleString('default', { month: 'long' })
  }

  const getCourseName = (student: Student) => {
    return student.course || student.courses?.name || 'No Course Assigned'
  }

  // Add a function to check what's in the database
  const checkDatabaseCourses = async () => {
    console.log('Checking database courses...')
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error checking courses:', error)
      return
    }
    
    console.log('Current courses in database:')
    data?.forEach(course => {
      console.log(`  - ${course.name}: ₹${course.monthly_fee}/month (ID: ${course.id})`)
    })
    
    alert(`Found ${data?.length || 0} courses. Check browser console for details.`)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Add Monthly Fee</h1>
              <p className={styles.subtitle}>
                {preselectedStudent ? 'Add monthly fee for selected student' : 'Create monthly fee record for student'}
              </p>
            </div>
            <Link href="/dashboard/fees" className={styles.addButton}>
              ← Back to Fees
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <div className={styles.formSection}>
            {/* Debug button - remove in production */}
            <button 
              onClick={checkDatabaseCourses}
              style={{
                background: '#666',
                color: 'white',
                padding: '5px 10px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                marginBottom: '10px',
                cursor: 'pointer'
              }}
            >
               Check Database Courses
            </button>

            {error && (
              <div className={styles.errorMessage}>
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {success && (
              <div className={styles.successMessage}>
                <strong>Success:</strong> {success}
                {!preselectedStudent && <div>Redirecting to fees page...</div>}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className={styles.feeForm}>
              <div className={styles.formGrid}>
                {/* Student Selection */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Student *</label>
                  <select
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    className={styles.input}
                    required
                    disabled={!!preselectedStudent || isLoadingStudents}
                  >
                    <option value="">Select Student</option>
                    {isLoadingStudents ? (
                      <option value="" disabled>Loading students...</option>
                    ) : (
                      students.map(student => {
                        const courseFee = getStudentCourseFee(student);
                        return (
                          <option key={student.id} value={student.id}>
                            {student.name} ({student.roll_number}) - {getCourseName(student)} (₹{courseFee.toLocaleString()}/month)
                          </option>
                        )
                      })
                    )}
                  </select>
                  {preselectedStudent && (
                    <small className={styles.helperText}>
                      Student pre-selected from defaulters list
                    </small>
                  )}
                  {students.length === 0 && !isLoadingStudents && (
                    <small className={styles.helperText} style={{color: '#dc2626'}}>
                      No students found. Please add students first.
                    </small>
                  )}
                </div>

                {/* Monthly Amount */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Monthly Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., 5000"
                    min="0"
                    step="0.01"
                    required
                    readOnly={!!formData.student_id}
                    style={formData.student_id ? { 
                      backgroundColor: '#f8fafc', 
                      color: '#64748b',
                      cursor: 'not-allowed'
                    } : {}}
                  />
                  <small className={styles.helperText}>
                    {formData.student_id 
                      ? `Monthly fee auto-filled from course: ₹${formData.amount}`
                      : 'Select a student first to auto-fill monthly fee'
                    }
                  </small>
                </div>

                {/* Month Selection */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Month *</label>
                  <select
                    name="month"
                    value={formData.month}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  >
                    {months.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <small className={styles.helperText}>
                    Quick select: 
                    <button 
                      type="button" 
                      className={styles.suggestionButton}
                      onClick={() => setFormData(prev => ({ ...prev, month: getCurrentMonth() }))}
                    >
                      Current Month
                    </button>
                    {' | '}
                    <button 
                      type="button" 
                      className={styles.suggestionButton}
                      onClick={() => setFormData(prev => ({ ...prev, month: getNextMonth() }))}
                    >
                      Next Month
                    </button>
                  </small>
                </div>

                {/* Year Selection */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Year *</label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <small className={styles.helperText}>
                    Supports all years from {currentYear} to {currentYear + 10}
                  </small>
                </div>

                {/* Status */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Payment Status *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                  <small className={styles.helperText}>
                    {formData.status === 'paid' 
                      ? 'Payment date will be set to today & confirmation email sent to admin' 
                      : 'Student will appear in defaulters list until paid'
                    }
                  </small>
                </div>

                {/* Challan Number (only show when status is paid) */}
                {formData.status === 'paid' && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Challan Number</label>
                    <input
                      type="text"
                      name="challan_number"
                      value={formData.challan_number}
                      onChange={handleChange}
                      className={styles.input}
                      placeholder="e.g., CH20250315001"
                    />
                    <small className={styles.helperText}>
                      Enter challan/receipt number for payment tracking
                    </small>
                  </div>
                )}

                {/* Due Date Display (Read-only) */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Due Date</label>
                  <input
                    type="text"
                    value={calculateDueDate(formData.month, formData.year)}
                    className={styles.input}
                    readOnly
                    style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                  />
                  <small className={styles.helperText}>
                    Auto-calculated as 10th of {formData.month} {formData.year}
                  </small>
                </div>
              </div>

              {/* Form Actions */}
              <div className={styles.formActions}>
                <Link href="/dashboard/fees" className={styles.cancelButton}>
                  Cancel
                </Link>
                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={loading || !formData.student_id || parseFloat(formData.amount) <= 0}
                >
                  {loading ? (
                    <>
                      <span className={styles.spinner}></span>
                      Adding Monthly Fee...
                    </>
                  ) : (
                    'Add Monthly Fee'
                  )}
                </button>
              </div>

              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <details style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <summary style={{ cursor: 'pointer', color: '#666' }}>Debug Information</summary>
                  <pre style={{ fontSize: '10px', overflow: 'auto', maxHeight: '200px', marginTop: '10px' }}>
                    {debugInfo}
                  </pre>
                </details>
              )}

              {/* Quick Tips */}
              <div className={styles.quickTips}>
                <h4>Monthly Fee System ({currentYear}-{currentYear + 10}):</h4>
                <ul>
                  <li>Monthly fee is auto-filled from student's course fee</li>
                  <li>Due date is automatically set to 10th of each month</li>
                  <li>System prevents duplicate fees for same month/year</li>
                  <li>Add challan number when marking fees as paid</li>
                  <li><strong>Confirmation email sent to admin for paid fees</strong></li>
                  <li>Generate professional receipts for paid fees</li>
                  <li>Pending monthly fees will appear in defaulters list</li>
                </ul>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

// Main component with Suspense
export default function AddFeePage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', color: '#2563eb', marginBottom: '1rem' }}>Loading...</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Preparing fee form...</div>
        </div>
      </div>
    }>
      <AddFeeContent />
    </Suspense>
  )
}