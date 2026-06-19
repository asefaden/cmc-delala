import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Tag, Clock, Phone, Send, ShieldCheck, ShieldAlert, User } from 'lucide-react'
import { apiRequest } from '../api'
import StarRating from '../components/StarRating'
import i18n from '../i18n'

function formatPrice(price, currency = 'ETB', lang = 'en') {
  return `${Number(price).toLocaleString()} ${currency === 'ETB' ? (lang === 'en' ? 'ETB' : 'ብር') : currency}`
}

function formatCategory(cat, lang = 'en') {
  if (cat === 'real_estate') return lang === 'en' ? 'Real Estate' : 'ቤቶች / መሬት'
  if (cat === 'vehicle') return lang === 'en' ? 'Vehicle' : 'መኪና'
  return lang === 'en' ? 'Services' : 'አገልግሎት'
}

function formatType(type, lang = 'en') {
  if (type === 'rent') return lang === 'en' ? 'For Rent' : 'ኪራይ'
  if (type === 'sale') return lang === 'en' ? 'For Sale' : 'ሽያጭ'
  return lang === 'en' ? 'Service' : 'አገልግሎት'
}

export default function ListingDetail({ lang }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest(`/api/listings/${id}`)
        setListing(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  if (loading) return <div className="loading-spinner"></div>
  if (!listing) return <p className="text-danger text-center">Listing not found.</p>

  const imgUrl =
    listing.images && listing.images.length > 0
      ? listing.images[0]
      : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'

  return (
    <section className="app-view">
      <div className="detail-back-link">
        <Link to="/listings" className="btn-text">
          <ArrowLeft size={16} /> {t('btn_back_listings')}
        </Link>
      </div>
      <div className="detail-layout">
        <div>
          <div className="detail-gallery">
            <img
              src={imgUrl}
              alt={listing.title}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'
              }}
            />
          </div>
          <h1 className="detail-info-title">{listing.title}</h1>
          <div className="detail-meta-row">
            <div className="detail-meta-item"><MapPin size={16} /> <span>{listing.location}</span></div>
            <div className="detail-meta-item"><Tag size={16} /> <span>{formatCategory(listing.category, lang)} ({formatType(listing.type, lang)})</span></div>
            <div className="detail-meta-item"><Clock size={16} /> <span>{new Date(listing.created_at).toLocaleDateString()}</span></div>
          </div>
          <h2 className="detail-desc-title">{t('lbl_description')}</h2>
          <p className="detail-desc-content">{listing.description}</p>
          <h2 className="detail-desc-title" style={{ marginTop: '1.5rem' }}>{formatPrice(listing.price, listing.currency, lang)}</h2>
        </div>

        <aside>
          <div className="glass-card detail-broker-card">
            <img
              src={listing.broker_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={listing.broker_name}
              className="detail-broker-avatar"
            />
            <div className="detail-broker-name-row">
              <h3>{listing.broker_name}</h3>
            </div>
            <div className="margin-bottom">
              {listing.broker_verified === 1 ? (
                <span className="badge badge-gold"><ShieldCheck size={14} /> {lang === 'en' ? 'Gold Verified Delala' : 'ባለወርቅ ባጅ የተረጋገጠ ደላላ'}</span>
              ) : (
                <span className="badge"><ShieldAlert size={14} /> {lang === 'en' ? 'Standard Account' : 'መደበኛ መለያ'}</span>
              )}
            </div>
            <div className="detail-broker-rating">
              <StarRating rating={listing.broker_verified === 1 ? 5 : 4} />
              <span>({listing.broker_verified === 1 ? '5.0' : '4.0'})</span>
            </div>
            <p className="detail-broker-bio">{listing.broker_bio || (lang === 'en' ? 'Professional broker listed on CMC Delal.' : 'በሲኤምሲ ደላላ የተመዘገቡ ባለሙያ ደላላ።')}</p>
            <div className="broker-contacts">
              <a href={`tel:${listing.broker_phone}`} className="btn btn-outline"><Phone size={16} /> Call: {listing.broker_phone}</a>
              {listing.broker_telegram && (
                <a href={`https://t.me/${listing.broker_telegram}`} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <Send size={16} /> Message on Telegram
                </a>
              )}
              <Link to={`/broker-detail/${listing.broker_id}`} className="btn btn-outline" style={{ marginTop: '0.5rem' }}>
                <User size={16} /> View Profile
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}