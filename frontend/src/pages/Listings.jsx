import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, Inbox, RefreshCw, AlertTriangle } from 'lucide-react'
import { apiRequest } from '../api'
import ListingCard from '../components/ListingCard'
import i18n from '../i18n'

export default function Listings({ lang }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({
    category: '',
    type: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    search: '',
  })

  const t = (key) => i18n[lang]?.[key] || key

  // Load listings from the API
// Load listings from the API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Use a static string for the search params to prevent object reference loops
        const queryString = searchParams.toString();
        const endpoint = queryString ? `/api/listings?${queryString}` : '/api/listings';
        
        const data = await apiRequest(endpoint);
        if (cancelled) return;
        
        const items = Array.isArray(data) ? data : (data?.listings || data?.data || []);
        setListings(items);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Error loading listings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true };
    // Only re-run if searchParams string representation changes, or lang changes
  }, [searchParams.toString(), lang]);

  // Sync filter inputs with URL params
  useEffect(() => {
    setFilters({
      category: searchParams.get('category') || '',
      type: searchParams.get('type') || '',
      location: searchParams.get('location') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      search: searchParams.get('search') || '',
    })
  }, [searchParams])

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = (e) => {
    if (e) e.preventDefault()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val)
    })
    setSearchParams(params)
  }

  const clearFilters = () => {
    setFilters({ category: '', type: '', location: '', minPrice: '', maxPrice: '', search: '' })
    setSearchParams({})
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)

  return (
    <section className="app-view">
      <div className="view-header">
        <h1>{t('nav_listings')}</h1>
        <p>
          {lang === 'en'
            ? 'Find real estate, vehicles, and services listings in Addis Ababa.'
            : 'በአዲስ አበባ ውስጥ የቤት እስቴት፣ መኪና እና አገልግሎት ዝርዝሮችን ያግኙ።'}
        </p>
      </div>

      <div className="marketplace-layout">
        {/* ── Filter Sidebar ── */}
        <aside className="filter-sidebar glass-card">
          <form onSubmit={applyFilters}>
            <div className="filter-section-title">
              <SlidersHorizontal size={16} /> <span>{t('lbl_filters')}</span>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="btn-text">
                  {t('btn_clear')}
                </button>
              )}
            </div>

            <div className="filter-groups">
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
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) => updateFilter('minPrice', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter('maxPrice', e.target.value)}
                  />
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

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}>
                {lang === 'en' ? 'Apply Filters' : 'ማጣሪያዎችን ተግብር'}
              </button>
            </div>
          </form>
        </aside>

        {/* ── Listings Grid ── */}
        <div className="listings-results-container">
          <div className="results-toolbar">
            <span>
              {loading
                ? '...'
                : error
                  ? (lang === 'en' ? 'Error loading listings' : 'ዝርዝሮችን በመጫን ላይ ስህተት')
                  : (lang === 'en'
                    ? `${listings.length} listing${listings.length !== 1 ? 's' : ''} found`
                    : `${listings.length} ዝርዝሮች ተገኝተዋል`)}
            </span>
          </div>

          <div className="listings-grid">
            {loading ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="listing-card skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line short" />
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line long" />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="listings-empty-state">
                <AlertTriangle size={48} style={{ margin: '0 auto 1rem', color: 'var(--color-accent, #f59e0b)' }} />
                <p style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>{error}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSearchParams({})}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <RefreshCw size={16} />
                  {lang === 'en' ? 'Retry' : 'እንደገና ሞክር'}
                </button>
              </div>
            ) : listings.length === 0 ? (
              <div className="listings-empty-state">
                <Inbox size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
                <p style={{ marginBottom: '0.75rem' }}>
                  {hasActiveFilters
                    ? (lang === 'en' ? 'No listings match your filter criteria.' : 'ከማጣሪያዎ ጋር የሚዛመድ ዝርዝር አልተገኘም።')
                    : (lang === 'en' ? 'No listings available yet. Check back later!' : 'ዘርዝሮች አልተገኙም። በኋላ ይመልከቱ!')}
                </p>
                {hasActiveFilters && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
                    {lang === 'en' ? 'Clear all filters' : 'ሁሉንም ማጣሪያ ያጽዱ'}
                  </button>
                )}
              </div>
            ) : (
              listings.map((item) => (
                <ListingCard key={item.id} listing={item} lang={lang} />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}