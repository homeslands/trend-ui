import { createContext, useContext, useState, ReactNode } from 'react'

interface DialogContextType {
  isPermissionDialogOpen: boolean
  setIsPermissionDialogOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false)

  return (
    <DialogContext.Provider value={{ isPermissionDialogOpen, setIsPermissionDialogOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

export function useDialogContext() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialogContext must be used within DialogProvider')
  }
  return context
}

