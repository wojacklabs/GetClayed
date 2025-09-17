'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { X } from 'lucide-react'

export type PopupType = 'success' | 'error' | 'warning' | 'info'

export interface PopupConfig {
  isOpen: boolean
  title?: string
  message: string
  type?: PopupType
  onClose?: () => void
  autoClose?: boolean
  autoCloseDelay?: number
  showCloseButton?: boolean
}

interface PopupNotificationProps extends PopupConfig {}

export function PopupNotification({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
  showCloseButton = true
}: PopupNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Delay to trigger animation
      setTimeout(() => setIsVisible(true), 10)
      
      if (autoClose && autoCloseDelay > 0) {
        const timer = setTimeout(() => {
          handleClose()
        }, autoCloseDelay)
        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [isOpen, autoClose, autoCloseDelay])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose?.()
    }, 300) // Wait for animation to complete
  }

  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      case 'info':
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
      <div
        className={`
          bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-md w-full pointer-events-auto
          transform transition-all duration-300 ease-out
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
      >
        <div className="mb-4">
          {title && (
            <h3 className={`text-lg font-medium mb-2 ${getTypeStyles()}`}>
              {title}
            </h3>
          )}
          <div className="text-sm text-gray-700 leading-relaxed">
            {message}
          </div>
        </div>
        {showCloseButton && (
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Context for popup state
interface PopupContextType {
  showPopup: (message: string, type?: PopupType, options?: Partial<PopupConfig>) => void
  hidePopup: () => void
}

const PopupContext = createContext<PopupContextType | undefined>(undefined)

// Provider component
export function PopupNotificationProvider({ children }: { children: ReactNode }) {
  const [popupConfig, setPopupConfig] = useState<PopupConfig>({
    isOpen: false,
    message: '',
    type: 'info'
  })

  const showPopup = (message: string, type: PopupType = 'info', options?: Partial<PopupConfig>) => {
    setPopupConfig({
      isOpen: true,
      message,
      type,
      ...options,
      onClose: () => {
        setPopupConfig(prev => ({ ...prev, isOpen: false }))
        options?.onClose?.()
      }
    })
  }

  const hidePopup = () => {
    setPopupConfig(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <PopupContext.Provider value={{ showPopup, hidePopup }}>
      {children}
      <PopupNotification {...popupConfig} />
    </PopupContext.Provider>
  )
}

// Hook for using popup
export function usePopup() {
  const context = useContext(PopupContext)
  if (!context) {
    // Fallback for components not wrapped in provider
    const [popupConfig, setPopupConfig] = useState<PopupConfig>({
      isOpen: false,
      message: '',
      type: 'info'
    })

    const showPopup = (message: string, type: PopupType = 'info', options?: Partial<PopupConfig>) => {
      setPopupConfig({
        isOpen: true,
        message,
        type,
        ...options,
        onClose: () => {
          setPopupConfig(prev => ({ ...prev, isOpen: false }))
          options?.onClose?.()
        }
      })
    }

    const hidePopup = () => {
      setPopupConfig(prev => ({ ...prev, isOpen: false }))
    }

    return {
      popupConfig,
      showPopup,
      hidePopup,
      PopupComponent: () => <PopupNotification {...popupConfig} />
    }
  }
  
  return context
}
