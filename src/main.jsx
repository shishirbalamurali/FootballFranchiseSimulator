import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import { ToastProvider } from './components/ui'
import SmallScreenNotice from './components/SmallScreenNotice'
import SaveStatusWatcher from './components/SaveStatusWatcher'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      reducedMotion="user" is the only thing that actually honours the OS
      setting for framer-motion. The `prefers-reduced-motion` block in
      index.css can only reach CSS animations — framer writes inline styles,
      so every one of the app's motion.* components ignored it until now.
    */}
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <SmallScreenNotice />
        <SaveStatusWatcher />
        <App />
      </ToastProvider>
    </MotionConfig>
  </React.StrictMode>,
)
