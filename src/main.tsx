import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuditDashboard } from './components/AuditDashboard'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuditDashboard />
  </React.StrictMode>,
)