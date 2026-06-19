import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import i18n from '../i18n'

export default function Register({ lang }) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'client', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const t = (key) => i18n[lang]?.[key] || key

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await register(form)
      showToast(res.message || 'Registration completed. You can now log in.')
      navigate('/login')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="app-view">
      <div className="auth-card-container">
        <div className="auth-card glass-card">
          <div className="auth-header text-center">
            <div className="auth-icon"><UserPlus size={32} /></div>
            <h2>{t('reg_title')}</h2>
            <p>{t('reg_subtitle')}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>{t('lbl_fullname')}</label>
              <input type="text" required value={form.full_name} onChange={update('full_name')} placeholder="Abebe Kebede" />
            </div>
            <div className="form-group">
              <label>{t('lbl_email')}</label>
              <input type="email" required value={form.email} onChange={update('email')} placeholder="abebe@example.com" />
            </div>
            <div className="form-group">
              <label>{t('lbl_phone')}</label>
              <input type="text" required value={form.phone} onChange={update('phone')} placeholder="e.g. +251912345678 or 0912345678" />
              <small className="form-help">{t('lbl_phone_help')}</small>
            </div>
            <div className="form-group">
              <label>{t('lbl_role')}</label>
              <select value={form.role} onChange={update('role')} required>
                <option value="client">{t('opt_role_client')}</option>
                <option value="broker">{t('opt_role_broker')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('lbl_password')}</label>
              <div className="password-wrapper">
                <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={update('password')} placeholder="Min 8 characters, letters & numbers" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="password-toggle-btn">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? '...' : t('btn_register_submit')}
            </button>
          </form>
          <div className="auth-footer text-center">
            <p><span>{t('reg_footer')}</span> <Link to="/login">{t('btn_login')}</Link></p>
          </div>
        </div>
      </div>
    </section>
  )
}