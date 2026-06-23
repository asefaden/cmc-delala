import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, MapPin, Home as HomeIcon, Star, Car, Briefcase, ArrowRight, Fingerprint } from 'lucide-react'
import { apiRequest } from '../api'
import ListingCard from '../components/ListingCard'
import i18n from '../i18n'

export default function Home({ lang }) {
  const navigate = useNavigate()
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchVal, setSearchVal] = useState('')
  const [locVal, setLocVal] = useState('')

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest('/api/listings')
        const items = Array.isArray(data) ? data : (data?.listings || data?.data || [])
        setFeatured(items.slice(0, 3))
      } catch (err) {
        console.error('Failed to load featured listings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSearch = () => {
    navigate(`/listings?search=${encodeURIComponent(searchVal)}&location=${encodeURIComponent(locVal)}`)
  }

  const categories = [
    { key: 'real_estate', icon: <HomeIcon size={24} />, cls: 'estate' },
    { key: 'vehicle', icon: <Car size={24} />, cls: 'vehicle' },
    { key: 'services', icon: <Briefcase size={24} />, cls: 'service' },
  ]

  const descKeys = {
    real_estate: 'cat_real_estate_desc',
    vehicle: 'cat_vehicles_desc',
    services: 'cat_services_desc',
  }

  const nameKeys = {
    real_estate: 'cat_real_estate',
    vehicle: 'cat_vehicles',
    services: 'cat_services',
  }

  return (
    <section className="app-view">
      <div className="hero-section">
        <div className="hero-content">
          <span className="badge badge-gold">
            <Shield size={14} /> {t('hero_badge')}
          </span>
          <h1 className="hero-title">
            <span>{t('hero_title_1')}</span>{' '}
            <span className="text-gradient">{t('hero_title_2')}</span>
          </h1>
          <p className="hero-subtitle">{t('hero_desc')}</p>

          <div className="search-container">
            <div className="search-bar">
              <div className="search-field">
                <Search size={18} />
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Search apartments, cars, jobs...' : 'ቤቶች፣ መኪኖች ወይም ስራዎች ይፈልጉ...'}
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="search-field select-field">
                <MapPin size={18} />
                <select value={locVal} onChange={(e) => setLocVal(e.target.value)}>
                  <option value="">{t('opt_all_locations')}</option>
                  <option value="Bole">Bole (ቦሌ)</option>
                  <option value="Yeka">Yeka (የካ)</option>
                  <option value="Arada">Arada (አራዳ)</option>
                  <option value="Kirkos">Kirkos (ኪርቆስ)</option>
                  <option value="Nifas Silk">Nifas Silk (ንፋስ ስልክ)</option>
                  <option value="Lideta">Lideta (ልደታ)</option>
                </select>
              </div>
              <button onClick={handleSearch} className="btn btn-primary search-btn">
                {t('btn_search')}
              </button>
            </div>
          </div>
        </div>

        <div className="hero-image-container">
          <div className="glass-card decorative-card card-1">
            <HomeIcon size={24} className="card-icon text-gold" />
            <div>
              <h4>{t('cat_real_estate')}</h4>
              <p>{t('feat_desc')}</p>
            </div>
          </div>
          <div className="glass-card decorative-card card-2">
            <Star size={24} className="card-icon text-emerald animate-pulse" />
            <div>
              <h4>Abeba Kiros!</h4>
              <p>★ 5.0 Rated Broker</p>
            </div>
          </div>
          <div className="hero-placeholder-visual">
            <div className="visual-circle circle-bg"></div>
            <div className="visual-circle circle-glow"></div>
            <div className="visual-graphic">
              <Fingerprint size={80} className="giant-icon" />
            </div>
          </div>
        </div>
      </div>

      <div className="section-container">
        <h2 className="section-title text-center">{t('cat_title')}</h2>
        <div className="category-grid">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="category-card"
              onClick={() => navigate(`/listings?category=${cat.key}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`cat-icon-wrapper ${cat.cls}`}>{cat.icon}</div>
              <h3>{t(nameKeys[cat.key])}</h3>
              <p>{t(descKeys[cat.key])}</p>
              <span className="cat-link">
                {t('cat_explore')} <ArrowRight size={14} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-container bg-dark-tint">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">{t('feat_title')}</h2>
            <p className="section-subtitle">{t('feat_desc')}</p>
          </div>
          <button onClick={() => navigate('/listings')} className="btn btn-outline btn-sm">
            {t('btn_view_all')}
          </button>
        </div>
        <div className="listings-grid">
          {loading ? (
            <div className="loading-spinner"></div>
          ) : featured.length === 0 ? (
            <p className="text-center w-full col-span-3">{t('lbl_no_listings')}</p>
          ) : (
            featured.map((l) => <ListingCard key={l.id} listing={l} lang={lang} />)
          )}
        </div>
      </div>
    </section>
  )
}