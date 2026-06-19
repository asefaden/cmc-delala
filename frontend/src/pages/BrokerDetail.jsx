import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Send, ShieldCheck, ShieldAlert, Star } from 'lucide-react'
import { apiRequest } from '../api'
import { useAuth } from '../context/AuthContext'
import StarRating from '../components/StarRating'
import ReviewList from '../components/ReviewList'
import { showToast } from '../components/Toast'
import i18n from '../i18n'

function formatPrice(price, currency = 'ETB', lang = 'en') {
  return `${Number(price).toLocaleString()} ${currency === 'ETB' ? (lang === 'en' ? 'ETB' : 'ብር') : currency}`
}
function formatCategory(cat, lang = 'en') {
  if (cat === 'real_estate') return lang === 'en' ? 'Real Estate' : 'ቤቶች'
  if (cat === 'vehicle') return lang === 'en' ? 'Vehicle' : 'መኪና'
  return lang === 'en' ? 'Services' : 'አገልግሎት'
}

export default function BrokerDetail({ lang }) {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    async function load() {
      try {
        const result = await apiRequest(`/api/brokers/${id}`)
        setData(result)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const submitReview = async (e) => {
    e.preventDefault()
    if (!rating) {
      showToast('Please select a star rating first.', 'error')
      return
    }
    try {
      const res = await apiRequest(`/api/brokers/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      })
      showToast(res.message || 'Review submitted!')
      setRating(0)
      setComment('')
      const result = await apiRequest(`/api/brokers/${id}`)
      setData(result)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loading) return <div className="loading-spinner"></div>
  if (!data) return <p className="text-danger text-center">Broker not found.</p>

  const b = data.broker

  return (
    <section className="app-view">
      <div className="detail-back-link">
        <Link to="/brokers" className="btn-text">
          <ArrowLeft size={16} /> {t('btn_back_brokers')}
        </Link>
      </div>
      <div className="detail-layout">
        <div>
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <div className="dashboard-profile-info" style={{ marginBottom: '1.5rem' }}>
              <img
                src={b.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={b.full_name}
                className="dash-avatar"
              />
              <div>
                <div className="dash-name-row">
                  <h2>{b.full_name}</h2>
                  {b.verified === 1 ? (
                    <span className="badge badge-gold"><ShieldCheck size={14} /> {lang === 'en' ? 'Gold Verified Broker' : 'ባለወርቅ ባጅ የተረጋገጠ ደላላ'}</span>
                  ) : (
                    <span className="badge"><ShieldAlert size={14} /> {lang === 'en' ? 'Standard Profile' : 'መደበኛ መገለጫ'}</span>
                  )}
                </div>
                <div className="broker-card-rating">
                  <StarRating rating={b.rating_avg || 0} />
                  <span>({Number(b.rating_avg).toFixed(1)} / 5.0)</span>
                </div>
                <p className="dash-meta">Joined: {new Date(b.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{t('lbl_bio')}</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>{b.bio || 'No bio written.'}</p>
            <div className="broker-contacts" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <a href={`tel:${b.phone}`} className="btn btn-outline btn-sm"><Phone size={14} /> Call: {b.phone}</a>
              {b.telegram_username && (
                <a href={`https://t.me/${b.telegram_username}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  <Send size={14} /> Telegram
                </a>
              )}
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem' }}>{lang === 'en' ? 'User Reviews' : 'የደንበኞች አስተያየቶች'} ({data.reviews.length})</h3>
            <ReviewList reviews={data.reviews} lang={lang} />
          </div>

          {user && user.id !== b.id && user.role === 'client' && (
            <div className="glass-card review-form-card margin-top">
              <h3>{t('review_form_title')}</h3>
              <form onSubmit={submitReview}>
                <div className="form-group">
                  <label>{t('lbl_rating')}</label>
                  <div className="rating-select-group">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Star
                        key={v}
                        size={24}
                        className={`star-input ${v <= rating ? 'active fill-gold text-gold' : 'text-muted'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setRating(v)}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('lbl_comment')}</label>
                  <textarea
                    rows={3}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe your experience with this broker..."
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm margin-top">{t('btn_submit_verif')}</button>
              </form>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem' }}>{lang === 'en' ? 'Broker Listings' : 'የደላላው ፖስቶች'} ({data.listings.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {data.listings.length === 0 ? (
              <p className="text-center text-muted" style={{ gridColumn: '1/-1', padding: '2rem' }}>
                {lang === 'en' ? 'No active listings.' : 'የለጠፈው ዝርዝር የለም።'}
              </p>
            ) : (
              data.listings.map((l) => {
                const imgUrl = l.images && l.images.length > 0 ? l.images[0] : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'
                return (
                  <div key={l.id} className="listing-card">
                    <div className="listing-card-img-wrapper" style={{ height: '140px' }}>
                      <img src={imgUrl} alt={l.title} className="listing-card-img" />
                      <div className="listing-card-price" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>{formatPrice(l.price, l.currency, lang)}</div>
                    </div>
                    <div className="listing-card-body" style={{ padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{formatCategory(l.category, lang)}</span>
                      <h4 style={{ fontSize: '0.9rem', margin: '0.25rem 0', fontWeight: 600 }}>{l.title}</h4>
                      <Link to={`/listing-detail/${l.id}`} className="btn btn-outline btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', textAlign: 'center', width: '100%', marginTop: '0.5rem' }}>View</Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}