'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../../students.module.css'

interface Student {
  id: string
  roll_number: string
  name: string
  email: string | null
  phone: string | null
  course_id: string | null
  course: string | null
  enrollment_date: string
  father_name: string | null
  address: string | null
  telephone: string | null
  date_of_birth: string | null
  qualification: string | null
  class_time: string | null
}

interface Course {
  id: string
  name: string
  duration_months: number
  monthly_fee: number
  category: string
}

export default function EditStudentPage() {
  const params = useParams()
  const studentId = params.id as string
  const router = useRouter()
  
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
      return
    }
    
    fetchStudent()
    fetchCourses()
  }, [studentId, router])

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (error) throw error
      setStudent(data)
    } catch (error) {
      console.error('Error fetching student:', error)
      setError('Failed to load student data')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('name')
      
      if (error) throw error
      setCourses(data || [])
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: student.name,
          email: student.email,
          phone: student.phone,
          course_id: student.course_id,
          course: student.course,
          father_name: student.father_name,
          address: student.address,
          telephone: student.telephone,
          date_of_birth: student.date_of_birth,
          qualification: student.qualification,
          class_time: student.class_time
        })
        .eq('id', studentId)

      if (error) throw error
      
      alert('✅ Student updated successfully!')
      router.push(`/dashboard/students/${studentId}`)
    } catch (error: any) {
      console.error('Error updating student:', error)
      setError('Failed to update student: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading student data...</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className="container">
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.title}>Student Not Found</h1>
                <p className={styles.subtitle}>The student you're looking for doesn't exist</p>
              </div>
              <Link href="/dashboard/students" className={styles.addButton}>
                ← Back to Students
              </Link>
            </div>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Edit Student</h1>
              <p className={styles.subtitle}>{student.roll_number} - {student.name}</p>
            </div>
            <Link href={`/dashboard/students/${studentId}`} className={styles.addButton}>
              ← Back to Student
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <div className={styles.formSection}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className={styles.studentForm}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Roll Number</label>
                  <input
                    type="text"
                    value={student.roll_number}
                    disabled
                    className={styles.input}
                  />
                  <small className={styles.helperText}>Roll number cannot be changed</small>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Full Name *</label>
                  <input
                    type="text"
                    value={student.name}
                    onChange={(e) => setStudent({...student, name: e.target.value})}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Father Name</label>
                  <input
                    type="text"
                    value={student.father_name || ''}
                    onChange={(e) => setStudent({...student, father_name: e.target.value})}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Mobile Number</label>
                  <input
                    type="text"
                    value={student.phone || ''}
                    onChange={(e) => setStudent({...student, phone: e.target.value})}
                    className={styles.input}
                    placeholder="03001234567"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Telephone</label>
                  <input
                    type="text"
                    value={student.telephone || ''}
                    onChange={(e) => setStudent({...student, telephone: e.target.value})}
                    className={styles.input}
                    placeholder="04231234567"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    value={student.email || ''}
                    onChange={(e) => setStudent({...student, email: e.target.value})}
                    className={styles.input}
                    placeholder="student@example.com"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Course</label>
                  <select
                    value={student.course_id || ''}
                    onChange={(e) => {
                      const course = courses.find(c => c.id === e.target.value)
                      setStudent({
                        ...student, 
                        course_id: e.target.value,
                        course: course?.name || ''
                      })
                    }}
                    className={styles.courseSelect}
                  >
                    <option value="">Select Course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Class Time</label>
                  <input
                    type="text"
                    value={student.class_time || ''}
                    onChange={(e) => setStudent({...student, class_time: e.target.value})}
                    className={styles.input}
                    placeholder="e.g., Morning 9-12"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Birth</label>
                  <input
                    type="date"
                    value={student.date_of_birth || ''}
                    onChange={(e) => setStudent({...student, date_of_birth: e.target.value})}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Qualification</label>
                  <input
                    type="text"
                    value={student.qualification || ''}
                    onChange={(e) => setStudent({...student, qualification: e.target.value})}
                    className={styles.input}
                    placeholder="e.g., Matric, Intermediate"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Address</label>
                  <textarea
                    value={student.address || ''}
                    onChange={(e) => setStudent({...student, address: e.target.value})}
                    className={styles.input}
                    rows={3}
                    placeholder="Full address..."
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <Link href={`/dashboard/students/${studentId}`} className={styles.cancelButton}>
                  Cancel
                </Link>
                <button type="submit" className={styles.submitButton} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}