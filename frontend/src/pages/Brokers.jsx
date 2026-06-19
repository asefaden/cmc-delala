import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, User } from 'lucide-react'
import { apiRequest } from '../api'
import StarRating from '../components/StarRating'
import i18n from '../i18n'

export default function Brokers({ lang }) {
  const [brokers, setBrokers] = useState([])
  const [loading, setLoading] = useState(true)
  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest('/api/brokers')
        setBrokers(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section className="app-view">
      <div className="view-header text-center">
        <h1>{t('brokers_title')}</h1>
        <p>{t('brokers_desc')}</p>
      </div>
      <div className="brokers-grid-container">
        <div className="brokers-grid">
          {loading ? (
            <div className="loading-spinner"></div>
          ) : brokers.length === 0 ? (
            <p className="text-center w-full col-span-3">{lang === 'en' ? 'No brokers registered.' : 'ምንም አልተመዘገቡም።'}</p>
          ) : (
            brokers.map((b) => (
              <div key={b.id} className="glass-card broker-card">
                <img
                  src={b.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={b.full_name}
                  className="broker-card-avatar"
                />
                <div className="broker-card-name-row">
                  <h3>{b.full_name}</h3>
                </div>
                <div className="margin-bottom">
                  {b.verified === 1 ? (
                    <span className="badge badge-gold"><ShieldCheck size={14} /> {lang === 'en' ? 'Verified' : 'የተረጋገጠ'}</span>
                  ) : (
                    <span className="badge"><ShieldAlert size={14} /> {lang === 'en' ? 'Standard' : 'መደበኛ'}</span>
                  )}
                </div>
                <div className="broker-card-rating">
                  <StarRating rating={b.rating_avg || 0} />
                  <span>({Number(b.rating_avg).toFixed(1)})</span>
                </div>
                <p className="broker-card-bio">{b.bio || (lang === 'en' ? 'No bio description provided.' : 'መግለጫ አልተጻፈም።')}</p>
                <div className="broker-card-stats">
                  <div className="broker-card-stat">
                    <span>{b.active_listings_count}</span>
                    {lang === 'en' ? 'Listings' : 'ፖስቶች'}
                  </div>
                  <div className="broker-card-stat">
                    <span>{b.review_count}</span>
                    {lang === 'en' ? 'Reviews' : 'አስተያየቶች'}
                  </div>
                </div>
                <div className="broker-card-footer">
                  <Link to={`/broker-detail/${b.id}`} className="btn btn-outline btn-block">
                    <User size={16} /> View Profile & Reviews
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}