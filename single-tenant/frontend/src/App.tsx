import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { GluestackUIProvider } from '@gluestack-ui/themed'
import { config } from '@gluestack-ui/config'
import AppRoutes from './router/AppRoutes'

export const App: React.FC = () => {
  return (
    <GluestackUIProvider config={config}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </GluestackUIProvider>
  )
}

export default App
