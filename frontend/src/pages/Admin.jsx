import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Users, History, MessageCircle, Send } from 'lucide-react'
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
  const [chatConversations, setChatConversations] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [selectedChatConv, setSelectedChatConv] = useState(null)
  const [chatReply, setChatReply] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatMessagesEndRef = useRef(null)

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

  const loadChatConversations = async () => {
    try {
      const data = await apiRequest('/chat/admin/conversations')
      setChatConversations(data.conversations || [])
    } catch (err) { console.error(err) }
  }

  const loadChatMessages = async (convId) => {
    try {
      const data = await apiRequest(`/chat/admin/conversations/${convId}/messages`)
      setChatMessages(data.messages || [])
    } catch (err) { console.error(err) }
  }

  const handleSelectChatConv = async (conv) => {
    setSelectedChatConv(conv)
    setChatLoading(true)
    await loadChatMessages(conv.id)
    setChatLoading(false)
    setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleAdminReply = async (e) => {
    e.preventDefault()
    if (!chatReply.trim() || !selectedChatConv) return
    try {
      const data = await apiRequest('/chat/admin/reply', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: selectedChatConv.id, message: chatReply.trim() })
      })
      setChatMessages(prev => [...prev, data.message])
      setChatReply('')
      await loadChatConversations()
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleToggleConvStatus = async (convId, currentStatus) => {
    const action = currentStatus === 'open' ? 'close' : 'reopen'
    try {
      await apiRequest(`/chat/admin/conversations/${convId}/${action}`, { method: 'PUT' })
      showToast(`Conversation ${action}d.`)
      setSelectedChatConv(null)
      setChatMessages([])
      await loadChatConversations()
    } catch (err) { showToast(err.message, 'error') }
  }

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
        <button className={`admin-tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); loadChatConversations(); }}>
          <MessageCircle size={16} /> {t('admin_tab_chat') || 'Chat Support'}
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

      {activeTab === 'chat' && (
        <div className="admin-tab-content">
          <h3>{t('admin_chat_title') || 'Chat Support Management'}</h3>
          <div className="admin-chat-layout">
            {/* Conversation List */}
            <div className="admin-chat-sidebar">
              <h4>{t('admin_chat_conversations') || 'Conversations'}</h4>
              {chatConversations.length === 0 ? (
                <div className="chat-empty">
                  <p>{t('admin_chat_no_conversations') || 'No conversations yet.'}</p>
                </div>
              ) : (
                <div className="admin-chat-conv-list">
                  {chatConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`admin-chat-conv-item ${selectedChatConv?.id === conv.id ? 'active' : ''} ${conv.status === 'closed' ? 'closed' : ''}`}
                      onClick={() => handleSelectChatConv(conv)}
                    >
                      <div className="admin-chat-conv-header">
                        <img src={conv.user_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40'} alt="" className="admin-chat-conv-avatar" />
                        <div className="admin-chat-conv-info">
                          <strong>{conv.user_name}</strong>
                          <span className="admin-chat-conv-email">{conv.user_email}</span>
                        </div>
                        <span className={`badge ${conv.status === 'open' ? 'badge-emerald' : 'text-muted'}`}>
                          {conv.status === 'open' ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      <div className="admin-chat-conv-preview">
                        {conv.last_message ? conv.last_message.substring(0, 50) + (conv.last_message.length > 50 ? '...' : '') : 'No messages'}
                      </div>
                      <div className="admin-chat-conv-stats">
                        <span>👤 {conv.user_message_count || 0}</span>
                        <span>💬 {conv.admin_message_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message View */}
            <div className="admin-chat-main">
              {!selectedChatConv ? (
                <div className="admin-chat-placeholder">
                  <MessageCircle size={48} />
                  <p>{t('admin_chat_select') || 'Select a conversation to view messages'}</p>
                </div>
              ) : (
                <>
                  <div className="admin-chat-main-header">
                    <div>
                      <strong>{selectedChatConv.user_name}</strong>
                      <span className="text-muted"> ({selectedChatConv.user_email})</span>
                    </div>
                    <button
                      className={`btn btn-sm ${selectedChatConv.status === 'open' ? 'btn-outline text-danger' : 'btn-primary'}`}
                      onClick={() => handleToggleConvStatus(selectedChatConv.id, selectedChatConv.status)}
                    >
                      {selectedChatConv.status === 'open' ? 'Close Conversation' : 'Reopen Conversation'}
                    </button>
                  </div>

                  <div className="admin-chat-messages">
                    {chatLoading ? (
                      <div className="chat-loading">Loading messages...</div>
                    ) : chatMessages.length === 0 ? (
                      <div className="chat-empty"><p>No messages yet.</p></div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`chat-msg ${msg.is_admin_reply ? 'chat-msg-admin' : 'chat-msg-user'}`}
                        >
                          {msg.is_admin_reply && (
                            <div className="chat-msg-avatar"><span>👨‍💼</span></div>
                          )}
                          <div className="chat-msg-content">
                            {msg.is_admin_reply && <span className="chat-msg-name">Admin: {msg.sender_name}</span>}
                            {!msg.is_admin_reply && <span className="chat-msg-name">{msg.sender_name || 'User'}</span>}
                            <div className="chat-msg-bubble">{msg.message}</div>
                            <span className="chat-msg-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {!msg.is_admin_reply && (
                            <div className="chat-msg-avatar"><span>👤</span></div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={chatMessagesEndRef} />
                  </div>

                  <form className="chat-input-form" onSubmit={handleAdminReply}>
                    <input
                      type="text"
                      value={chatReply}
                      onChange={(e) => setChatReply(e.target.value)}
                      placeholder={t('admin_chat_placeholder') || 'Type your reply...'}
                    />
                    <button type="submit" disabled={!chatReply.trim()} className="chat-send-btn">
                      <Send size={18} />
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}