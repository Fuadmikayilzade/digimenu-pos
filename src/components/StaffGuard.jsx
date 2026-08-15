import { useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useApp } from '../context/AppContext'

// Ofisiant aktiv olub-olmadığını hər 60 saniyədə yoxlayır.
// Sahibkar "işdən çıxar" basarsa, növbəti yoxlamada POS-dan çıxarılır.
export default function StaffGuard() {
  const { user, handleLogout } = useApp()
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user || user.role === 'owner' || user.role === 'admin') return

    const checkActive = async () => {
      if (!user.staff_account_id) return
      const { data } = await supabase
        .from('staff_accounts')
        .select('is_active')
        .eq('id', user.staff_account_id)
        .maybeSingle()

      if (data && !data.is_active) {
        alert('Hesabınız deaktiv edildi. Sistəmdən çıxarılırsınız.')
        handleLogout()
      }
    }

    checkActive()
    intervalRef.current = setInterval(checkActive, 60000)
    return () => clearInterval(intervalRef.current)
  }, [user])

  return null
}
