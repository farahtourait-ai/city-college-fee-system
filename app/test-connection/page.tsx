'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function TestConnection() {
  const [status, setStatus] = useState('Testing...')

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing Supabase connection...')
        console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        
        const { data, error } = await supabase
          .from('students')
          .select('count')
          .limit(1)

        if (error) {
          setStatus(`❌ ERROR: ${error.message}`)
          console.error('Supabase error:', error)
        } else {
          setStatus('✅ SUCCESS: Supabase is connected!')
          console.log('Supabase connected successfully!')
        }
      } catch (error) {
        setStatus(`❌ CONNECTION FAILED: ${error}`)
        console.error('Connection failed:', error)
      }
    }

    testConnection()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Supabase Connection Test</h1>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not found'}</p>
      <p><strong>Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Not found'}</p>
    </div>
  )
}