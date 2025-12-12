'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import JSZip from 'jszip'
import jsPDF from 'jspdf'
import styles from '@/app/dashboard/fees/fees.module.css'

interface Student {
  id: string
  roll_number: string
  name: string
  email: string
  phone: string
  course_id: string
  course?: string
  course_fee?: number
  courses?: {
    name: string
    monthly_fee: number
  }
}

interface ExistingChallan {
  student_id: string
  month: string
  year: number
  challan_number: string
}

// Course fee mapping based on your Supabase data
const COURSE_FEE_MAPPING: Record<string, number> = {
  // Office Management Courses
  'office management course (3 months)': 3000,
  'office management course (6 months)': 3000,
  
  // Professional Courses
  'freelancing course (6 months)': 5000,
  'amazon course (2 months)': 15000,
  
  // Technical Courses
  'website design (3 months)': 10000,
  'autocad (3 months)': 5000,
  
  // Creative Courses
  'graphic designing course (3 months)': 5000,
  
  // Diploma Courses
  '1 year diploma': 4000,
  
  // Language Courses
  'english spoken course (3 months)': 4000,
  'ielts preparation (2 months)': 12500,
  'ielts': 12500,
  
  // Registration Fee
  'registration fee': 1000,
}

export default function ChallanGeneration() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [generatedChallan, setGeneratedChallan] = useState<any>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [existingChallans, setExistingChallans] = useState<ExistingChallan[]>([])
  const [checkingChallans, setCheckingChallans] = useState(false)
  const router = useRouter()

  const currentYear = new Date().getFullYear()
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i)

  useEffect(() => {
    checkAuth()
    fetchStudents()
  }, [])

  // Check for existing challans when month/year changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      checkExistingChallans()
    }
  }, [selectedMonth, selectedYear])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
      return
    }
    
    // Additional security check
    try {
      const adminData = JSON.parse(admin)
      if (!adminData.allowedEmail) {
        // If not from allowed email list, redirect to login
        localStorage.removeItem('admin')
        router.push('/login')
      }
    } catch (error) {
      localStorage.removeItem('admin')
      router.push('/login')
    }
  }

  // Check if challan already exists for selected month/year
  const checkExistingChallans = async () => {
    if (!selectedMonth || !selectedYear) return
    
    setCheckingChallans(true)
    try {
      const { data, error } = await supabase
        .from('fee_records')
        .select('student_id, month, year, challan_number')
        .eq('month', selectedMonth)
        .eq('year', parseInt(selectedYear))

      if (error) {
        console.error('Error checking existing challans:', error)
        return
      }

      setExistingChallans(data || [])
      
      // Show warning if there are existing challans
      if (data && data.length > 0) {
        console.log(`Found ${data.length} existing challans for ${selectedMonth} ${selectedYear}`)
      }
    } catch (error) {
      console.error('Error checking existing challans:', error)
    } finally {
      setCheckingChallans(false)
    }
  }

  // Check if a student already has a challan for selected month/year
  const hasExistingChallan = (studentId: string): boolean => {
    return existingChallans.some(challan => 
      challan.student_id === studentId && 
      challan.month === selectedMonth && 
      challan.year === parseInt(selectedYear)
    )
  }

  // Get existing challan number for a student
  const getExistingChallanNumber = (studentId: string): string | null => {
    const existing = existingChallans.find(challan => 
      challan.student_id === studentId && 
      challan.month === selectedMonth && 
      challan.year === parseInt(selectedYear)
    )
    return existing?.challan_number || null
  }

  const fetchStudents = async () => {
    try {
      console.log('🔄 Fetching students for challan generation...')
      
      // Try to fetch all available data from students table
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .order('name')
        .limit(1000)

      if (studentError) {
        console.error('Error fetching students:', studentError)
        alert('Error loading students. Please check console for details.')
        return
      }

      console.log(`Found ${studentData?.length || 0} students`)

      if (studentData && studentData.length > 0) {
        await fetchCourseData(studentData)
      } else {
        setStudents([])
      }
    } catch (error: any) {
      console.error('Error in fetchStudents:', error)
      alert('Error loading students: ' + error.message)
    }
  }

  // Helper function to fetch course data
  const fetchCourseData = async (studentData: any[]) => {
    try {
      // Get all unique course IDs for batch fetching
      const courseIds = [...new Set(studentData.map(s => s.course_id).filter(Boolean))]
      
      let allCourses: Record<string, { name: string; monthly_fee: number }> = {}
      
      if (courseIds.length > 0) {
        // Batch fetch all courses at once
        const { data: courses, error: coursesError } = await supabase
          .from('courses')
          .select('id, name, monthly_fee')
          .in('id', courseIds)

        if (!coursesError && courses) {
          // Create a map for quick lookup
          courses.forEach(course => {
            allCourses[course.id] = {
              name: course.name,
              monthly_fee: course.monthly_fee
            }
          })
        }
      }

      // Process students with their course data
      const studentsWithCourses = studentData.map((student) => {
        const courseData = student.course_id ? allCourses[student.course_id] : null

        return {
          id: student.id,
          roll_number: student.roll_number || '',
          name: student.name || '',
          email: student.email || '',
          phone: student.phone || '',
          course_id: student.course_id || '',
          course: student.course || '',
          course_fee: student.course_fee || 0,
          courses: courseData ? {
            name: courseData.name,
            monthly_fee: courseData.monthly_fee
          } : undefined
        }
      })

      setStudents(studentsWithCourses)
      
      // Log summary for debugging
      console.log('=== STUDENT FEE SUMMARY ===')
      studentsWithCourses.forEach((s, i) => {
        const fee = getStudentFeeAmount(s)
        console.log(`${i+1}. ${s.name} - ${s.courses?.name || s.course || 'No Course'} - Fee: Rs. ${fee}`)
      })
      
    } catch (error) {
      console.error('Error fetching course data:', error)
      // Still set students even if course data fails
      const basicStudents = studentData.map(student => ({
        id: student.id,
        roll_number: student.roll_number || '',
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        course_id: student.course_id || '',
        course: student.course || '',
        course_fee: student.course_fee || 0,
        courses: undefined
      }))
      setStudents(basicStudents)
    }
  }

  // Get the correct fee amount
  const getStudentFeeAmount = (student: Student): number => {
    const studentName = student.name || '';
    const courseName = (student.courses?.name || student.course || '').toLowerCase().trim();
    
    // Priority 1: Use monthly_fee from courses table (linked by course_id)
    if (student.courses?.monthly_fee && student.courses.monthly_fee > 0) {
      return student.courses.monthly_fee;
    }
    
    // Priority 2: Use course_fee from students table
    if (student.course_fee && student.course_fee > 0) {
      return student.course_fee;
    }
    
    // Priority 3: Look up in course fee mapping based on course name
    if (courseName) {
      // Try exact match first
      const exactMatch = Object.entries(COURSE_FEE_MAPPING).find(([key]) => 
        courseName === key.toLowerCase()
      );
      
      if (exactMatch) {
        return exactMatch[1];
      }
      
      // Try partial match
      const partialMatch = Object.entries(COURSE_FEE_MAPPING).find(([key]) => 
        courseName.includes(key.toLowerCase()) || key.toLowerCase().includes(courseName)
      );
      
      if (partialMatch) {
        return partialMatch[1];
      }
      
      // Check for IELTS in any form
      if (courseName.includes('ielts')) {
        return COURSE_FEE_MAPPING['ielts'];
      }
      
      // Check for Office Management in any form
      if (courseName.includes('office') || courseName.includes('management')) {
        return COURSE_FEE_MAPPING['office management course (3 months)'];
      }
    }
    
    // Priority 4: Default fees based on common patterns
    let defaultFee = 0;
    
    if (courseName.includes('ielts')) {
      defaultFee = 12500;
    } else if (courseName.includes('office') || courseName.includes('management')) {
      defaultFee = 3000;
    } else if (courseName.includes('amazon') || courseName.includes('ecommerce')) {
      defaultFee = 15000;
    } else if (courseName.includes('website') || courseName.includes('design')) {
      defaultFee = 10000;
    } else if (courseName.includes('autocad') || courseName.includes('cad')) {
      defaultFee = 5000;
    } else if (courseName.includes('graphic')) {
      defaultFee = 5000;
    } else if (courseName.includes('freelancing')) {
      defaultFee = 5000;
    } else if (courseName.includes('diploma')) {
      defaultFee = 4000;
    } else if (courseName.includes('english') || courseName.includes('spoken')) {
      defaultFee = 4000;
    } else if (courseName.includes('registration')) {
      defaultFee = 1000;
    } else {
      defaultFee = 3000; // General default
    }
    
    return defaultFee;
  }

  const generateChallan = async () => {
    if (!selectedStudent || !selectedMonth || !selectedYear) {
      alert('Please select student, month, and year')
      return
    }

    const student = students.find(s => s.id === selectedStudent)
    if (!student) {
      alert('Student not found')
      return
    }

    // Check if challan already exists for this student/month/year
    if (hasExistingChallan(student.id)) {
      const existingChallanNo = getExistingChallanNumber(student.id)
      const proceed = confirm(
        `Challan already exists for ${student.name} for ${selectedMonth} ${selectedYear}.\n` +
        `Challan Number: ${existingChallanNo}\n\n` +
        `Do you want to generate a new one anyway? (This will create a duplicate)`
      )
      
      if (!proceed) {
        return
      }
    }

    // Get the correct fee amount
    const feeAmount = getStudentFeeAmount(student);

    const challanData = {
      student: {
        name: student.name,
        roll_number: student.roll_number,
        course: student.courses?.name || student.course || 'No Course',
        email: student.email,
        phone: student.phone
      },
      fee: {
        month: selectedMonth,
        year: selectedYear,
        amount: feeAmount,
        due_date: new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 10).toISOString().split('T')[0]
      },
      challan_number: `CH${selectedYear}${(months.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}${student.roll_number.slice(-3)}`,
      generated_date: new Date().toLocaleDateString()
    }

    setGeneratedChallan(challanData)
  }

  const generateChallanForAllStudents = async () => {
    if (!selectedMonth || !selectedYear) {
      alert('Please select month and year first')
      return
    }

    if (students.length === 0) {
      alert('No students found')
      return
    }

    // Check how many students already have challans
    const studentsWithExistingChallans = students.filter(student => 
      hasExistingChallan(student.id)
    ).length

    if (studentsWithExistingChallans > 0) {
      const proceed = confirm(
        `${studentsWithExistingChallans} students already have challans for ${selectedMonth} ${selectedYear}.\n\n` +
        `Generating for all students will create duplicates for these students.\n\n` +
        `Do you want to continue?`
      )
      
      if (!proceed) {
        return
      }
    }

    setGeneratingAll(true)

    try {
      // Filter out students who already have challans if user wants
      const studentsToProcess = students.filter(student => 
        !hasExistingChallan(student.id)
      )

      if (studentsToProcess.length === 0) {
        alert(`All ${students.length} students already have challans for ${selectedMonth} ${selectedYear}.`)
        setGeneratingAll(false)
        return
      }

      const feeRecords = studentsToProcess.map(student => {
        // Get the correct fee amount for each student
        const feeAmount = getStudentFeeAmount(student);
        
        return {
          student_id: student.id,
          amount: feeAmount,
          due_date: new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 10).toISOString().split('T')[0],
          month: selectedMonth,
          year: parseInt(selectedYear),
          status: 'pending',
          academic_year: `${selectedYear}-${parseInt(selectedYear) + 1}`,
          challan_number: `CH${selectedYear}${(months.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}${student.roll_number.slice(-3)}`
        }
      })

      console.log('Creating fee records for', feeRecords.length, 'students');

      const { error } = await supabase
        .from('fee_records')
        .insert(feeRecords)

      if (error) {
        console.error('Error creating fee records:', error)
        alert('Error generating challans: ' + error.message)
      } else {
        // Refresh existing challans list
        await checkExistingChallans()
        
        alert(`Successfully generated challans for ${feeRecords.length} students for ${selectedMonth} ${selectedYear}!\n` +
              `(${studentsWithExistingChallans} students already had challans and were skipped)`)
        
        const firstStudent = studentsToProcess[0]
        const sampleChallan = {
          student: {
            name: firstStudent.name,
            roll_number: firstStudent.roll_number,
            course: firstStudent.courses?.name || firstStudent.course || 'No Course',
            email: firstStudent.email,
            phone: firstStudent.phone
          },
          fee: {
            month: selectedMonth,
            year: selectedYear,
            amount: getStudentFeeAmount(firstStudent),
            due_date: new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 10).toISOString().split('T')[0]
          },
          challan_number: `CH${selectedYear}${(months.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}${firstStudent.roll_number.slice(-3)}`,
          generated_date: new Date().toLocaleDateString(),
          for_all_students: true,
          total_students: feeRecords.length,
          skipped_students: studentsWithExistingChallans
        }
        
        setGeneratedChallan(sampleChallan)
      }
    } catch (error: any) {
      console.error('Error in bulk challan generation:', error)
      alert('Failed to generate challans: ' + error.message)
    } finally {
      setGeneratingAll(false)
    }
  }

  const downloadAllChallans = async () => {
    if (!selectedMonth || !selectedYear) {
      alert('Please select month and year first');
      return;
    }

    if (students.length === 0) {
      alert('No students found');
      return;
    }

    setGeneratingAll(true);

    try {
      const zip = new JSZip();
      
      // Create folder for organized download
      const folder = zip.folder(`challans-${selectedMonth}-${selectedYear}`);
      
      if (!folder) {
        throw new Error('Could not create ZIP folder');
      }

      // Generate PDF for each student
      for (const student of students) {
        const pdf = await generateChallanPDF(student, selectedMonth, selectedYear);
        const fileName = `${student.roll_number}-${student.name.replace(/[^a-zA-Z0-9]/g, '-')}-challan.pdf`;
        folder.file(fileName, pdf);
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challans-${selectedMonth}-${selectedYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Successfully downloaded ${students.length} challans!`);
      
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Error downloading challans. Please try again.');
    } finally {
      setGeneratingAll(false);
    }
  };

  const generateChallanPDF = async (student: Student, month: string, year: string): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Colors
      const primaryColor = [37, 99, 235];     // Blue
      const secondaryColor = [16, 185, 129];  // Green
      const darkColor = [30, 41, 59];         // Dark
      const lightColor = [248, 250, 252];     // Light background
      
      // Get the correct fee amount
      const feeAmount = getStudentFeeAmount(student);
      
      // Header Section
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(15, 15, pageWidth - 30, 22, 'F');
      
      // College Name
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('CITY COMPUTER COLLEGE', pageWidth / 2, 23, { align: 'center' });
      
      // Challan Title
      pdf.setFontSize(12);
      pdf.text('FEE PAYMENT CHALLAN', pageWidth / 2, 30, { align: 'center' });
      
      // Challan Number Box
      const challanNumber = `CH${year}${(months.indexOf(month) + 1).toString().padStart(2, '0')}${student.roll_number.slice(-3)}`;
      
      pdf.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.rect(pageWidth / 2 - 45, 40, 90, 8, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Challan No: ${challanNumber}`, pageWidth / 2, 45, { align: 'center' });
      
      let yPosition = 58;
      
      // Student Information Section
      pdf.setFontSize(12);
      pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      pdf.text('STUDENT INFORMATION', 20, yPosition);
      
      // Student Info Card
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      pdf.rect(20, yPosition + 8, pageWidth - 40, 35, 'FD');
      
      yPosition += 18;
      
      pdf.setFontSize(10);
      pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      
      // Student Details
      pdf.text(`Name: ${student.name}`, 25, yPosition);
      pdf.text(`Roll No: ${student.roll_number}`, pageWidth / 2, yPosition);
      
      yPosition += 7;
      pdf.text(`Course: ${student.courses?.name || student.course || 'No Course'}`, 25, yPosition);
      pdf.text(`Phone: ${student.phone || 'N/A'}`, pageWidth / 2, yPosition);
      
      yPosition += 7;
      pdf.text(`Email: ${student.email || 'N/A'}`, 25, yPosition);
      pdf.text(`Academic Year: ${year}-${parseInt(year) + 1}`, pageWidth / 2, yPosition);
      
      yPosition += 25;
      
      // Fee Details Section
      pdf.setFontSize(12);
      pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      pdf.text('FEE DETAILS', 20, yPosition);
      
      // Fee Details Card
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      pdf.rect(20, yPosition + 8, pageWidth - 40, 25, 'FD');
      
      yPosition += 18;
      
      pdf.setFontSize(10);
      pdf.text(`For Month: ${month} ${year}`, 25, yPosition);
      pdf.text(`Due Date: 10th ${month} ${year}`, pageWidth / 2, yPosition);
      
      yPosition += 7;
      pdf.text(`Generated Date: ${new Date().toLocaleDateString()}`, 25, yPosition);
      pdf.text(`Status: PENDING`, pageWidth / 2, yPosition);
      
      yPosition += 20;
      
      // Amount Box
      pdf.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      pdf.rect(pageWidth / 2 - 60, yPosition, 120, 22, 'F');
      
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text('MONTHLY FEE AMOUNT', pageWidth / 2, yPosition + 9, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      
      // Display fee amount
      const formattedAmount = `Rs. ${feeAmount.toLocaleString('en-IN')}`;
      pdf.text(formattedAmount, pageWidth / 2, yPosition + 16, { align: 'center' });
      
      yPosition += 32;
      
      // Payment Instructions Section
      pdf.setFontSize(12);
      pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      pdf.text('PAYMENT INSTRUCTIONS', 20, yPosition);
      
      // Instructions Card
      pdf.setDrawColor(253, 230, 138);
      pdf.setFillColor(255, 251, 235);
      pdf.rect(20, yPosition + 8, pageWidth - 40, 35, 'FD');
      
      yPosition += 18;
      
      pdf.setFontSize(9);
      pdf.setTextColor(146, 64, 14);
      pdf.text('• Pay the fee amount before due date at college office', 25, yPosition);
      yPosition += 6;
      pdf.text('• Bring this printed challan for payment', 25, yPosition);
      yPosition += 6;
      pdf.text('• Keep the receipt safely for future reference', 25, yPosition);
      yPosition += 6;
      pdf.text('• Late payments may attract penalty charges', 25, yPosition);
      yPosition += 6;
      pdf.text('• Contact college office for any queries', 25, yPosition);
      
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('This is a computer generated challan. No signature required.', pageWidth / 2, pageHeight - 12, { align: 'center' });
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
      
      // Convert to blob for ZIP
      const pdfBlob = pdf.output('arraybuffer');
      resolve(new Uint8Array(pdfBlob));
    });
  };

  const printChallan = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow && generatedChallan) {
      
      let studentListHTML = ''
      if (generatedChallan.for_all_students) {
        const skippedText = generatedChallan.skipped_students > 0 ? 
          ` (${generatedChallan.skipped_students} students skipped - already had challans)` : '';
        
        studentListHTML = `
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0369a1;">
            <h4 style="color: #0369a1; margin: 0 0 10px 0;">📋 Generated for ${generatedChallan.total_students} Students${skippedText}</h4>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Note:</strong> This is a bulk challan generation for all students.</p>
            <p style="margin: 5px 0; font-size: 14px;">Individual challans have been created in the system.</p>
          </div>
        `
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fee Challan - ${generatedChallan.student.name}</title>
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
              color: #333;
            }
            .challan-container {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #2563eb;
              border-radius: 10px;
              padding: 30px;
              background: white;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .college-name {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #2563eb;
            }
            .challan-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #1e293b;
            }
            .content {
              margin-bottom: 20px;
            }
            .student-info, .fee-info {
              margin-bottom: 25px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 15px;
            }
            .info-item {
              padding: 15px;
              background: #f8fafc;
              border-radius: 5px;
              border-left: 4px solid #2563eb;
            }
            .info-label {
              font-weight: bold;
              color: #64748b;
              font-size: 12px;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 16px;
              color: #1e293b;
              margin-top: 5px;
              font-weight: 600;
            }
            .amount-box {
              text-align: center;
              background: #1e293b;
              color: white;
              padding: 25px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .amount-label {
              font-size: 18px;
              margin-bottom: 10px;
            }
            .amount-value {
              font-size: 36px;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            .instructions {
              background: #fffbeb;
              color: #92400e;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              border-left: 4px solid #f59e0b;
            }
            .challan-number {
              background: #dcfce7;
              color: #166534;
              padding: 10px 15px;
              border-radius: 5px;
              font-weight: bold;
              text-align: center;
              margin: 15px 0;
            }
            .duplicate-warning {
              background: #fef3c7;
              color: #92400e;
              padding: 10px;
              border-radius: 5px;
              margin: 10px 0;
              border-left: 4px solid #f59e0b;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .no-print { display: none; }
              .challan-container { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="challan-container">
            <div class="header">
              <div class="college-name">CITY COMPUTER COLLEGE</div>
              <div class="challan-title">FEE PAYMENT CHALLAN</div>
              <div style="color: #64748b;">Official Fee Payment Document</div>
            </div>
            
            <div class="content">
              ${studentListHTML}
              
              ${generatedChallan.duplicate ? `
                <div class="duplicate-warning">
                  <strong>Note:</strong> This is a duplicate challan for ${generatedChallan.month} ${generatedChallan.year}
                </div>
              ` : ''}
              
              <div class="challan-number">
                Challan No: ${generatedChallan.challan_number}
              </div>
              
              <div class="student-info">
                <h3 style="color: #2563eb; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Student Information</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Student Name</div>
                    <div class="info-value">${generatedChallan.student.name}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Roll Number</div>
                    <div class="info-value">${generatedChallan.student.roll_number}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Course</div>
                    <div class="info-value">${generatedChallan.student.course}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Contact</div>
                    <div class="info-value">${generatedChallan.student.phone || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div class="fee-info">
                <h3 style="color: #2563eb; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Fee Details</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">For Month</div>
                    <div class="info-value">${generatedChallan.fee.month} ${generatedChallan.fee.year}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Due Date</div>
                    <div class="info-value">${new Date(generatedChallan.fee.due_date).toLocaleDateString()}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Generated Date</div>
                    <div class="info-value">${generatedChallan.generated_date}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Payment Status</div>
                    <div class="info-value" style="color: #dc2626; font-weight: bold;">PENDING</div>
                  </div>
                </div>
              </div>
              
              <div class="amount-box">
                <div class="amount-label">Monthly Fee Amount</div>
                <div class="amount-value">Rs. ${generatedChallan.fee.amount.toLocaleString()}</div>
              </div>
              
              <div class="instructions">
                <strong>Payment Instructions:</strong><br>
                1. Pay the fee amount before due date<br>
                2. Bring this challan to college office<br>
                3. Keep the receipt for future reference<br>
                4. Late payments may attract penalty
              </div>
            </div>
            
            <div class="footer">
              <div style="margin-top: 30px; font-size: 12px; color: #64748b;">
                This is a computer generated challan. No signature required.
              </div>
            </div>
            
            <div class="no-print" style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                Print Challan
              </button>
              <button onclick="window.close()" style="padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                Close
              </button>
            </div>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const selectedStudentData = students.find(s => s.id === selectedStudent)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Generate Fee Challan</h1>
              <p className={styles.subtitle}>Create professional fee challans for students</p>
            </div>
            <Link href="/dashboard/fees" className={styles.addButton}>
              ← Back to Fees
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Bulk Download Section */}
          <div className={styles.bulkDownloadSection} style={{ textAlign: 'left' }}>
            <h3>Bulk Download All Challans</h3>
            <div className={styles.bulkDownloadActions} style={{ textAlign: 'left' }}>
              <button 
                onClick={downloadAllChallans}
                disabled={!selectedMonth || !selectedYear || generatingAll}
                className={styles.bulkDownloadButton}
              >
                {generatingAll ? (
                  <>
                    <span className={styles.spinner}></span>
                    Creating ZIP File...
                  </>
                ) : (
                  `Download All Challans (${students.length} Students)`
                )}
              </button>
              <div style={{ marginTop: '12px' }}>
                <small className={styles.helperText}>
                  Downloads a ZIP file containing PDF challans for all students. Perfect for bulk printing.
                </small>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              {/* Student Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Student *</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className={styles.input}
                >
                  <option value="">Choose Student</option>
                  {students.map(student => {
                    const feeAmount = getStudentFeeAmount(student);
                    const hasChallan = selectedMonth && selectedYear ? hasExistingChallan(student.id) : false;
                    const challanText = hasChallan ? ' (✓ Already has challan)' : '';
                    
                    return (
                      <option key={student.id} value={student.id}>
                        {student.roll_number} - {student.name} - {student.courses?.name || student.course || 'No Course'} 
                        (Rs. {feeAmount}){challanText}
                      </option>
                    )
                  })}
                </select>
                <small className={styles.helperText}>
                  {students.length} students found • {existingChallans.length} challans already exist for {selectedMonth} {selectedYear}
                </small>
              </div>

              {/* Month Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Month *</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={styles.input}
                >
                  <option value="">Choose Month</option>
                  {months.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              {/* Year Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Year *</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={styles.input}
                >
                  <option value="">Choose Year</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Challan Status Info */}
            {selectedMonth && selectedYear && (
              <div className={styles.quickTips} style={{background: '#f0f9ff', borderColor: '#bae6fd'}}>
                <h4>Challan Status for {selectedMonth} {selectedYear}</h4>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'}}>
                  <div>
                    <strong>Total Students:</strong> {students.length}
                  </div>
                  <div>
                    <strong>Existing Challans:</strong> {existingChallans.length}
                  </div>
                  <div>
                    <strong>Pending Students:</strong> {students.length - existingChallans.length}
                  </div>
                  <div>
                    <strong>Status:</strong> 
                    <span style={{
                      color: existingChallans.length === students.length ? '#059669' : 
                             existingChallans.length > 0 ? '#f59e0b' : '#dc2626',
                      fontWeight: 'bold',
                      marginLeft: '8px'
                    }}>
                      {existingChallans.length === students.length ? 'Complete' :
                       existingChallans.length > 0 ? 'Partial' : 'Not Started'}
                    </span>
                  </div>
                </div>
                {checkingChallans && (
                  <div style={{marginTop: '10px', color: '#64748b', fontSize: '0.9rem'}}>
                    <span className={styles.spinner} style={{width: '12px', height: '12px'}}></span>
                    Checking existing challans...
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className={styles.formActions} style={{flexDirection: 'column', gap: '1rem'}}>
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
                <button 
                  onClick={generateChallan}
                  className={styles.submitButton}
                  disabled={!selectedStudent || !selectedMonth || !selectedYear || checkingChallans}
                >
                  {hasExistingChallan(selectedStudent) ? 'Generate Duplicate Challan' : 'Generate Single Challan'}
                </button>
                
                <button 
                  onClick={generateChallanForAllStudents}
                  disabled={!selectedMonth || !selectedYear || generatingAll || checkingChallans}
                  className={styles.submitButton}
                  style={{backgroundColor: '#059669'}}
                >
                  {generatingAll ? (
                    <>
                      <span className={styles.spinner}></span>
                      Generating for All...
                    </>
                  ) : (
                    `Generate for Pending Students (${Math.max(0, students.length - existingChallans.length)})`
                  )}
                </button>
              </div>
              
              <small className={styles.helperText} style={{textAlign: 'center'}}>
                "Generate for Pending Students" will only create challans for students who don't already have one for {selectedMonth} {selectedYear}
              </small>
            </div>

            {/* Challan Preview */}
            {generatedChallan && (
              <div className={styles.quickTips} style={{background: '#f0fdf4', borderColor: '#bbf7d0'}}>
                <h4>
                  {generatedChallan.for_all_students ? 'Bulk Challan Generation Complete!' : 'Challan Generated Successfully!'}
                </h4>
                <div style={{marginBottom: '1rem'}}>
                  {generatedChallan.for_all_students ? (
                    <>
                      <p><strong>Generated for:</strong> {generatedChallan.total_students} students</p>
                      {generatedChallan.skipped_students > 0 && (
                        <p><strong>Skipped:</strong> {generatedChallan.skipped_students} students (already had challans)</p>
                      )}
                      <p><strong>For Month:</strong> {generatedChallan.fee.month} {generatedChallan.fee.year}</p>
                      <p><strong>Sample Challan No:</strong> {generatedChallan.challan_number}</p>
                      <p style={{color: '#059669', fontWeight: 'bold'}}>
                        Fee records created for pending students in the system
                      </p>
                    </>
                  ) : (
                    <>
                      <p><strong>Challan No:</strong> {generatedChallan.challan_number}</p>
                      <p><strong>Student:</strong> {generatedChallan.student.name}</p>
                      <p><strong>Amount:</strong> Rs. {generatedChallan.fee.amount.toLocaleString()}</p>
                      <p><strong>For:</strong> {generatedChallan.fee.month} {generatedChallan.fee.year}</p>
                      {hasExistingChallan(selectedStudent) && (
                        <p style={{color: '#f59e0b', fontWeight: 'bold'}}>
                          ⚠️ Note: This is a duplicate challan for this month
                        </p>
                      )}
                    </>
                  )}
                </div>
                <button 
                  onClick={printChallan}
                  className={styles.submitButton}
                  style={{background: '#059669'}}
                >
                   {generatedChallan.for_all_students ? 'Print Sample Challan' : 'Print Challan'}
                </button>
              </div>
            )}

            {/* Student Info Preview */}
            {selectedStudentData && (
              <div className={styles.quickTips}>
                <h4>Selected Student Information</h4>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'}}>
                  <div>
                    <strong>Name:</strong> {selectedStudentData.name}
                  </div>
                  <div>
                    <strong>Roll No:</strong> {selectedStudentData.roll_number}
                  </div>
                  <div>
                    <strong>Course:</strong> {selectedStudentData.courses?.name || selectedStudentData.course || 'No Course'}
                  </div>
                  <div>
                    <strong>Monthly Fee:</strong> Rs. {getStudentFeeAmount(selectedStudentData).toLocaleString()}
                  </div>
                  {selectedMonth && selectedYear && (
                    <div>
                      <strong>Challan Status:</strong> 
                      {hasExistingChallan(selectedStudentData.id) ? (
                        <span style={{color: '#059669', fontWeight: 'bold'}}>
                          ✓ Already generated for {selectedMonth} {selectedYear}
                        </span>
                      ) : (
                        <span style={{color: '#dc2626', fontWeight: 'bold'}}>
                          ⚠️ Not yet generated for {selectedMonth} {selectedYear}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}