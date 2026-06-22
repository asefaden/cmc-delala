import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Languages, ChevronDown, LayoutDashboard, LogOut, Menu, X, Home, List, Users, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { showToast } from './Toast'
import i18n from '../i18n'

export default function Header({ lang, setLang }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const mobileMenuRef = useRef(null)

  const t = (key) => i18n[lang]?.[key] || key

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const handleLogout = async () => {
    try {
      await logout()
      setMobileMenuOpen(false)
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

  const isActive = (path) => location.pathname === path ? 'active' : ''

  const navIconSize = 18

  return (
    <>
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
            <Link to="/" className={`nav-link ${isActive('/')}`}>{t('nav_home')}</Link>
            <Link to="/listings" className={`nav-link ${isActive('/listings')}`}>{t('nav_listings')}</Link>
            <Link to="/brokers" className={`nav-link ${isActive('/brokers')}`}>{t('nav_brokers')}</Link>
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

            {/* Hamburger button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <div
        className={`mobile-nav-overlay ${mobileMenuOpen ? 'show' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Navigation Panel */}
      <div
        className={`mobile-nav-panel ${mobileMenuOpen ? 'show' : ''}`}
        ref={mobileMenuRef}
      >
        <div className="mobile-nav-header">
          <Link to="/" className="logo" style={{ fontSize: '1.15rem' }}>
            <span className="logo-icon"><ShieldCheck size={20} /></span>
            <span className="logo-text">
              ሲኤምሲ <span className="accent">ደላላ</span>
            </span>
          </Link>
          <button
            className="mobile-nav-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* User info (if logged in) */}
        {user && (
          <div className="mobile-nav-user-info">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt="Avatar"
            />
            <div className="user-details">
              <span className="user-name">{user.full_name}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="mobile-nav-links">
          <Link to="/" className={`mobile-nav-link ${isActive('/')}`}>
            <Home size={navIconSize} /> {t('nav_home')}
          </Link>
          <Link to="/listings" className={`mobile-nav-link ${isActive('/listings')}`}>
            <List size={navIconSize} /> {t('nav_listings')}
          </Link>
          <Link to="/brokers" className={`mobile-nav-link ${isActive('/brokers')}`}>
            <Users size={navIconSize} /> {t('nav_brokers')}
          </Link>
          {user && (
            <Link to="/dashboard" className={`mobile-nav-link ${isActive('/dashboard')}`}>
              <LayoutDashboard size={navIconSize} /> {t('menu_dashboard')}
            </Link>
          )}
        </div>

        <div className="mobile-nav-divider" />

        {/* Actions */}
        <div className="mobile-nav-actions">
          <button onClick={toggleLang} className="mobile-nav-lang-btn">
            <Languages size={18} />
            {lang === 'en' ? 'አማርኛ' : 'English'}
          </button>

          {!user ? (
            <>
              <Link to="/login" className="btn btn-outline btn-block" onClick={() => setMobileMenuOpen(false)}>
                <LogIn size={16} /> {t('btn_login')}
              </Link>
              <Link to="/register" className="btn btn-primary btn-block" onClick={() => setMobileMenuOpen(false)}>
                <UserPlus size={16} /> {t('btn_register')}
              </Link>
            </>
          ) : (
            <button className="btn btn-outline btn-block text-danger" onClick={handleLogout}>
              <LogOut size={16} /> {t('menu_logout')}
            </button>
          )}
        </div>
      </div>
    </>
  )
}