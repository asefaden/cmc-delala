import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Edit, Settings, Plus, Trash2, ShieldCheck, Search, Users, Upload, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../api'
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

export default function Dashboard({ lang }) {
  const { user, setUser, checkSession } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [reviews, setReviews] = useState([])
  const [showEdit, setShowEdit] = useState(false)
  const [showListingForm, setShowListingForm] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [showVerifyForm, setShowVerifyForm] = useState(false)
  const [showVerifyPending, setShowVerifyPending] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', telegram_username: '', bio: '' })
  const [listingForm, setListingForm] = useState({ title: '', category: 'real_estate', type: 'rent', price: '', currency: 'ETB', location: '', description: '', images: '' })
  const [verifyForm, setVerifyForm] = useState({ id_type: 'National ID', id_number: '' })

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadDashboardData()
  }, [user])

  async function loadDashboardData() {
    if (!user) return
    try {
      if (user.role === 'broker') {
        const data = await apiRequest(`/api/brokers/${user.id}`)
        setListings(data.listings || [])
        setReviews(data.reviews || [])
        if (user.verified === 0) setShowVerifyForm(true)
      } else if (user.role === 'admin') {
        const allListings = await apiRequest('/api/listings')
        setListings(allListings)
        const allReviews = await apiRequest('/api/admin/reviews')
        setReviews(allReviews)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    try {
      const res = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ ...profileForm, avatar: user.avatar }),
      })
      setUser(res.user)
      setShowEdit(false)
      showToast(lang === 'en' ? 'Profile updated!' : 'መገለጫ ተሻሽሏል!')
    } catch (err) { showToast(err.message, 'error') }
  }

  const saveListing = async (e) => {
    e.preventDefault()
    const body = { ...listingForm, images: listingForm.images ? [listingForm.images] : null }
    try {
      if (editingListing) {
        await apiRequest(`/api/listings/${editingListing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiRequest('/api/listings', { method: 'POST', body: JSON.stringify(body) })
      }
      showToast('Listing saved!')
      setShowListingForm(false)
      setEditingListing(null)
      loadDashboardData()
    } catch (err) { showToast(err.message, 'error') }
  }

  const deleteListing = async (id) => {
    if (!confirm(lang === 'en' ? 'Delete this listing?' : 'ይህንን ዝርዝር ማጥፋት ይፈልጋሉ?')) return
    try {
      await apiRequest(`/api/listings/${id}`, { method: 'DELETE' })
      showToast('Deleted!')
      loadDashboardData()
    } catch (err) { showToast(err.message, 'error') }
  }

  const submitVerification = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/brokers/apply/verify', { method: 'POST', body: JSON.stringify(verifyForm) })
      setShowVerifyForm(false)
      setShowVerifyPending(true)
      showToast('Verification request submitted!')
    } catch (err) { showToast(err.message, 'error') }
  }

  if (!user) return null

  return (
    <section className="app-view">
      <div className="dashboard-header glass-card">
        <div className="dashboard-profile-info">
          <img src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} alt="" className="dash-avatar" />
          <div>
            <div className="dash-name-row">
              <h2>{user.full_name}</h2>
              <span className={`badge ${user.role === 'admin' ? 'badge-gold' : 'badge-emerald'}`}>{user.role.toUpperCase()}</span>
              {user.verified === 1 && <span className="badge badge-gold"><ShieldCheck size={14} /> Verified</span>}
            </div>
            <p className="dash-meta">{user.email}</p>
            <p className="dash-meta">{user.phone}</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <button onClick={() => { setShowEdit(!showEdit); setProfileForm({ full_name: user.full_name, phone: user.phone, telegram_username: user.telegram_username || '', bio: user.bio || '' }) }} className="btn btn-outline btn-sm"><Edit size={14} /> {t('btn_edit_profile')}</button>
          {user.role === 'admin' && <Link to="/admin" className="btn btn-primary btn-sm"><Settings size={14} /> {t('btn_admin_panel')}</Link>}
        </div>
      </div>

      {showEdit && (
        <div className="glass-card margin-bottom">
          <h3>{t('edit_profile_title')}</h3>
          <form onSubmit={saveProfile} className="profile-edit-form">
            <div className="form-row">
              <div className="form-group"><label>{t('lbl_fullname')}</label><input required value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div>
              <div className="form-group"><label>{t('lbl_phone')}</label><input required value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>{t('lbl_telegram')}</label><input value={profileForm.telegram_username} onChange={(e) => setProfileForm({ ...profileForm, telegram_username: e.target.value })} placeholder="e.g. abebe_delala" /></div>
            <div className="form-group"><label>{t('lbl_bio')}</label><textarea rows={3} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} /></div>
            <div className="profile-edit-actions">
              <button type="submit" className="btn btn-primary">{t('btn_save_changes')}</button>
              <button type="button" onClick={() => setShowEdit(false)} className="btn btn-outline">{t('btn_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {showVerifyForm && (
        <div className="glass-card margin-bottom">
          <div className="verification-alert">
            <ShieldCheck size={24} className="alert-icon text-gold" />
            <div><h3>{t('verify_title')}</h3><p>{t('verify_desc')}</p></div>
          </div>
          <form onSubmit={submitVerification} className="verification-form">
            <div className="form-row">
              <div className="form-group"><label>{t('lbl_id_type')}</label><select value={verifyForm.id_type} onChange={(e) => setVerifyForm({ ...verifyForm, id_type: e.target.value })}><option>Kebele / National ID</option><option>Broker License</option><option>Passport</option></select></div>
              <div className="form-group"><label>{t('lbl_id_number')}</label><input required value={verifyForm.id_number} onChange={(e) => setVerifyForm({ ...verifyForm, id_number: e.target.value })} placeholder="e.g., AD-102934-ET" /></div>
            </div>
            <button type="submit" className="btn btn-primary">{t('btn_submit_verif')}</button>
          </form>
        </div>
      )}

      {showVerifyPending && (
        <div className="glass-card margin-bottom"><div className="info-alert"><ShieldCheck size={24} className="alert-icon text-emerald animate-pulse" /><div><h3>{t('verify_pending_title')}</h3><p>{t('verify_pending_desc')}</p></div></div></div>
      )}

      {(user.role === 'broker' || user.role === 'admin') && (
        <>
          <div className="section-header-row">
            <h2>{t('dash_my_listings')}</h2>
            <button onClick={() => { setShowListingForm(true); setEditingListing(null); setListingForm({ title: '', category: 'real_estate', type: 'rent', price: '', currency: 'ETB', location: '', description: '', images: '' }) }} className="btn btn-primary btn-sm"><Plus size={14} /> {t('btn_add_listing')}</button>
          </div>
          {showListingForm && (
            <div className="glass-card margin-bottom">
              <h3>{editingListing ? 'Edit Listing' : t('lbl_create_new_listing')}</h3>
              <form onSubmit={saveListing}>
                <div className="form-group"><label>{t('lbl_listing_title')}</label><input required value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} /></div>
                <div className="form-row">
                  <div className="form-group"><label>{t('lbl_category')}</label><select value={listingForm.category} onChange={(e) => setListingForm({ ...listingForm, category: e.target.value })}><option value="real_estate">Real Estate</option><option value="vehicle">Vehicle</option><option value="services">Services</option></select></div>
                  <div className="form-group"><label>{t('lbl_type')}</label><select value={listingForm.type} onChange={(e) => setListingForm({ ...listingForm, type: e.target.value })}><option value="rent">Rent</option><option value="sale">Sale</option><option value="job">Job</option></select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>{t('lbl_price')}</label><input type="number" required min="1" value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })} /></div>
                  <div className="form-group"><label>{t('lbl_location')}</label><input required value={listingForm.location} onChange={(e) => setListingForm({ ...listingForm, location: e.target.value })} /></div>
                </div>
                <div className="form-group"><label>{t('lbl_description')}</label><textarea rows={5} required value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} /></div>
                <div className="form-group"><label>{t('lbl_image_url')}</label><input value={listingForm.images} onChange={(e) => setListingForm({ ...listingForm, images: e.target.value })} placeholder="Paste image link (optional)" /></div>
                <div className="profile-edit-actions">
                  <button type="submit" className="btn btn-primary">{t('btn_publish')}</button>
                  <button type="button" onClick={() => setShowListingForm(false)} className="btn btn-outline">{t('btn_cancel')}</button>
                </div>
              </form>
            </div>
          )}
          <div className="listings-table-container">
            <table className="dashboard-table">
              <thead><tr><th>{t('tbl_item')}</th><th>{t('tbl_category')}</th><th>{t('tbl_price')}</th><th>{t('tbl_location')}</th><th>{t('tbl_status')}</th><th>{t('tbl_actions')}</th></tr></thead>
              <tbody>
                {listings.length === 0 ? (
                  <tr><td colSpan="6" className="text-center">No listings yet.</td></tr>
                ) : listings.map((l) => (
                  <tr key={l.id}>
                    <td className="table-listing-title-cell">{l.title}</td>
                    <td>{formatCategory(l.category, lang)}</td>
                    <td>{formatPrice(l.price, l.currency, lang)}</td>
                    <td>{l.location}</td>
                    <td><span className={`badge ${l.status === 'active' ? 'badge-emerald' : ''}`}>{l.status.toUpperCase()}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingListing(l); setShowListingForm(true); setListingForm({ title: l.title, category: l.category, type: l.type, price: l.price, currency: l.currency, location: l.location, description: l.description, images: l.images?.[0] || '' }) }}><Edit size={14} /></button>
                        <button className="btn btn-outline btn-sm text-danger" onClick={() => deleteListing(l.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 style={{ marginTop: '2rem' }}>{t('dash_reviews_received')}</h2>
          <ReviewList reviews={reviews} lang={lang} />
        </>
      )}

      {user.role === 'client' && (
        <div className="dash-content-block">
          <h2>{t('dash_client_title')}</h2>
          <p>{t('dash_client_desc')}</p>
          <div className="client-stats-cards">
            <div className="stat-card">
              <Search size={24} className="stat-icon" />
              <h3>Search Homes</h3>
              <p>Explore verified real estate.</p>
              <Link to="/listings" className="btn btn-sm btn-primary">Marketplace</Link>
            </div>
            <div className="stat-card">
              <Users size={24} className="stat-icon text-gold" />
              <h3>Broker Directory</h3>
              <p>Find top-rated brokers.</p>
              <Link to="/brokers" className="btn btn-sm btn-outline">Find Broker</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}