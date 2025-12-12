'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../students.module.css'

interface Course {
  id: string;
  name: string;
  duration_months: number;
  monthly_fee: number;
  category: string;
  description?: string;
}

export default function AddStudent() {
  const [formData, setFormData] = useState({
    roll_number: '',
    name: '',
    email: '',
    phone: '',
    course_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
    father_name: '',
    address: '',
    telephone: '',
    date_of_birth: '',
    qualification: '',
    class_time: ''
  })
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const router = useRouter()

  // Add this useEffect to handle body scroll when modal opens/closes
  useEffect(() => {
    if (showEditModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showEditModal]);

  // Also update your close button handler to be more robust
  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditStudent(null);
    document.body.classList.remove('modal-open');
  };

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('category')
        .order('name')

      if (error) {
        console.error('Error fetching courses:', error)
        setError('Failed to load courses')
      } else {
        setCourses(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to load courses')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError('')
  }

  const generateRollNumber = () => {
    const year = new Date().getFullYear()
    const randomNum = Math.floor(Math.random() * 9000) + 1000
    return `CITY${year}${randomNum}`
  }

  // Filter out unwanted courses (Diploma in IT and Registration Fee)
  const getFilteredCourses = () => {
    return courses.filter(course => 
      !course.name.toLowerCase().includes('diploma in it') && 
      !course.name.toLowerCase().includes('registration fee')
    );
  }

  // Get actual course fee
  const getActualCourseFee = (course: Course | undefined): number => {
    if (!course) return 5000;
    return course.monthly_fee;
  }

  // Get course total fee (monthly fee × duration)
  const getCourseTotalFee = (course: Course | undefined): number => {
    if (!course) return 0;
    return course.monthly_fee * course.duration_months;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!formData.course_id) {
      setError('Please select a course')
      setLoading(false)
      return
    }

    if (!formData.name.trim()) {
      setError('Name is required')
      setLoading(false)
      return
    }

    try {
      const selectedCourse = courses.find(c => c.id === formData.course_id)
      const actualMonthlyFee = getActualCourseFee(selectedCourse)
      const courseTotalFee = getCourseTotalFee(selectedCourse)
      
      // Prepare student data with additional fields
      const studentData = {
        roll_number: formData.roll_number || generateRollNumber(),
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        course_id: formData.course_id,
        course: selectedCourse?.name || null,
        enrollment_date: formData.enrollment_date,
        father_name: formData.father_name || null,
        address: formData.address || null,
        telephone: formData.telephone || null,
        date_of_birth: formData.date_of_birth || null,
        qualification: formData.qualification || null,
        class_time: formData.class_time || null
      }

      // Insert student and get the inserted record
      const { data: insertedStudent, error: studentError } = await supabase
        .from('students')
        .insert([studentData])
        .select()

      if (studentError) {
        setError(studentError.message)
        setLoading(false)
        return
      }

      if (insertedStudent && insertedStudent[0] && selectedCourse) {
        // ✅ CREATE MONTHLY FEE RECORD WITH CORRECT COURSE FEE
        const { error: monthlyFeeError } = await supabase
          .from('fee_records')
          .insert({
            student_id: insertedStudent[0].id,
            amount: actualMonthlyFee,
            due_date: new Date().toISOString().split('T')[0],
            status: 'pending',
            academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
            month: new Date().toLocaleString('default', { month: 'long' }),
            year: new Date().getFullYear(),
            notes: `Monthly fee for ${selectedCourse.name}`
          })

        if (monthlyFeeError) {
          console.error('Monthly fee creation error:', monthlyFeeError)
        }

        // ✅ ADD REGISTRATION FEE (₹1000)
        // Find registration fee course
        const registrationCourse = courses.find(c => c.name.toLowerCase().includes('registration'))
        if (registrationCourse) {
          const { error: regFeeError } = await supabase
            .from('fee_records')
            .insert({
              student_id: insertedStudent[0].id,
              amount: registrationCourse.monthly_fee,
              due_date: new Date().toISOString().split('T')[0],
              status: 'pending',
              academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
              month: 'Registration',
              year: new Date().getFullYear(),
              notes: 'Registration Fee'
            })

          if (regFeeError) {
            console.error('Registration fee error:', regFeeError)
          }
        }

        alert(`✅ Student added successfully!\n• Course: ${selectedCourse.name}\n• Monthly Fee: ₹${actualMonthlyFee.toLocaleString()}\n• Registration Fee: ₹1,000\n• Total Pending: ₹${(actualMonthlyFee + 1000).toLocaleString()}`)
        router.push('/dashboard/students')
      } else {
        alert('✅ Student added successfully!')
        router.push('/dashboard/students')
      }
    } catch (err: any) {
      console.error('Error adding student:', err)
      setError('Failed to add student. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCourse = courses.find(c => c.id === formData.course_id)
  const actualMonthlyFee = getActualCourseFee(selectedCourse)
  const courseTotalFee = getCourseTotalFee(selectedCourse)
  const totalInitialPending = actualMonthlyFee + 1000 // Monthly fee + registration

  // Get filtered courses (without Diploma in IT and Registration Fee)
  const filteredCourses = getFilteredCourses();
  
  // Group filtered courses by category
  const coursesByCategory = filteredCourses.reduce((acc, course) => {
    if (!acc[course.category]) {
      acc[course.category] = []
    }
    acc[course.category].push(course)
    return acc
  }, {} as Record<string, Course[]>)

  // Generate roll number suggestion based on selected course
  const getRollNumberSuggestion = () => {
    if (!selectedCourse) return ''
    
    const currentYear = new Date().getFullYear()
    const courseCode = selectedCourse.name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase()
    
    return `${courseCode}${currentYear}001`
  }

  // Helper function to format category names
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Add New Student</h1>
              <p className={styles.subtitle}>Create a new student record</p>
            </div>
            <Link href="/dashboard/students" className={styles.addButton}>
              ← Back to Students
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <div className={styles.formSection}>
            {error && (
              <div className={styles.errorMessage}>
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className={styles.studentForm}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Roll Number</label>
                  <input
                    type="text"
                    name="roll_number"
                    value={formData.roll_number}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder={getRollNumberSuggestion()}
                  />
                  <small className={styles.helperText}>
                    Leave empty to auto-generate
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., Rajesh Kumar"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Father Name</label>
                  <input
                    type="text"
                    name="father_name"
                    value={formData.father_name}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="Father's/Guardian's name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Mobile Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., 9876543210"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Telephone</label>
                  <input
                    type="text"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., 04231234567"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., rajesh@citycollege.edu"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Course *</label>
                  <select
                    name="course_id"
                    value={formData.course_id}
                    onChange={handleChange}
                    className={styles.courseSelect}
                    required
                  >
                    <option value="">Select a Course</option>
                    {Object.entries(coursesByCategory).map(([category, categoryCourses]) => (
                      <optgroup key={category} label={`${formatCategoryName(category)} COURSES`}>
                        {categoryCourses.map((course) => {
                          const totalFee = course.monthly_fee * course.duration_months;
                          return (
                            <option key={course.id} value={course.id}>
                              {course.name} - {course.duration_months} month{course.duration_months !== 1 ? 's' : ''} 
                              (₹{course.monthly_fee.toLocaleString()}/month)
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                  <small className={styles.helperText}>
                    {selectedCourse && (
                      <span style={{color: '#dc2626', fontWeight: 'bold'}}>
                        Total Course Fee: ₹{(selectedCourse.monthly_fee * selectedCourse.duration_months).toLocaleString()}
                      </span>
                    )}
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Class Time</label>
                  <input
                    type="text"
                    name="class_time"
                    value={formData.class_time}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., Morning 9-12, Evening 2-5"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Qualification</label>
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., Matric, Intermediate, Bachelor's"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={styles.input}
                    rows={3}
                    placeholder="Full residential address..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Enrollment Date *</label>
                  <input
                    type="date"
                    name="enrollment_date"
                    value={formData.enrollment_date}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              {/* Fee Summary Section */}
              {selectedCourse && (
                <div style={{margin: '1.5rem 0', padding: '1.5rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd'}}>
                  <h4 style={{color: '#0369a1', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    📊 Fee Summary - {selectedCourse.name}
                  </h4>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
                    <div style={{background: 'white', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #3b82f6'}}>
                      <div style={{fontSize: '0.9rem', color: '#64748b'}}>Course Duration</div>
                      <div style={{fontWeight: 'bold', marginTop: '0.25rem'}}>
                        {selectedCourse.duration_months} month{selectedCourse.duration_months !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div style={{background: 'white', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #10b981'}}>
                      <div style={{fontSize: '0.9rem', color: '#64748b'}}>Monthly Fee</div>
                      <div style={{fontWeight: 'bold', marginTop: '0.25rem', color: '#059669', fontSize: '1.1rem'}}>
                        ₹{selectedCourse.monthly_fee.toLocaleString()}/month
                      </div>
                    </div>
                    
                    <div style={{background: 'white', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #f59e0b'}}>
                      <div style={{fontSize: '0.9rem', color: '#64748b'}}>Total Course Fee</div>
                      <div style={{fontWeight: 'bold', marginTop: '0.25rem', color: '#d97706'}}>
                        ₹{(selectedCourse.monthly_fee * selectedCourse.duration_months).toLocaleString()}
                      </div>
                    </div>
                    
                    <div style={{background: 'white', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #8b5cf6'}}>
                      <div style={{fontSize: '0.9rem', color: '#64748b'}}>Registration Fee</div>
                      <div style={{fontWeight: 'bold', marginTop: '0.25rem', color: '#7c3aed'}}>
                        ₹1,000 (one-time)
                      </div>
                    </div>
                  </div>
                  
                  <div style={{marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div style={{background: '#fef3c7', padding: '1rem', borderRadius: '6px'}}>
                      <div style={{fontSize: '0.9rem', color: '#92400e'}}>Initial Pending Amount</div>
                      <div style={{fontWeight: 'bold', fontSize: '1.25rem', marginTop: '0.25rem', color: '#92400e'}}>
                        ₹{(selectedCourse.monthly_fee + 1000).toLocaleString()}
                      </div>
                      <div style={{fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem'}}>
                        (Monthly: ₹{selectedCourse.monthly_fee.toLocaleString()} + Registration: ₹1,000)
                      </div>
                    </div>
                    
                    <div style={{background: '#dcfce7', padding: '1rem', borderRadius: '6px'}}>
                      <div style={{fontSize: '0.9rem', color: '#166534'}}>Total Course Cost</div>
                      <div style={{fontWeight: 'bold', fontSize: '1.25rem', marginTop: '0.25rem', color: '#166534'}}>
                        ₹{((selectedCourse.monthly_fee * selectedCourse.duration_months) + 1000).toLocaleString()}
                      </div>
                      <div style={{fontSize: '0.8rem', color: '#166534', marginTop: '0.25rem'}}>
                        (Course: ₹{(selectedCourse.monthly_fee * selectedCourse.duration_months).toLocaleString()} + Registration: ₹1,000)
                      </div>
                    </div>
                  </div>
                  
                  <div style={{marginTop: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '6px', fontSize: '0.9rem', color: '#dc2626'}}>
                    <strong>Note:</strong> Student will appear in Defaulters page with ₹{(selectedCourse.monthly_fee + 1000).toLocaleString()} pending until fees are paid.
                  </div>
                </div>
              )}

              {/* Course Information Display */}
              {selectedCourse && (
                <div className={styles.courseInfo}>
                  <h4>📚 Course Details</h4>
                  <div className={styles.courseDetails}>
                    <p><strong>Course:</strong> {selectedCourse.name}</p>
                    <p><strong>Duration:</strong> {selectedCourse.duration_months} month{selectedCourse.duration_months !== 1 ? 's' : ''}</p>
                    <p><strong>Monthly Fee:</strong> ₹{selectedCourse.monthly_fee.toLocaleString()}/month</p>
                    <p><strong>Total Course Fee:</strong> ₹{(selectedCourse.monthly_fee * selectedCourse.duration_months).toLocaleString()}</p>
                    <p><strong>Registration Fee:</strong> ₹1,000</p>
                    <p><strong>Total Cost:</strong> ₹{((selectedCourse.monthly_fee * selectedCourse.duration_months) + 1000).toLocaleString()}</p>
                    <p><strong>Category:</strong> <span className={styles.categoryBadge}>{formatCategoryName(selectedCourse.category)}</span></p>
                    {selectedCourse.description && (
                      <p><strong>Description:</strong> {selectedCourse.description}</p>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <Link href="/dashboard/students" className={styles.cancelButton}>
                  Cancel
                </Link>
                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Adding Student...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Modal Component - Add this if you need a modal */}
      {showEditModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Student</h2>
              <button 
                onClick={handleCloseModal}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>Modal content goes here...</p>
              {/* Add your modal form/content here */}
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={handleCloseModal}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={() => {/* Handle save */}}
                className={styles.submitButton}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}