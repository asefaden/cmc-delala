import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Users, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../api'
import { showToast } from '../components/Toast'
import i18n from '../i18n'

export default function Admin({ lang }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('verifications')
  const [verifications, setVerifications] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])

  const t = (key) => i18n[lang]?.[key] || key

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    loadData()
  }, [user])

  async function loadData() {
    try {
      const [v, u, l] = await Promise.all([
        apiRequest('/api/admin/verifications'),
        apiRequest('/api/admin/users'),
        apiRequest('/api/admin/logs'),
      ])
      setVerifications(v)
      setUsers(u)
      setLogs(l)
    } catch (err) { console.error(err) }
  }

  const resolveVerification = async (id, status) => {
    const notes = prompt('Enter review notes:')
    try {
      await apiRequest(`/api/admin/verifications/${id}/resolve`, {
        method: 'POST', body: JSON.stringify({ status, notes }),
      })
      showToast('Resolved!')
      loadData()
    } catch (err) { showToast(err.message, 'error') }
  }

  const toggleSuspend = async (id, status) => {
    if (!confirm(`Change user status to ${status}?`)) return
    try {
      await apiRequest(`/api/admin/users/${id}/suspend`, {
        method: 'POST', body: JSON.stringify({ status }),
      })
      showToast('Updated!')
      loadData()
    } catch (err) { showToast(err.message, 'error') }
  }

  if (!user || user.role !== 'admin') return <p className="text-center">Access denied.</p>

  const pendingCount = verifications.filter((v) => v.status === 'pending').length

  return (
    <section className="app-view">
      <div className="view-header flex-header">
        <div>
          <h1>{t('admin_title')}</h1>
          <p>{t('admin_desc')}</p>
        </div>
        <Link to="/dashboard" className="btn btn-outline btn-sm"><ArrowLeft size={14} /> Back to Dashboard</Link>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab-btn ${activeTab === 'verifications' ? 'active' : ''}`} onClick={() => setActiveTab('verifications')}>
          <ShieldCheck size={16} /> {t('admin_tab_verif')} <span className="badge badge-count">{pendingCount}</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <Users size={16} /> {t('admin_tab_users')}
        </button>
        <button className={`admin-tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <History size={16} /> {t('admin_tab_logs')}
        </button>
      </div>

      {activeTab === 'verifications' && (
        <div className="admin-tab-content">
          <h3>{t('admin_verif_reqs')}</h3>
          <div className="admin-table-container">
            <table className="dashboard-table">
              <thead><tr><th>Broker</th><th>Doc Type</th><th>ID Number</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {verifications.length === 0 ? <tr><td colSpan="6" className="text-center">No requests.</td></tr> : verifications.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.full_name}</strong><div className="dash-meta">{r.email}</div></td>
                    <td>{r.id_type}</td>
                    <td><code>{r.id_number}</code></td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td><span className={`badge ${r.status === 'approved' ? 'badge-emerald' : r.status === 'rejected' ? 'text-danger' : 'badge-gold'}`}>{r.status.toUpperCase()}</span></td>
                    <td>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => resolveVerification(r.id, 'approved')}>Approve</button>
                          <button className="btn btn-outline btn-sm text-danger" onClick={() => resolveVerification(r.id, 'rejected')}>Reject</button>
                        </div>
                      ) : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Resolved</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-tab-content">
          <h3>{t('admin_users_title')}</h3>
          <div className="admin-table-container">
            <table className="dashboard-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Verified</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.full_name}</strong></td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td><code>{u.role.toUpperCase()}</code></td>
                    <td>{u.verified === 1 ? <span className="badge badge-gold"><ShieldCheck size={12} /> Yes</span> : 'No'}</td>
                    <td><span className={`badge ${u.status === 'active' ? 'badge-emerald' : 'text-danger'}`}>{u.status.toUpperCase()}</span></td>
                    <td>
                      {u.role !== 'admin' ? (
                        <button className={`btn ${u.status === 'active' ? 'btn-outline text-danger' : 'btn-primary'} btn-sm`} onClick={() => toggleSuspend(u.id, u.status === 'active' ? 'suspended' : 'active')}>
                          {u.status === 'active' ? 'Suspend' : 'Unsuspend'}
                        </button>
                      ) : <span className="text-muted" style={{ fontSize: '0.8rem' }}>System Admin</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="admin-tab-content">
          <h3>{t('admin_logs_title')}</h3>
          <div className="admin-table-container">
            <table className="dashboard-table">
              <thead><tr><th>Timestamp</th><th>Event</th><th>User</th><th>IP</th><th>Details</th></tr></thead>
              <tbody>
                {logs.length === 0 ? <tr><td colSpan="5" className="text-center">No logs.</td></tr> : logs.map((l) => (
                  <tr key={l.id}>
                    <td className="dash-meta">{new Date(l.created_at).toLocaleString()}</td>
                    <td><strong><code>{l.event_type}</code></strong></td>
                    <td>{l.user_email ? `${l.user_email} (${l.user_role?.toUpperCase()})` : 'Anonymous'}</td>
                    <td><code>{l.ip_address || '127.0.0.1'}</code></td>
                    <td className="admin-log-details">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}