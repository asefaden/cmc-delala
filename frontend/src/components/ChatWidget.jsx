import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../api'
import { showToast } from './Toast'
import i18n from '../i18n'

export default function ChatWidget({ lang }) {
  const { user } = useAuth()
  const t = (key) => i18n[lang]?.[key] || key

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'chat'
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Poll for new messages every 5 seconds when chat is open
  useEffect(() => {
    if (!isOpen || !user) return
    const interval = setInterval(() => {
      if (activeConversation) {
        loadMessages(activeConversation.id, true)
      }
      loadConversations(true)
    }, 5000)
    return () => clearInterval(interval)
  }, [isOpen, user, activeConversation])

  const loadConversations = async (silent = false) => {
    if (!user) return
    try {
      const data = await apiRequest('/chat/conversations')
      setConversations(data.conversations || [])
    } catch (err) {
      if (!silent) showToast(err.message, 'error')
    }
  }

  const loadMessages = async (convId, silent = false) => {
    try {
      const data = await apiRequest(`/chat/conversations/${convId}/messages`)
      setMessages(data.messages || [])
    } catch (err) {
      if (!silent) showToast(err.message, 'error')
    }
  }

  const handleOpen = async () => {
    if (!user) {
      showToast(t('chat_login_required') || 'Please log in to use the chat.', 'error')
      return
    }
    setIsOpen(true)
    setLoading(true)
    await loadConversations()
    setLoading(false)
  }

  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv)
    setView('chat')
    setLoading(true)
    await loadMessages(conv.id)
    setLoading(false)
  }

  const handleNewConversation = async () => {
    setView('chat')
    setActiveConversation(null)
    setMessages([])
    setNewMessage('')
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const payload = {
        message: newMessage.trim(),
        conversation_id: activeConversation?.id || null
      }
      const data = await apiRequest('/chat/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      // Add the new message to the list
      setMessages(prev => [...prev, data.message])
      setNewMessage('')

      if (!activeConversation) {
        setActiveConversation({ id: data.conversation_id })
        // Reload conversations to show the new one
        await loadConversations(true)
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async (convId) => {
    try {
      await apiRequest(`/chat/conversations/${convId}/close`, { method: 'PUT' })
      showToast(t('chat_conversation_closed') || 'Conversation closed.')
      setView('list')
      setActiveConversation(null)
      await loadConversations()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) {
    return (
      <button className="chat-fab" onClick={handleOpen} title={t('chat_title') || 'Chat with us'}>
        <MessageCircle size={28} />
        <span className="chat-fab-label">{t('chat_btn') || 'Chat'}</span>
      </button>
    )
  }

  return (
    <div className="chat-widget">
      <div className="chat-header">
        {view === 'chat' ? (
          <>
            <button className="chat-back-btn" onClick={() => { setView('list'); setActiveConversation(null) }}>
              <ChevronLeft size={20} />
            </button>
            <span className="chat-header-title">
              {activeConversation ? (t('chat_support') || 'Support Chat') : (t('chat_new_conversation') || 'New Conversation')}
            </span>
          </>
        ) : (
          <span className="chat-header-title">{t('chat_title') || 'Chat with Us'}</span>
        )}
        <button className="chat-close-btn" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="chat-body">
        {view === 'list' ? (
          <>
            <button className="chat-new-btn" onClick={handleNewConversation}>
              <MessageCircle size={18} />
              {t('chat_new_message') || 'Send a Message'}
            </button>
            {loading ? (
              <div className="chat-loading">{t('chat_loading') || 'Loading...'}</div>
            ) : conversations.length === 0 ? (
              <div className="chat-empty">
                <p>{t('chat_no_conversations') || 'No conversations yet.'}</p>
                <p>{t('chat_start_conversation') || 'Send a message to start chatting with support.'}</p>
              </div>
            ) : (
              <div className="chat-conv-list">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`chat-conv-item ${conv.status === 'closed' ? 'closed' : ''}`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="chat-conv-info">
                      <span className="chat-conv-preview">
                        {conv.last_message ? conv.last_message.substring(0, 60) + (conv.last_message.length > 60 ? '...' : '') : (t('chat_no_messages') || 'No messages yet')}
                      </span>
                      <span className="chat-conv-time">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div className="chat-conv-meta">
                      <span className={`chat-conv-status status-${conv.status}`}>
                        {conv.status === 'open' ? (t('chat_status_open') || 'Open') : (t('chat_status_closed') || 'Closed')}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="chat-conv-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="chat-messages">
              {loading ? (
                <div className="chat-loading">{t('chat_loading') || 'Loading...'}</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty">
                  <p>{t('chat_welcome') || 'Welcome! How can we help you?'}</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-msg ${msg.is_admin_reply ? 'chat-msg-admin' : 'chat-msg-user'}`}
                  >
                    {msg.is_admin_reply && (
                      <div className="chat-msg-avatar">
                        <span>💬</span>
                      </div>
                    )}
                    <div className="chat-msg-content">
                      {msg.is_admin_reply && <span className="chat-msg-name">{msg.sender_name || 'Support'}</span>}
                      <div className="chat-msg-bubble">{msg.message}</div>
                      <span className="chat-msg-time">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('chat_placeholder') || 'Type your message...'}
                disabled={sending}
                autoFocus
              />
              <button type="submit" disabled={!newMessage.trim() || sending} className="chat-send-btn">
                <Send size={18} />
              </button>
            </form>

            {activeConversation && activeConversation.status !== 'closed' && (
              <button className="chat-close-conv-btn" onClick={() => handleClose(activeConversation.id)}>
                {t('chat_close_conversation') || 'Close Conversation'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}