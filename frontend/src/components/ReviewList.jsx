import StarRating from './StarRating'
import i18n from '../i18n'

export default function ReviewList({ reviews, lang = 'en' }) {
  if (!reviews || reviews.length === 0) {
    return (
      <p className="text-muted text-center py-5">
        {lang === 'en' ? 'No feedback received yet.' : 'እስካሁን ምንም አስተያየት አልተሰጠም።'}
      </p>
    )
  }

  return (
    <div className="reviews-list">
      {reviews.map((r) => (
        <div key={r.id} className="review-item">
          <div className="review-header-row">
            <div className="review-user-info">
              <img
                src={r.client_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={r.client_name}
                className="review-user-avatar"
              />
              <div>
                <span className="review-user-name">{r.client_name}</span>
                <StarRating rating={r.rating} />
              </div>
            </div>
            <span className="review-date">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          <p className="review-comment">"{r.comment}"</p>
        </div>
      ))}
    </div>
  )
}