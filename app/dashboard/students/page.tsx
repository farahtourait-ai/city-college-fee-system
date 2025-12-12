'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './students.module.css'

interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  phone: string;
  course_id: string;
  enrollment_date: string;
  profile_photo: string | null;
  created_at: string;
  father_name?: string;
  address?: string;
  telephone?: string;
  date_of_birth?: string;
  qualification?: string;
  class_time?: string;
  course?: string;
  deleted?: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active')
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // Helper function to handle course name display
  const getCourseDisplayName = (courseName: string | null | undefined): string => {
    if (!courseName) return 'Not assigned'
    
    // Handle renamed courses
    if (courseName.includes('Diploma in IT')) {
      return '1 Year Diploma'
    }
    
    // Add more course rename mappings as needed
    // Example:
    // if (courseName.includes('Web Development')) {
    //   return 'Web Dev Bootcamp'
    // }
    
    return courseName
  }

  // SIMPLE FETCH FUNCTION
  const fetchStudents = async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching students from Supabase...')

      // SIMPLE QUERY - NO COMPLEX JOINS
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('roll_number', { ascending: true })

      if (error) {
        console.error('❌ Database error:', error)
        alert('Database error: ' + error.message)
        return
      }

      console.log(`✅ Loaded ${data?.length || 0} students`)
      setStudents(data || [])
      
    } catch (error: any) {
      console.error('❌ Fetch failed:', error)
      alert('Network error. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
      return
    }
    fetchStudents()
  }, [])

  // Refresh when view mode changes
  useEffect(() => {
    if (!loading) {
      fetchStudents()
    }
  }, [viewMode])

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    const currentViewStudents = filteredStudents.map(s => s.id)
    if (selectedStudents.length === currentViewStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(currentViewStudents)
    }
  }

  // ULTRA-RELIABLE MOVE TO TRASH
  const moveToTrash = async () => {
    if (selectedStudents.length === 0) {
      alert("No students selected")
      return
    }

    if (!confirm(`Move ${selectedStudents.length} students to trash?`)) return

    try {
      console.log(`🔄 Starting to move ${selectedStudents.length} students to trash...`)
      
      let successCount = 0
      const failedStudents: string[] = []

      // Process each student individually with error handling
      for (let i = 0; i < selectedStudents.length; i++) {
        const studentId = selectedStudents[i]
        const student = students.find(s => s.id === studentId)
        
        console.log(`Processing ${i+1}/${selectedStudents.length}: ${student?.name}`)

        try {
          const { error } = await supabase
            .from('students')
            .update({ deleted: true })
            .eq('id', studentId)

          if (error) {
            console.error(`❌ Failed to move student ${studentId}:`, error)
            failedStudents.push(student?.name || studentId)
          } else {
            successCount++
            console.log(`✅ Moved student: ${student?.name}`)
          }

          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 50))
          
        } catch (studentError) {
          console.error(`❌ Error with student ${studentId}:`, studentError)
          failedStudents.push(student?.name || studentId)
        }
      }

      // Refresh the data
      await fetchStudents()
      setSelectedStudents([])

      // Show results
      if (failedStudents.length > 0) {
        alert(`✅ Moved ${successCount} students to trash\n❌ Failed: ${failedStudents.join(', ')}`)
      } else {
        alert(`✅ Successfully moved ${successCount} students to trash!`)
      }

    } catch (error: any) {
      console.error('❌ Move to trash failed completely:', error)
      alert('Operation failed. Please check your connection and try again.')
    }
  }

  // RESTORE FROM TRASH
  const restoreFromTrash = async () => {
    if (selectedStudents.length === 0) {
      alert("No students selected")
      return
    }

    if (!confirm(`Restore ${selectedStudents.length} students from trash?`)) return

    try {
      let successCount = 0
      
      for (const studentId of selectedStudents) {
        const { error } = await supabase
          .from('students')
          .update({ deleted: false })
          .eq('id', studentId)

        if (!error) successCount++
      }

      await fetchStudents()
      setSelectedStudents([])
      alert(`✅ Restored ${successCount} students!`)
      
    } catch (error: any) {
      console.error('❌ Restore failed:', error)
      alert('Failed to restore students: ' + error.message)
    }
  }

  // PERMANENT DELETE
  const permanentlyDelete = async () => {
    if (selectedStudents.length === 0) return
    
    if (!confirm(`PERMANENTLY delete ${selectedStudents.length} students? CANNOT UNDO!`)) return

    try {
      let successCount = 0
      
      for (const studentId of selectedStudents) {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId)

        if (!error) successCount++
      }

      await fetchStudents()
      setSelectedStudents([])
      alert(`✅ Permanently deleted ${successCount} students!`)
      
    } catch (error: any) {
      console.error('❌ Permanent delete failed:', error)
      alert('Failed to delete: ' + error.message)
    }
  }

  // EMPTY TRASH
  const emptyTrash = async () => {
    const trashStudents = students.filter(s => s.deleted)
    if (trashStudents.length === 0) {
      alert("Trash is empty")
      return
    }

    if (!confirm(`PERMANENTLY delete all ${trashStudents.length} students in trash?`)) return

    try {
      const trashIds = trashStudents.map(s => s.id)
      let successCount = 0
      
      for (const studentId of trashIds) {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId)

        if (!error) successCount++
      }

      await fetchStudents()
      alert(`✅ Emptied trash! Deleted ${successCount} students.`)
      
    } catch (error: any) {
      console.error('❌ Empty trash failed:', error)
      alert('Failed to empty trash: ' + error.message)
    }
  }

  // DELETE OLD STUDENTS
  const deleteOldStudents = async () => {
    const oldStudents = students.filter(s => s.roll_number.startsWith("CITY2024") && !s.deleted)
    if (oldStudents.length === 0) {
      alert("No old students (CITY2024) found")
      return
    }

    if (!confirm(`Move ${oldStudents.length} old students (CITY2024) to trash?`)) return

    try {
      const oldIds = oldStudents.map(s => s.id)
      let successCount = 0
      
      for (const studentId of oldIds) {
        const { error } = await supabase
          .from('students')
          .update({ deleted: true })
          .eq('id', studentId)

        if (!error) successCount++
      }

      await fetchStudents()
      alert(`✅ Moved ${successCount} old students to trash!`)
      
    } catch (error: any) {
      console.error('❌ Delete old students failed:', error)
      alert('Failed: ' + error.message)
    }
  }

  // SINGLE STUDENT DELETE
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Move "${name}" to trash?`)) return
    setDeleteLoading(id)

    try {
      const { error } = await supabase
        .from('students')
        .update({ deleted: true })
        .eq('id', id)

      if (error) throw error

      await fetchStudents()
      alert("✅ Student moved to trash!")
    } catch (error: any) {
      console.error('❌ Delete failed:', error)
      alert('Failed: ' + error.message)
    }
    setDeleteLoading(null)
  }

  // COUNTS
  const activeCount = students.filter(s => !s.deleted).length
  const trashCount = students.filter(s => s.deleted).length

  // FILTER STUDENTS
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (viewMode === 'active') {
      return !student.deleted && matchesSearch
    } else {
      return student.deleted && matchesSearch
    }
  })

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading students...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Student Management</h1>
              <p className={styles.subtitle}>
                {viewMode === 'active' ? `Active Students (${activeCount})` : `Trash (${trashCount})`}
              </p>
            </div>

            <div className={styles.headerActions}>
              <input
                type="text"
                placeholder="Search by roll number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />

              <Link href="/dashboard/students/import" className={styles.importButton}>
                📥 Import Students
              </Link>
              <Link href="/dashboard/students/add" className={styles.addButton}>
                + Add Student
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">

          {/* VIEW TOGGLE */}
          <div className={styles.viewToggle}>
            <button 
              onClick={() => setViewMode('active')} 
              className={`${styles.toggleButton} ${viewMode === 'active' ? styles.active : ''}`}
            >
              👥 Active ({activeCount})
            </button>
            <button 
              onClick={() => setViewMode('trash')} 
              className={`${styles.toggleButton} ${viewMode === 'trash' ? styles.active : ''}`}
            >
              🗑️ Trash ({trashCount})
            </button>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={selectAll} className={styles.editButton}>
              {selectedStudents.length === filteredStudents.length ? "Unselect All" : "Select All"}
            </button>

            {viewMode === 'active' ? (
              <>
                <button 
                  onClick={moveToTrash} 
                  className={styles.deleteButton}
                  disabled={selectedStudents.length === 0}
                >
                  🗑️ Move to Trash ({selectedStudents.length})
                </button>
                <button onClick={deleteOldStudents} className={styles.deleteButton}>
                  🗑️ Delete OLD Students (CITY2024)
                </button>
                <button onClick={fetchStudents} className={styles.editButton}>
                  🔄 Refresh
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={restoreFromTrash} 
                  className={styles.editButton}
                  disabled={selectedStudents.length === 0}
                >
                  🔄 Restore ({selectedStudents.length})
                </button>
                <button 
                  onClick={permanentlyDelete} 
                  className={styles.deleteButton}
                  disabled={selectedStudents.length === 0}
                >
                  🗑️ Delete Forever ({selectedStudents.length})
                </button>
                <button onClick={emptyTrash} className={styles.deleteButton}>
                  🗑️ Empty Trash
                </button>
              </>
            )}
          </div>

          {/* STUDENTS GRID */}
          <div className={styles.studentsSection}>
            <h2>
              {viewMode === 'active' 
                ? `Active Students (${filteredStudents.length})` 
                : `Trash - Deleted Students (${filteredStudents.length})`
              }
            </h2>

            {filteredStudents.length === 0 ? (
              <div className={styles.emptyState}>
                {viewMode === 'active' 
                  ? "No active students found. Import or add students to get started."
                  : "Trash is empty. Deleted students will appear here."
                }
              </div>
            ) : (
              <div className={styles.studentsGrid}>
                {filteredStudents.map(student => (
                  <div key={student.id} className={`${styles.studentCard} ${student.deleted ? styles.deleted : ''}`}>
                    
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleSelectStudent(student.id)}
                      style={{ marginBottom: "10px" }}
                    />

                    <div className={styles.studentAvatar}>
                      {student.profile_photo ? (
                        <img src={student.profile_photo} alt={student.name} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {student.name.charAt(0)}
                        </div>
                      )}
                      {student.deleted && <div className={styles.trashBadge}>🗑️</div>}
                    </div>

                    {/* UPDATED STUDENT INFO SECTION WITH COURSE RENAME HANDLING */}
                    <div className={styles.studentInfo}>
                      <h3>{student.name}</h3>
                      <p><strong>Roll:</strong> {student.roll_number}</p>
                      <p><strong>Course:</strong> 
                        {student.course ? (
                          student.course.includes('Diploma in IT') ? '1 Year Diploma' : student.course
                        ) : 'Not assigned'}
                      </p>
                      <p><strong>Phone:</strong> {student.phone || 'Not provided'}</p>
                      {student.deleted && <p className={styles.deletedText}>🗑️ In Trash</p>}
                    </div>

                    <div className={styles.studentActions}>
                      <Link href={`/dashboard/students/${student.id}`} className={styles.viewButton}>
                        View
                      </Link>

                      {/* ADDED EDIT BUTTON - Only for active students */}
                      {viewMode === 'active' && (
                        <Link 
                          href={`/dashboard/students/${student.id}/edit`} 
                          className={styles.editButton}
                        >
                          Edit
                        </Link>
                      )}

                      {viewMode === 'active' ? (
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          className={styles.deleteButton}
                          disabled={deleteLoading === student.id}
                        >
                          {deleteLoading === student.id ? "Moving..." : "Delete"}
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedStudents([student.id])
                              setTimeout(restoreFromTrash, 100)
                            }} 
                            className={styles.editButton}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudents([student.id])
                              setTimeout(permanentlyDelete, 100)
                            }}
                            className={styles.deleteButton}
                          >
                            Delete Forever
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}