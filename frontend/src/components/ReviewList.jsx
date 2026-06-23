import StarRating from './StarRating'
import i18n from '../i18n'

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'

export default function ReviewList({ reviews, lang = 'en' }) {
  // Localization context fallback template
  const t = (key) => i18n[lang]?.[key] || key;

  if (!reviews || reviews.length === 0) {
    return (
      <p className="text-muted text-center py-5">
        {lang === 'en' ? 'No feedback received yet.' : 'እስካሁን ምንም አስተያየት አልተሰጠም።'}
      </p>
    )
  }

  /**
   * Generates a clean, human-readable locale string layout matching the active UI context
   */
  const formatDate = (dateString) => {
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return '';
      
      const localeOption = lang === 'en' ? 'en-US' : 'am-ET';
      return dateObj.toLocaleDateString(localeOption, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="reviews-list">
      {reviews.map((r) => {
        const clientName = r.client_name || (lang === 'en' ? 'Anonymous Client' : 'ስሙ ያልተጠቀሰ ተጠቃሚ');
        
        return (
          <div key={r.id} className="review-item">
            <div className="review-header-row">
              <div className="review-user-info">
                <img
                  src={r.client_avatar || DEFAULT_AVATAR}
                  alt={clientName}
                  className="review-user-avatar"
                  onError={(e) => {
                    // FIXED: Terminates potential infinite recovery asset fetching loops if offline
                    if (e.target.src !== DEFAULT_AVATAR) {
                      e.target.src = DEFAULT_AVATAR;
                    }
                  }}
                />
                <div>
                  <span className="review-user-name">{clientName}</span>
                  <StarRating rating={Number(r.rating) || 5} />
                </div>
              </div>
              <span className="review-date">{formatDate(r.created_at)}</span>
            </div>
            {r.comment && (
              <p className="review-comment">"{r.comment}"</p>
            )}
          </div>
        );
      })}
    </div>
  )
}