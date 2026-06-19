import { Link } from 'react-router-dom'
import { MapPin, ShieldCheck } from 'lucide-react'
import StarRating from './StarRating'
import i18n from '../i18n'

function formatPrice(price, currency = 'ETB', lang = 'en') {
  return `${Number(price).toLocaleString()} ${currency === 'ETB' ? (lang === 'en' ? 'ETB' : 'ብር') : currency}`
}

function formatType(type, lang = 'en') {
  const map = { rent: lang === 'en' ? 'For Rent' : 'ኪራይ', sale: lang === 'en' ? 'For Sale' : 'ሽያጭ' }
  return map[type] || (lang === 'en' ? 'Service' : 'አገልግሎት / ስራ')
}

export default function ListingCard({ listing, lang = 'en' }) {
  const imgUrl =
    listing.images && listing.images.length > 0
      ? listing.images[0]
      : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'

  const t = (key) => i18n[lang]?.[key] || key

  return (
    <div className="listing-card">
      <div className="listing-card-img-wrapper">
        <img
          src={imgUrl}
          alt={listing.title}
          className="listing-card-img"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'
          }}
        />
        <div className="listing-card-price">{formatPrice(listing.price, listing.currency, lang)}</div>
        <div className="listing-card-type">{formatType(listing.type, lang)}</div>
      </div>
      <div className="listing-card-body">
        <div className="listing-card-location">
          <MapPin size={14} /> {listing.location}
        </div>
        <h3 className="listing-card-title">{listing.title}</h3>
        <p className="listing-card-desc">{listing.description}</p>
        <div className="listing-card-footer">
          <div className="broker-mini-info">
            <img
              src={listing.broker_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={listing.broker_name}
              className="broker-mini-avatar"
            />
            <div>
              <span className="broker-mini-name">{listing.broker_name}</span>
            </div>
          </div>
          {listing.broker_verified === 1 && (
            <span className="badge badge-gold" title="Verified Professional Broker">
              <ShieldCheck size={14} /> {lang === 'en' ? 'Verified' : 'የተረጋገጠ'}
            </span>
          )}
        </div>
        <Link to={`/listing-detail/${listing.id}`} className="btn btn-outline btn-sm margin-top" style={{ textAlign: 'center' }}>
          {lang === 'en' ? 'View Details' : 'ሙሉ ዝርዝር እይ'}
        </Link>
      </div>
    </div>
  )
}