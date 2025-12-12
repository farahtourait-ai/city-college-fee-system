'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DebugCourses() {
  const [courses, setCourses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('name')
      
      // Fetch students with their courses
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_number, course, course_id')
        .order('name')
      
      if (coursesError || studentsError) {
        console.error('Error fetching data:', coursesError || studentsError)
        return
      }
      
      setCourses(coursesData || [])
      setStudents(studentsData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>📊 Database Diagnostic</h1>
      
      <h2>Courses in Database ({courses.length})</h2>
      <table border={1} cellPadding={5} style={{ width: '100%', marginBottom: '30px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>ID</th>
            <th>Name</th>
            <th>Monthly Fee</th>
            <th>Duration</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {courses.map(course => (
            <tr key={course.id}>
              <td>{course.id}</td>
              <td>{course.name}</td>
              <td>₹{course.monthly_fee.toLocaleString()}</td>
              <td>{course.duration_months} months</td>
              <td>{course.category}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Students and Their Courses ({students.length})</h2>
      <table border={1} cellPadding={5} style={{ width: '100%' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Name</th>
            <th>Roll Number</th>
            <th>Course (from students.course)</th>
            <th>Course ID (from students.course_id)</th>
            <th>Matching Course in DB</th>
            <th>Course Fee</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => {
            // Find matching course
            const matchingCourse = courses.find(c => 
              c.id === student.course_id || 
              c.name === student.course ||
              (student.course && c.name.includes(student.course)) ||
              (student.course && student.course.includes(c.name))
            )
            
            return (
              <tr key={student.id}>
                <td>{student.name}</td>
                <td>{student.roll_number}</td>
                <td>{student.course || 'N/A'}</td>
                <td>{student.course_id || 'N/A'}</td>
                <td>{matchingCourse?.name || 'No match found'}</td>
                <td>{matchingCourse ? `₹${matchingCourse.monthly_fee.toLocaleString()}` : 'N/A'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '30px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
        <h3>🎯 Issues Found:</h3>
        <ul>
          {students.map(student => {
            const matchingCourse = courses.find(c => 
              c.id === student.course_id || 
              c.name === student.course
            )
            
            if (!matchingCourse && student.course) {
              return (
                <li key={student.id}>
                  ❌ <strong>{student.name}</strong>: Course "{student.course}" not found in database
                </li>
              )
            }
            return null
          }).filter(Boolean)}
        </ul>
      </div>
    </div>
  )
}