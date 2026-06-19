import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Languages, ChevronDown, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { showToast } from './Toast'
import i18n from '../i18n'

export default function Header({ lang, setLang }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      showToast(lang === 'en' ? 'Logged out successfully.' : 'በስኬት ውጥረዋል!')
      navigate('/')
    } catch {
      showToast(lang === 'en' ? 'Logout error.' : 'ስህተት ተፈጥሯል!', 'error')
    }
  }

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'am' : 'en'
    setLang(newLang)
    localStorage.setItem('lang', newLang)
  }

  return (
    <header className="main-header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-icon"><ShieldCheck size={24} /></span>
          <span className="logo-text">
            ሲኤምሲ <span className="accent">ደላላ</span>{' '}
            <span className="sub-logo">CMC Delal</span>
          </span>
        </Link>

        <nav className="nav-links">
          <Link to="/" className="nav-link">{t('nav_home')}</Link>
          <Link to="/listings" className="nav-link">{t('nav_listings')}</Link>
          <Link to="/brokers" className="nav-link">{t('nav_brokers')}</Link>
        </nav>

        <div className="header-actions">
          <button onClick={toggleLang} className="btn-icon lang-btn" title="Switch Language">
            <Languages size={18} />
            <span id="lang-label">{lang === 'en' ? 'አማርኛ' : 'English'}</span>
          </button>

          {!user ? (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline">{t('btn_login')}</Link>
              <Link to="/register" className="btn btn-primary">{t('btn_register')}</Link>
            </div>
          ) : (
            <div className="user-profile-menu dropdown" ref={dropdownRef}>
              <div
                className="profile-trigger"
                onClick={(e) => {
                  e.stopPropagation()
                  setDropdownOpen(!dropdownOpen)
                }}
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt="Avatar"
                  className="user-avatar-small"
                />
                <span className="username-display">{user.full_name}</span>
                <ChevronDown size={16} className="dropdown-chevron" />
              </div>
              <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                <Link to="/dashboard" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <LayoutDashboard size={16} /> {t('menu_dashboard')}
                </Link>
                <button className="dropdown-item text-danger" onClick={handleLogout}>
                  <LogOut size={16} /> {t('menu_logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}