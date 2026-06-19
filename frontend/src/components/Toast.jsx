import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

let toastId = 0
let listeners = []
let toasts = []

function notify(message, type = 'success') {
  const id = ++toastId
  toasts = [...toasts, { id, message, type }]
  listeners.forEach((l) => l([...toasts]))
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    listeners.forEach((l) => l([...toasts]))
  }, 5000)
}

export function showToast(message, type = 'success') {
  notify(message, type)
}

export default function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState(toasts)

  useEffect(() => {
    const listener = (newToasts) => setCurrentToasts([...newToasts])
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const removeToast = useCallback((id) => {
    toasts = toasts.filter((t) => t.id !== id)
    listeners.forEach((l) => l([...toasts]))
  }, [])

  return (
    <div className="toast-container">
      {currentToasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>
          <div className="toast-content">
            <strong>{toast.type === 'error' ? 'Error / ስህተት' : 'Notification / ማሳወቂያ'}</strong>
            <p>{toast.message}</p>
          </div>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}