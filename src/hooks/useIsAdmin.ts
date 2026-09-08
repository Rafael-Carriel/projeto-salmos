import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

/**
 * Quem é administrador vive em `roles/{uid}` com `admin: true`, uma coleção
 * que ninguém consegue escrever pelo app — só pelo Firebase Console. Se o
 * cargo ficasse no próprio documento do usuário, ele poderia se promover.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    return onSnapshot(
      doc(db, 'roles', user.uid),
      (snap) => setIsAdmin(snap.data()?.admin === true),
      () => setIsAdmin(false),
    )
  }, [user])

  return isAdmin
}
