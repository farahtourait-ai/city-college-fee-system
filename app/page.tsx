import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <div className={styles.hero}>
      <div className="container">
        <div className={styles.heroContent}>
          <h1 className={styles.title}>City Computer College</h1>
          <p className={styles.subtitle}>Fee Management System</p>
          <div className={styles.buttonGroup}>
            <Link href="/login" className="btn btn-primary">
              Admin Login
            </Link>
            <Link href="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}