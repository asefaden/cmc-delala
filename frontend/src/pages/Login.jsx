import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import i18n from '../i18n'

export default function Login({ lang }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const t = (key) => i18n[lang]?.[key] || key

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      showToast(lang === 'en' ? 'Log in successful!' : 'በስኬት ገብተዋል!')
      navigate('/dashboard')
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
            <div className="auth-icon"><KeyRound size={32} /></div>
            <h2>{t('login_title')}</h2>
            <p>{t('login_subtitle')}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>{t('lbl_email')}</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@CMCdelala.com" />
            </div>
            <div className="form-group">
              <label>{t('lbl_password')}</label>
              <div className="password-wrapper">
                <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="password-toggle-btn">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? '...' : t('btn_login_submit')}
            </button>
          </form>
          <div className="auth-footer text-center">
            <p><span>{t('login_footer')}</span> <Link to="/register">{t('btn_register')}</Link></p>
          </div>
        </div>
      </div>
    </section>
  )
}