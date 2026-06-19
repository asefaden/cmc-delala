import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, Inbox } from 'lucide-react'
import { apiRequest } from '../api'
import ListingCard from '../components/ListingCard'
import i18n from '../i18n'

export default function Listings({ lang }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    type: searchParams.get('type') || '',
    location: searchParams.get('location') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    search: searchParams.get('search') || '',
  })

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.type) params.append('type', filters.type)
      if (filters.location) params.append('location', filters.location)
      if (filters.minPrice) params.append('minPrice', filters.minPrice)
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice)
      if (filters.search) params.append('search', filters.search)

      try {
        const data = await apiRequest(`/api/listings?${params.toString()}`)
        setListings(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters])

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({ category: '', type: '', location: '', minPrice: '', maxPrice: '', search: '' })
  }

  return (
    <section className="app-view">
      <div className="view-header">
        <h1>{t('nav_listings')}</h1>
        <p>{lang === 'en' ? 'Find real estate, vehicles, and services listings in Addis Ababa.' : 'በአዲስ አበባ ውስጥ የቤት እስቴት፣ መኪና እና አገልግሎት ዝርዝሮችን ያግኙ።'}</p>
      </div>

      <div className="marketplace-layout">
        <aside className="filter-sidebar glass-card">
          <div className="filter-section-title">
            <SlidersHorizontal size={16} /> <span>{t('lbl_filters')}</span>
            <button onClick={clearFilters} className="btn-text">{t('btn_clear')}</button>
          </div>

          <div className="filter-group">
            <label>{t('lbl_category')}</label>
            <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
              <option value="">{t('opt_all')}</option>
              <option value="real_estate">{t('cat_real_estate')}</option>
              <option value="vehicle">{t('cat_vehicles')}</option>
              <option value="services">{t('cat_services')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label>{t('lbl_type')}</label>
            <select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
              <option value="">{t('opt_all_types')}</option>
              <option value="rent">{t('opt_rent')}</option>
              <option value="sale">{t('opt_sale')}</option>
              <option value="job">{t('opt_job')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label>{t('lbl_location')}</label>
            <select value={filters.location} onChange={(e) => updateFilter('location', e.target.value)}>
              <option value="">{t('opt_all_locations')}</option>
              <option value="Bole">Bole (ቦሌ)</option>
              <option value="Yeka">Yeka (የካ)</option>
              <option value="Arada">Arada (አራዳ)</option>
              <option value="Kirkos">Kirkos (ኪርቆስ)</option>
              <option value="Nifas Silk">Nifas Silk (ንፋስ ስልክ)</option>
              <option value="Lideta">Lideta (ልደታ)</option>
              <option value="Kolfe Keranio">Kolfe Keranio (ኮልፌ ቀራኒዮ)</option>
              <option value="Gullele">Gullele (ጉለሌ)</option>
              <option value="Akaki Kality">Akaki Kality (አቃቂ ቃሊቲ)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>{t('lbl_price_range')}</label>
            <div className="range-inputs">
              <input type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => updateFilter('minPrice', e.target.value)} />
              <input type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => updateFilter('maxPrice', e.target.value)} />
            </div>
          </div>

          <div className="filter-group">
            <label>{t('lbl_keyword')}</label>
            <input
              type="text"
              placeholder={lang === 'en' ? 'e.g. furnished, Toyota...' : 'ለምሳሌ፡ የተሟላለት፣ ቶዮታ...'}
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
        </aside>

        <div className="listings-results-container">
          <div className="results-toolbar">
            <span>
              {loading
                ? '...'
                : lang === 'en'
                ? `${listings.length} listings found`
                : `${listings.length} ዝርዝሮች ተገኝተዋል`}
            </span>
          </div>
          <div className="listings-grid">
            {loading ? (
              <div className="loading-spinner"></div>
            ) : listings.length === 0 ? (
              <div className="text-center w-full col-span-3 py-10">
                <Inbox size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
                <p>{lang === 'en' ? 'No listings match your filter criteria.' : 'ከማጣሪያዎ ጋር የሚዛመድ ዝርዝር አልተገኘም።'}</p>
              </div>
            ) : (
              listings.map((l) => <ListingCard key={l.id} listing={l} lang={lang} />)
            )}
          </div>
        </div>
      </div>
    </section>
  )
}