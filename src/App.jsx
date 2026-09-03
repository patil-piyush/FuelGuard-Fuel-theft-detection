import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetails from './pages/VehicleDetails'
import LiveMonitoring from './pages/LiveMonitoring'
import FuelAnalytics from './pages/FuelAnalytics'
import Events from './pages/Events'
import MapPage from './pages/Map'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NotAuthorized from './pages/NotAuthorized'
import ProtectedRoute from './components/ProtectedRoute'

const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: 'Fleet overview and fuel status' },
  '/vehicles': { title: 'Vehicles', subtitle: 'All registered fleet vehicles' },
  '/live': { title: 'Live monitoring', subtitle: 'Real-time telemetry feed' },
  '/analytics': { title: 'Fuel analytics', subtitle: 'Consumption trends and anomalies' },
  '/events': { title: 'Events', subtitle: 'Detected fuel events across the fleet' },
  '/map': { title: 'Map', subtitle: 'Live vehicle locations' },
  '/settings': { title: 'Settings', subtitle: 'Account and system preferences' },
}

function metaFor(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/vehicles/')) return { title: 'Vehicle details', subtitle: null }
  return { title: 'FuelGuard', subtitle: null }
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { title, subtitle } = metaFor(location.pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-ink">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} subtitle={subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/vehicles/:vehicleId" element={<ProtectedRoute><VehicleDetails /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><LiveMonitoring /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><FuelAnalytics /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="ADMIN"><Settings /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/not-authorized" element={<NotAuthorized />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
