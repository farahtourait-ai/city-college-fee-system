'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

// List of allowed email addresses (HIDDEN from UI)
const ALLOWED_EMAILS = [
  'hassancitycollege222@gmail.com',
  'farahtourait@gmail.com', 
  'hassanrashid339@gmail.com'
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Check if email is in allowed list
  const isEmailAllowed = (email: string): boolean => {
    return ALLOWED_EMAILS.includes(email.toLowerCase().trim())
  }

  // Validate admin credentials
  const validateAdminCredentials = (email: string, password: string): boolean => {
    // Simple validation - in production use proper password hashing
    const validCredentials = [
      { email: 'hassancitycollege222@gmail.com', password: 'youarenot@8765' },
      { email: 'farahtourait@gmail.com', password: 'youarenot@8765' },
      { email: 'hassanrashid339@gmail.com', password: 'youarenot@8765' }
    ]
    
    return validCredentials.some(cred => 
      cred.email === email.toLowerCase().trim() && 
      cred.password === password
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Trim and lowercase email for consistency
      const normalizedEmail = email.toLowerCase().trim()
      
      // Check if email is allowed
      if (!isEmailAllowed(normalizedEmail)) {
        setError('Access denied. Please use authorized credentials.')
        setLoading(false)
        return
      }

      // Validate credentials
      if (validateAdminCredentials(normalizedEmail, password)) {
        // Get admin name based on email
        let adminName = 'Administrator'
        if (normalizedEmail.includes('hassancitycollege')) {
          adminName = 'Hassan City College'
        } else if (normalizedEmail.includes('farahtourait')) {
          adminName = 'Farah Tourait'
        } else if (normalizedEmail.includes('hassanrashid')) {
          adminName = 'Hassan Rashid'
        }

        const adminData = {
          id: '1',
          name: adminName,
          email: normalizedEmail,
          role: 'admin',
          allowedEmail: true,
          loginTime: new Date().getTime()
        }
        
        // Store in localStorage
        localStorage.setItem('admin', JSON.stringify(adminData))
        
        // Also store in session for security
        sessionStorage.setItem('admin_session', JSON.stringify({
          email: normalizedEmail,
          timestamp: new Date().getTime(),
          ip: 'secure'
        }))
        
        router.push('/dashboard')
      } else {
        setError('Invalid email or password. Please check your credentials.')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h2 className={styles.loginTitle}>College Fee System</h2>
          <p className={styles.loginSubtitle}>City Computer College - Admin Portal</p>
          <div className={styles.securityNotice}>
            <small>Restricted access. Authorized personnel only.</small>
          </div>
        </div>
        
        <form className={styles.loginForm} onSubmit={handleLogin}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className={styles.input}
              placeholder="Enter your authorized email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={styles.input}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Authenticating...
              </>
            ) : (
              'Sign in to Dashboard'
            )}
          </button>

          {/* Security Information */}
          <div className={styles.securityInfo}>
            <p><strong>Security Information:</strong></p>
            <ul>
              <li>Access restricted to authorized administrators only</li>
              <li>All login attempts are monitored</li>
              <li>Use strong passwords and keep them confidential</li>
              <li>Log out after each session</li>
            </ul>
            <p className={styles.contactSupport}>
              Need access? Contact system administrator.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className={styles.loginFooter}>
          <p className={styles.versionInfo}>
            Fee Management System v1.0 • City Computer College
          </p>
          <p className={styles.privacyNotice}>
            <small>Your privacy is important. We don't share your information.</small>
          </p>
        </div>
      </div>
    </div>
  )
}