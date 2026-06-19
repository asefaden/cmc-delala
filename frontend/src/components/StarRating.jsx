import { Star, StarHalf } from 'lucide-react'

export default function StarRating({ rating, size = 16 }) {
  const rounded = Math.round(rating * 2) / 2
  const stars = []

  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      stars.push(<Star key={i} size={size} className="text-gold fill-gold" />)
    } else if (i - 0.5 === rounded) {
      stars.push(<StarHalf key={i} size={size} className="text-gold fill-gold" />)
    } else {
      stars.push(<Star key={i} size={size} className="text-muted" />)
    }
  }

  return <div className="stars-row">{stars}</div>
}