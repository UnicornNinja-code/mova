import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Box,
  HStack,
  VStack,
  Text,
  Heading,
  Button,
  ButtonText,
  Avatar,
  AvatarFallbackText,
} from '@gluestack-ui/themed'
import {
  LayoutDashboard,
  Navigation,
  Activity,
  LogOut,
  Compass,
  Radio,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const navItems = [
    { name: 'Dashboard Spasial', path: '/', icon: LayoutDashboard },
    { name: 'Operasional Armada', path: '/operations', icon: Navigation },
    { name: 'Analisis DSS', path: '/dss', icon: Activity },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Box className="flex flex-row min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <Box className="w-64 border-r border-zinc-800 bg-zinc-900/90 flex flex-col justify-between p-4 sticky top-0 h-screen z-30">
        <VStack space="xl">
          {/* Brand */}
          <HStack space="md" className="items-center px-2 py-1">
            <Box className="h-9 w-9 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Compass className="h-5 w-5 text-zinc-950" />
            </Box>
            <VStack space="xs">
              <HStack space="xs" className="items-center">
                <Heading size="md" className="font-bold text-white tracking-tight">MOVA</Heading>
                <Box className="bg-emerald-950 border border-emerald-800 px-1.5 py-0 rounded">
                  <Text size="xs" className="text-[10px] text-emerald-400 font-mono">DSS</Text>
                </Box>
              </HStack>
              <Text size="xs" className="text-[11px] text-zinc-400 font-mono">Spatial Operations</Text>
            </VStack>
          </HStack>

          {/* Nav Items */}
          <VStack space="xs">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-emerald-400 font-semibold border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </VStack>
        </VStack>

        {/* User Profile / Logout */}
        <Box className="pt-4 border-t border-zinc-800">
          <HStack className="items-center justify-between px-2">
            <HStack space="sm" className="items-center overflow-hidden">
              <Avatar size="sm" className="bg-emerald-600">
                <AvatarFallbackText className="text-white font-bold text-xs">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                </AvatarFallbackText>
              </Avatar>
              <VStack space="xs" className="overflow-hidden">
                <Text size="xs" className="font-semibold text-zinc-100 truncate">{user?.name || 'Admin User'}</Text>
                <Text size="xs" className="text-[10px] text-zinc-400 uppercase font-mono">{user?.role || 'superadmin'}</Text>
              </VStack>
            </HStack>

            <button
              onClick={handleLogout}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </HStack>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Box className="h-14 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex flex-row items-center justify-between sticky top-0 z-20">
          <HStack space="sm" className="items-center">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Text size="xs" className="font-mono text-zinc-400">Live Telemetry & Spatial DSS Sync</Text>
          </HStack>

          <HStack space="sm" className="items-center">
            <Box className="bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full flex flex-row items-center gap-1.5">
              <Radio className="h-3 w-3 text-emerald-400" />
              <Text size="xs" className="text-emerald-400 text-xs font-medium">Online</Text>
            </Box>
          </HStack>
        </Box>

        {/* Dynamic Route Outlet */}
        <Box className="flex-1 p-6">
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default MainLayout
