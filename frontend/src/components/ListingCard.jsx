import { Link } from 'react-router-dom'
import { MapPin, ShieldCheck } from 'lucide-react'
import i18n from '../i18n'
// Import the helper utility you updated earlier
import { getApiBaseUrl } from '../api' 

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'

function formatPrice(price, currency = 'ETB', lang = 'en') {
  const num = Number(price)
  if (isNaN(num)) return price || ''
  const label = currency === 'ETB' ? (lang === 'en' ? 'ETB' : 'ብር') : currency
  return `${num.toLocaleString()} ${label}`
}

function formatType(type, lang = 'en') {
  const map = {
    rent: lang === 'en' ? 'For Rent' : 'ኪራይ',
    sale: lang === 'en' ? 'For Sale' : 'ሽያጭ',
    job: lang === 'en' ? 'Job' : 'ስራ',
  }
  return map[type] || (lang === 'en' ? 'Service' : 'አገልግሎት / ስራ')
}

export default function ListingCard({ listing, lang = 'en' }) {
  const t = (key) => i18n[lang]?.[key] || key;

  // Safe parsing helper setup
  let parsedImages = [];
  try {
    if (Array.isArray(listing.images)) {
      parsedImages = listing.images;
    } else if (typeof listing.images === 'string') {
      parsedImages = JSON.parse(listing.images);
    }
  } catch (err) {
    console.error("Error parsing images array within card context UI:", err);
  }

  // Get current active base path (e.g., http://localhost:3000)
  const baseUrl = getApiBaseUrl();

  // FIXED: Format local image paths as absolute server resources so they don't hit the SPA fallback router
  let rawImgUrl = parsedImages && parsedImages.length > 0 ? parsedImages[0] : DEFAULT_IMAGE;
  if (rawImgUrl.startsWith('/uploads')) {
    rawImgUrl = `${baseUrl}${rawImgUrl}`;
  }
  const imgUrl = rawImgUrl;

  // Format broker avatar path absolutely if necessary
  let brokerAvatar = listing.broker_avatar || DEFAULT_AVATAR;
  if (brokerAvatar.startsWith('/uploads')) {
    brokerAvatar = `${baseUrl}${brokerAvatar}`;
  }

  const isVerified = listing.broker_verified === 1 || listing.broker_verified === true || listing.broker_verified === '1';

  return (
    <div className="listing-card">
      <div className="listing-card-img-wrapper">
        <img
          src={imgUrl}
          alt={listing.title || 'Listing'}
          className="listing-card-img"
          onError={(e) => { 
            // Ground the error event completely to stop recursive looping loops
            e.target.onerror = null; 
            e.target.src = DEFAULT_IMAGE;
          }}
        />
        <div className="listing-card-price">{formatPrice(listing.price, listing.currency, lang)}</div>
        <div className="listing-card-type">{formatType(listing.type, lang)}</div>
      </div>

      <div className="listing-card-body">
        <div className="listing-card-location">
          <MapPin size={14} /> {listing.location || ''}
        </div>

        <h3 className="listing-card-title">{listing.title || ''}</h3>
        <p className="listing-card-desc">{listing.description || ''}</p>

        <div className="listing-card-footer">
          <div className="broker-mini-info">
            <img
              src={brokerAvatar}
              alt={listing.broker_name || 'Broker'}
              className="broker-mini-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = DEFAULT_AVATAR;
              }}
            />
            <span className="broker-mini-name">{listing.broker_name || ''}</span>
          </div>
          {isVerified && (
            <span className="badge badge-gold" title="Verified Professional Broker">
              <ShieldCheck size={14} /> {lang === 'en' ? 'Verified' : 'የተረጋገጠ'}
            </span>
          )}
        </div>

        <Link
          to={`/listing-detail/${listing.id}`}
          className="btn btn-outline btn-sm margin-top"
          style={{ textAlign: 'center', display: 'block' }}
        >
          {lang === 'en' ? 'View Details' : 'ሙሉ ዝርዝር እይ'}
        </Link>
      </div>
    </div>
  )
}