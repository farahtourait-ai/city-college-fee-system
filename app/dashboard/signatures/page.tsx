'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import styles from './signatures.module.css'

interface Signature {
  id: string
  type: 'text' | 'image'
  signature_data: string
  designation: string
  is_active: boolean
  created_at: string
}

export default function SignatureManagement() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'text' as 'text' | 'image',
    signature_data: '',
    designation: ''
  })
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchSignatures()
  }, [])

  const checkAuth = () => {
    const admin = localStorage.getItem('admin')
    if (!admin) {
      router.push('/login')
    }
  }

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setSignatures(data || [])
    } catch (error) {
      console.error('Error fetching signatures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.designation.trim()) {
      alert('Please enter designation')
      return
    }

    if (formData.type === 'text' && !formData.signature_data.trim()) {
      alert('Please enter signature text')
      return
    }

    try {
      const admin = JSON.parse(localStorage.getItem('admin') || '{}')
      
      const { error } = await supabase
        .from('signatures')
        .insert([{
          type: formData.type,
          signature_data: formData.signature_data,
          designation: formData.designation,
          admin_id: admin.name || 'Admin'
        }])

      if (error) throw error

      alert('Signature added successfully!')
      setShowAddForm(false)
      setFormData({ type: 'text', signature_data: '', designation: '' })
      fetchSignatures()
    } catch (error) {
      console.error('Error adding signature:', error)
      alert('Error adding signature')
    }
  }

  const setActiveSignature = async (id: string) => {
    try {
      // Deactivate all signatures first
      await supabase
        .from('signatures')
        .update({ is_active: false })

      // Activate the selected one
      const { error } = await supabase
        .from('signatures')
        .update({ is_active: true })
        .eq('id', id)

      if (error) throw error

      fetchSignatures()
      alert('Signature set as active!')
    } catch (error) {
      console.error('Error setting active signature:', error)
      alert('Error updating signature')
    }
  }

  const deleteSignature = async (id: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) return

    try {
      const { error } = await supabase
        .from('signatures')
        .delete()
        .eq('id', id)

      if (error) throw error

      fetchSignatures()
      alert('Signature deleted successfully!')
    } catch (error) {
      console.error('Error deleting signature:', error)
      alert('Error deleting signature')
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading signatures...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>Signature Management</h1>
              <p className={styles.subtitle}>Manage authorized signatures for challans</p>
            </div>
            <Link href="/dashboard" className={styles.backButton}>
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          {/* Instructions */}
          <div className={styles.infoCard}>
            <h3>How to Set Up Signatures</h3>
            <p><strong>Text Signatures:</strong> Enter the name of authorized person (e.g., "Dr. John Smith")</p>
            <p><strong>Image Signatures:</strong> Currently supports text only. Digital signature images coming soon.</p>
            <p><strong>Active Signature:</strong> Only one signature can be active at a time. This will be used in all challans.</p>
          </div>

          {/* Add Signature Button */}
          <div className={styles.actionsBar}>
            <button 
              onClick={() => setShowAddForm(true)}
              className={styles.addButton}
            >
              + Add New Signature
            </button>
          </div>

          {/* Add Signature Form */}
          {showAddForm && (
            <div className={styles.formCard}>
              <h3>Add New Signature</h3>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Signature Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as 'text' | 'image'})}
                    className={styles.input}
                  >
                    <option value="text">Text Signature</option>
                    <option value="image" disabled>Image Signature (Coming Soon)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Designation *</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g., Principal, Director, Cashier"
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Signature Text *</label>
                  <input
                    type="text"
                    value={formData.signature_data}
                    onChange={(e) => setFormData({...formData, signature_data: e.target.value})}
                    placeholder="e.g., Dr. John Smith"
                    className={styles.input}
                    required
                  />
                  <small>This text will appear as the signature in challans</small>
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className={styles.cancelButton}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={styles.submitButton}
                    disabled={uploading}
                  >
                    Add Signature
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Signatures List */}
          <div className={styles.signaturesList}>
            <h3>Available Signatures</h3>
            
            {signatures.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No signatures found. Add your first signature to use in challans.</p>
                <button 
                  onClick={() => setShowAddForm(true)}
                  className={styles.addButton}
                >
                  Add Your First Signature
                </button>
              </div>
            ) : (
              <div className={styles.signaturesGrid}>
                {signatures.map((signature) => (
                  <div key={signature.id} className={`${styles.signatureCard} ${signature.is_active ? styles.active : ''}`}>
                    <div className={styles.signatureHeader}>
                      <span className={styles.typeBadge}>
                        {signature.type === 'text' ? 'Text' : 'Image'}
                      </span>
                      {signature.is_active && (
                        <span className={styles.activeBadge}>Active</span>
                      )}
                    </div>

                    <div className={styles.signatureContent}>
                      <div className={styles.textSignature}>
                        <div className={styles.signatureText}>{signature.signature_data}</div>
                      </div>
                      
                      <div className={styles.designation}>
                        {signature.designation}
                      </div>
                    </div>

                    <div className={styles.signatureActions}>
                      {!signature.is_active && (
                        <button 
                          onClick={() => setActiveSignature(signature.id)}
                          className={styles.activateButton}
                        >
                          Set Active
                        </button>
                      )}
                      <button 
                        onClick={() => deleteSignature(signature.id)}
                        className={styles.deleteButton}
                      >
                        Delete
                      </button>
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