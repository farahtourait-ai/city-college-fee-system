'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from '../students.module.css'
import Papa from 'papaparse'

interface StudentData {
  roll_number: string
  name: string
  father_name: string
  telephone: string
  course: string
  class_time: string
}

interface ImportResult {
  success: number
  errors: number
  duplicates: number
  errorMessages: string[]
}

interface Course {
  id: string
  name: string
  duration_months: number
  monthly_fee: number
  category: string
}

export default function ImportStudents() {
  const [loading, setLoading] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<StudentData[]>([])
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'results'>('upload')
  const [courses, setCourses] = useState<Course[]>([])
  const router = useRouter()

  useEffect(() => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
      return
    }
    fetchCourses()
  }, [router])

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase.from('courses').select('*').order('name')
      if (error) throw error
      setCourses(data || [])
    } catch (err) {
      console.error('Failed to load courses:', err)
    }
  }

  const findCourseMatch = (csvCourseName: string): Course | null => {
    if (!csvCourseName) return null;

       // Skip unwanted courses
  if (csvCourseName.toLowerCase().includes('diploma in it') || 
      csvCourseName.toLowerCase().includes('registration')) {
    return null;
  }
    const input = csvCourseName.toLowerCase().replace(/\s+/g, ' ').trim();

    const normalized = input
      .replace(/enhnce|enhcne|enhnace|enhnace|enhance|enhcnce/g, 'enhanced')
      .replace(/couse|coures|cours|courss/g, 'course')
      .replace(/one\s*year\s*diploma|1\s*year\s*diploma/g, 'one year diploma')
      .replace(/six\s*months?|6\s*months?/g, 'six months')
      .trim();

    let exact = courses.find(c => c.name.toLowerCase().trim() === normalized);
    if (exact) return exact;

    let contains = courses.find(
      c =>
        normalized.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(normalized)
    );
    if (contains) return contains;

    if (normalized.includes('one year diploma') || normalized.includes('one year')) {
      return courses.find(
        c =>
          c.name.toLowerCase().includes('one year') &&
          c.name.toLowerCase().includes('diploma')
      ) || null;
    }

    if (
      normalized.includes('office') &&
      normalized.includes('management') &&
      normalized.includes('six months')
    ) {
      return courses.find(
        c =>
          c.name.toLowerCase().includes('office management') &&
          (c.name.toLowerCase().includes('enhanced') || c.name.toLowerCase().includes('advance'))
      ) || null;
    }

    if (normalized.includes('six months')) {
      return courses.find(c => c.duration_months === 6) || null;
    }

    if (normalized.includes('one year') || normalized.includes('12 months')) {
      return courses.find(c => c.duration_months === 12) || null;
    }

    return null;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file only.')
      return
    }
    setFile(selected)
    parseCSVFile(selected)
  }, [])

  const parseCSVFile = (file: File) => {
    setLoading(true)
    Papa.parse(file, {
      complete: (result: Papa.ParseResult<any>) => {
        const rows = result.data as any[]
        if (rows.length < 2) {
          alert('No data found in CSV')
          setLoading(false)
          return
        }

        // Clean headers - remove spaces, make lowercase
        const headers = (rows[0] as string[]).map(h =>
          h.trim().toLowerCase().replace(/\s+/g, '_')
        )
        console.log('CSV Headers:', headers)
        
        const headerMap: Record<string, number> = {}
        headers.forEach((h, i) => {
          headerMap[h] = i
        })

        const students: StudentData[] = []

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[]
          if (!row || row.length === 0 || row.every(c => !c?.toString().trim())) continue

          const s: StudentData = {
            roll_number: '',
            name: '',
            father_name: '',
            telephone: '',
            course: '',
            class_time: ''
          }

          // Map CSV columns to student data
          Object.keys(headerMap).forEach(key => {
            const val = (row[headerMap[key]] || '').toString().trim()
            
            if (key.includes('roll') || key.includes('roll_no') || key.includes('roll_number')) {
              s.roll_number = val
            } 
            else if (key.includes('name') && !key.includes('father') && !key.includes('parent')) {
              s.name = val
            }
            else if (key.includes('father') || key.includes('parent')) {
              s.father_name = val
            }
            else if (key.includes('telephone') || key.includes('phone') || key.includes('contact')) {
              s.telephone = val
            }
            else if (key.includes('course') || key.includes('program')) {
              s.course = val
            }
            else if (key.includes('class') || key.includes('time') || key.includes('batch')) {
              s.class_time = val
            }
          })

          // Only add if we have required fields
          if (s.roll_number && s.name) {
            students.push(s)
          }
        }

        console.log('Parsed students:', students)
        setPreviewData(students)
        setImportStep('preview')
        setLoading(false)
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        alert('Failed to read CSV: ' + error.message)
        setLoading(false)
      },
      skipEmptyLines: true,
      transform: (value: string) => value.trim()
    })
  }

  const validateStudentData = (student: StudentData): string[] => {
    const errors: string[] = []
    if (!student.roll_number.trim()) errors.push('Roll number missing')
    if (!student.name.trim()) errors.push('Name missing')
    return errors
  }

  const importStudents = async () => {
    if (!previewData.length) return
    setLoading(true)

    const results: ImportResult = {
      success: 0,
      errors: 0,
      duplicates: 0,
      errorMessages: []
    }

    try {
      // Get ALL existing roll numbers to check against
      const { data: existing, error: fetchError } = await supabase
        .from('students')
        .select('roll_number')

      if (fetchError) {
        console.error('Error fetching existing students:', fetchError)
        throw fetchError
      }

      const existingSet = new Set(existing?.map(e => e.roll_number) || [])
      console.log('Existing roll numbers:', Array.from(existingSet))

      for (const student of previewData) {
        const valErrors = validateStudentData(student)
        if (valErrors.length) {
          results.errors++
          results.errorMessages.push(
            `${student.roll_number}: ${valErrors.join(', ')}`
          )
          continue
        }

        if (existingSet.has(student.roll_number)) {
          results.duplicates++
          results.errorMessages.push(`${student.roll_number}: Already exists in database`)
          continue
        }

        const course = findCourseMatch(student.course) || null

        // Insert student with proper fields - NO SEMESTER
        const studentData = {
          roll_number: student.roll_number,
          name: student.name,
          father_name: student.father_name || null,
          phone: student.telephone || null, // Map telephone to phone field
          course: course?.name || student.course || null,
          course_id: course?.id || null,
          class_time: student.class_time || null,
          email: null // No email in CSV
        }

        // Insert student and get the inserted record
        const { data: insertedStudent, error } = await supabase
          .from('students')
          .insert(studentData)
          .select()

        if (error) {
          console.error('Insert error for', student.roll_number, error)
          results.errors++
          results.errorMessages.push(`${student.roll_number}: ${error.message}`)
        } else if (insertedStudent && insertedStudent[0]) {
          // ✅ CREATE PENDING FEE RECORD FOR THE NEW STUDENT
          try {
            const { error: feeError } = await supabase
              .from('fee_records')
              .insert({
                student_id: insertedStudent[0].id,
                amount: course?.monthly_fee || 5000,
                due_date: new Date().toISOString().split('T')[0],
                status: 'pending',
                academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                month: new Date().toLocaleString('default', { month: 'long' }),
                year: new Date().getFullYear()
              })

            if (feeError) {
              console.error(`Failed to create fee record for ${student.roll_number}:`, feeError)
            }
          } catch (feeErr) {
            console.error(`Fee creation error for ${student.roll_number}:`, feeErr)
          }
          
          results.success++
        }
      }

      setImportResults(results)
      setImportStep('results')
    } catch (e: any) {
      console.error('Import failed:', e)
      alert('Import failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setPreviewData([])
    setImportResults(null)
    setImportStep('upload')
  }

  const downloadTemplate = () => {
    const template = `roll_no,name,father_name,telephone,course,class_time
CITY2024001,Muhammad Ahmed,Ahmed Khan,04231234567,Office Management Course (6 Months),Morning 9-12
CITY2024002,Fatima Noor,Noor Muhammad,04237654321,Computer Basics,Evening 2-5
CITY2024003,Ali Raza,Raza Khan,04231122334,Tally Course,Morning 10-1
CITY2024004,Sana Khan,Khan Sahab,04234455667,Web Development,Afternoon 2-5`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'city_college_students_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadCoursesList = () => {
    const list = courses
      .map(c => `${c.name},${c.duration_months} months,${c.monthly_fee}/month,${c.category}`)
      .join('\n')
    const blob = new Blob([
      `course_name,duration,fee,category\n${list}`
    ])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'courses_list.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Bulk Import Students</h1>
              <p className={styles.subtitle}>
                Import all students instantly – City Computer College
              </p>
            </div>
            <Link href="/dashboard/students" className={styles.addButton}>
              ← Back to Students
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Step Indicators */}
          <div className={styles.importSteps}>
            <div className={`${styles.step} ${importStep === 'upload' ? styles.active : styles.completed}`}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepLabel}>Upload CSV</div>
            </div>
            <div className={`${styles.step} ${importStep === 'preview' ? styles.active : importStep === 'results' ? styles.completed : ''}`}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepLabel}>Preview</div>
            </div>
            <div className={`${styles.step} ${importStep === 'results' ? styles.active : ''}`}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepLabel}>Results</div>
            </div>
          </div>

          <div className={styles.importSection}>
            {/* Upload Section */}
            {importStep === 'upload' && (
              <div className={styles.uploadCard}>
                <h2>Upload Student CSV</h2>
                <p className={styles.uploadDescription}>
                  Upload your CSV file with student data. Required fields: roll number, name, father name.
                </p>

                <div className={styles.uploadArea}>
                  <input
                    type="file"
                    id="file-upload"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className={styles.fileInput}
                    disabled={loading}
                  />
                  <label htmlFor="file-upload" className={styles.uploadLabel}>
                    <div className={styles.uploadIcon}>📁</div>
                    <div className={styles.uploadText}>
                      <strong>Choose CSV File</strong>
                      <span>or drag and drop here</span>
                    </div>
                  </label>
                </div>

                <div className={styles.templateSection}>
                  <h4>Templates & Resources</h4>
                  <div className={styles.templateButtons}>
                    <button
                      onClick={downloadTemplate}
                      className={styles.templateButton}
                    >
                      Download Student Template
                    </button>
                    <button
                      onClick={downloadCoursesList}
                      className={styles.templateButton}
                    >
                      Download Courses List
                    </button>
                  </div>
                </div>

                <div className={styles.instructions}>
                  <h4>CSV Column Requirements:</h4>
                  <div className={styles.requiredFields}>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        roll_no / roll_number
                        <span className={styles.requiredBadge}>Required</span>
                      </div>
                      <div className={styles.fieldDescription}>Unique student roll number</div>
                    </div>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        name
                        <span className={styles.requiredBadge}>Required</span>
                      </div>
                      <div className={styles.fieldDescription}>Student's full name</div>
                    </div>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        father_name
                        <span className={styles.requiredBadge}>Required</span>
                      </div>
                      <div className={styles.fieldDescription}>Father's/Guardian's name</div>
                    </div>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        telephone
                        <span className={styles.optionalBadge}>Optional</span>
                      </div>
                      <div className={styles.fieldDescription}>Phone number</div>
                    </div>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        course
                        <span className={styles.optionalBadge}>Optional</span>
                      </div>
                      <div className={styles.fieldDescription}>Course name</div>
                    </div>
                    <div className={styles.fieldItem}>
                      <div className={styles.fieldName}>
                        class_time
                        <span className={styles.optionalBadge}>Optional</span>
                      </div>
                      <div className={styles.fieldDescription}>Class timing</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {importStep === 'preview' && (
              <div className={styles.previewCard}>
                <h2>Preview – {previewData.length} Students Found</h2>
                
                <div className={styles.previewTableContainer}>
                  <table className={styles.previewTable}>
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Name</th>
                        <th>Father Name</th>
                        <th>Course</th>
                        <th>Telephone</th>
                        <th>Class Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 10).map((s, i) => (
                        <tr key={i}>
                          <td>{s.roll_number}</td>
                          <td>{s.name}</td>
                          <td>{s.father_name || '-'}</td>
                          <td>
                            <div className={styles.courseCell}>
                              <span>{s.course || 'Not specified'}</span>
                              {findCourseMatch(s.course) ? (
                                <span style={{color: 'green', marginLeft: '5px'}}>✓</span>
                              ) : s.course ? (
                                <span style={{color: 'orange', marginLeft: '5px'}}>⚠</span>
                              ) : null}
                            </div>
                          </td>
                          <td>{s.telephone || '-'}</td>
                          <td>{s.class_time || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 10 && (
                    <div className={styles.moreRecords}>
                      ... and {previewData.length - 10} more records
                    </div>
                  )}
                </div>

                <div style={{marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px'}}>
                  <p><strong>Note:</strong> All imported students will automatically get a pending fee record. 
                  They will appear in the Defaulters page until fees are paid.</p>
                </div>

                <div className={styles.previewActions}>
                  <button
                    onClick={resetImport}
                    className={styles.cancelButton}
                  >
                    ← Cancel
                  </button>
                  <button
                    onClick={importStudents}
                    disabled={loading}
                    className={styles.importButton}
                  >
                    {loading ? (
                      <>
                        <div className={styles.spinner}></div>
                        Importing...
                      </>
                    ) : (
                      `Import ${previewData.length} Students`
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Results Section */}
            {importStep === 'results' && importResults && (
              <div className={styles.resultsCard}>
                <h2>Import Complete!</h2>
                <div className={styles.resultsSummary}>
                  <div className={`${styles.resultStat} ${styles.success}`}>
                    <div className={styles.resultNumber}>{importResults.success}</div>
                    <div className={styles.resultLabel}>Success</div>
                  </div>
                  <div className={`${styles.resultStat} ${styles.error}`}>
                    <div className={styles.resultNumber}>{importResults.errors}</div>
                    <div className={styles.resultLabel}>Errors</div>
                  </div>
                  <div className={`${styles.resultStat} ${styles.duplicate}`}>
                    <div className={styles.resultNumber}>{importResults.duplicates}</div>
                    <div className={styles.resultLabel}>Duplicates</div>
                  </div>
                </div>

                <div style={{margin: '1.5rem 0', padding: '1rem', background: '#dcfce7', borderRadius: '8px'}}>
                  <p><strong>✅ Successfully imported students will:</strong></p>
                  <ul>
                    <li>Appear in Students Management page</li>
                    <li>Have a pending fee record created automatically</li>
                    <li>Appear in Defaulters page until fees are paid</li>
                  </ul>
                </div>

                {importResults.errorMessages.length > 0 && (
                  <div className={styles.errorDetails}>
                    <h4>First 10 Errors:</h4>
                    <div className={styles.errorList}>
                      {importResults.errorMessages
                        .slice(0, 10)
                        .map((e, i) => (
                          <div key={i} className={styles.errorItem}>
                            {e}
                          </div>
                        ))}
                    </div>
                    {importResults.errorMessages.length > 10 && (
                      <div className={styles.moreErrors}>
                        ... and {importResults.errorMessages.length - 10} more errors
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.resultsActions}>
                  <button
                    onClick={resetImport}
                    className={styles.newImportButton}
                  >
                    Import Another File
                  </button>
                  <Link
                    href="/dashboard/students"
                    className={styles.viewStudentsButton}
                  >
                    View All Students
                  </Link>
                  <Link
                    href="/dashboard/defaulters"
                    className={styles.viewStudentsButton}
                    style={{backgroundColor: '#dc2626'}}
                  >
                    View Defaulters
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}