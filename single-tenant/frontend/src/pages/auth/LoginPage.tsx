import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Card,
  Input,
  InputField,
  Button,
  ButtonText,
  ButtonSpinner,
  Heading,
  Text,
  VStack,
  HStack,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from '@gluestack-ui/themed'
import { Compass, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loading } = useAuthStore()

  const [email, setEmail] = useState('admin@mova.internal')
  const [password, setPassword] = useState('password')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Gagal masuk. Periksa email dan kata sandi Anda.')
    }
  }

  return (
    <Box className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        <VStack space="md">
          {/* Header */}
          <VStack space="xs" className="items-center text-center pb-2">
            <Box className="h-12 w-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-2">
              <Compass className="h-6 w-6 text-emerald-400" />
            </Box>
            <Heading size="xl" className="text-white font-bold tracking-tight">
              Masuk ke MOVA
            </Heading>
            <Text size="sm" className="text-zinc-400">
              Spatial Decision Support System
            </Text>
          </VStack>

          {/* Error Alert */}
          {errorMessage && (
            <Box className="p-3 rounded-lg bg-red-950/50 border border-red-800 flex items-center gap-2 text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <Text size="xs" className="text-red-300">{errorMessage}</Text>
            </Box>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <FormControl isRequired>
              <FormControlLabel className="mb-1.5">
                <FormControlLabelText className="text-xs font-medium text-zinc-300">
                  Email Perusahaan
                </FormControlLabelText>
              </FormControlLabel>
              <Input className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 rounded-lg h-10 px-3">
                <Mail className="h-4 w-4 text-zinc-500 mr-2 shrink-0 self-center" />
                <InputField
                  type="email"
                  value={email}
                  onChangeText={(text) => setEmail(text)}
                  placeholder="name@company.com"
                  className="text-zinc-100 text-sm"
                  required
                />
              </Input>
            </FormControl>

            <FormControl isRequired>
              <FormControlLabel className="mb-1.5">
                <FormControlLabelText className="text-xs font-medium text-zinc-300">
                  Kata Sandi
                </FormControlLabelText>
              </FormControlLabel>
              <Input className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 rounded-lg h-10 px-3">
                <Lock className="h-4 w-4 text-zinc-500 mr-2 shrink-0 self-center" />
                <InputField
                  type="password"
                  value={password}
                  onChangeText={(text) => setPassword(text)}
                  placeholder="••••••••"
                  className="text-zinc-100 text-sm"
                  required
                />
              </Input>
            </FormControl>

            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 rounded-lg h-10 mt-2 font-semibold"
              isDisabled={loading}
              onPress={() => {}}
            >
              {loading && <ButtonSpinner color="#ffffff" className="mr-2" />}
              <ButtonText className="text-zinc-950 font-bold text-sm">
                {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
              </ButtonText>
            </Button>
          </form>

          {/* Footer */}
          <HStack className="pt-4 border-t border-zinc-800 justify-between items-center text-xs text-zinc-500">
            <Text size="xs" className="text-zinc-500">Demo Access: Superadmin</Text>
            <Box className="bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
              <Text size="xs" className="font-mono text-zinc-300 text-[10px]">v1.0.0</Text>
            </Box>
          </HStack>
        </VStack>
      </Card>
    </Box>
  )
}

export default LoginPage
