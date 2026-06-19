import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import ToastContainer from './components/Toast'
import Home from './pages/Home'
import Listings from './pages/Listings'
import ListingDetail from './pages/ListingDetail'
import Brokers from './pages/Brokers'
import BrokerDetail from './pages/BrokerDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App() {
  const { loading } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en')

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer />
      <Header lang={lang} setLang={setLang} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home lang={lang} />} />
          <Route path="/listings" element={<Listings lang={lang} />} />
          <Route path="/listing-detail/:id" element={<ListingDetail lang={lang} />} />
          <Route path="/brokers" element={<Brokers lang={lang} />} />
          <Route path="/broker-detail/:id" element={<BrokerDetail lang={lang} />} />
          <Route path="/login" element={<Login lang={lang} />} />
          <Route path="/register" element={<Register lang={lang} />} />
          <Route path="/dashboard" element={<Dashboard lang={lang} />} />
          <Route path="/admin" element={<Admin lang={lang} />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}