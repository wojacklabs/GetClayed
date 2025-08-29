'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

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
  confirmButton?: {
    text: string
    onConfirm: () => void
  }
  cancelButton?: {
    text: string
    onCancel: () => void
  }
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
  showCloseButton = true,
  confirmButton,
  cancelButton
}: PopupNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Delay to trigger animation
      setTimeout(() => setIsVisible(true), 10)
      
      // Don't auto-close if there are confirm/cancel buttons
      if (autoClose && autoCloseDelay > 0 && !confirmButton && !cancelButton) {
        const timer = setTimeout(() => {
          handleClose()
        }, autoCloseDelay)
        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [isOpen, autoClose, autoCloseDelay, confirmButton, cancelButton])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose?.()
    }, 300) // Wait for animation to complete
  }

  const handleConfirm = () => {
    setIsVisible(false)
    setTimeout(() => {
      confirmButton?.onConfirm()
      onClose?.()
    }, 300)
  }

  const handleCancel = () => {
    setIsVisible(false)
    setTimeout(() => {
      cancelButton?.onCancel()
      onClose?.()
    }, 300)
  }

  if (!isOpen) return null

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
          titleColor: 'text-gray-900',
          accentBorder: 'border-l-emerald-500'
        }
      case 'error':
        return {
          icon: XCircle,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-50',
          titleColor: 'text-gray-900',
          accentBorder: 'border-l-red-500'
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
          titleColor: 'text-gray-900',
          accentBorder: 'border-l-amber-500'
        }
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: 'text-gray-600',
          iconBg: 'bg-gray-100',
          titleColor: 'text-gray-900',
          accentBorder: 'border-l-gray-400'
        }
    }
  }

  const config = getTypeConfig()
  const IconComponent = config.icon

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
      {/* Modal */}
      <div
        className={`
          relative bg-white rounded-xl shadow-2xl border border-gray-200/80
          max-w-md w-full overflow-hidden pointer-events-auto
          transform transition-all duration-300 ease-out
          ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'}
        `}
      >
        {/* Accent border */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accentBorder} border-l-4`} />
        
        {/* Content */}
        <div className="p-6 pl-7">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center`}>
              <IconComponent className={`w-5 h-5 ${config.iconColor}`} strokeWidth={2} />
            </div>
            
            {/* Text content */}
            <div className="flex-1 min-w-0 pt-0.5">
              {title && (
                <h3 className={`text-base font-semibold ${config.titleColor} mb-1`}>
                  {title}
                </h3>
              )}
              <div className="text-sm text-gray-600 leading-relaxed">
                {message}
              </div>
            </div>
            
            {/* Close button (X) for non-confirmation popups */}
            {!confirmButton && !cancelButton && (
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 -mt-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Buttons */}
          {(confirmButton || cancelButton) ? (
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
              {cancelButton && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {cancelButton.text}
                </button>
              )}
              {confirmButton && (
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {confirmButton.text}
                </button>
              )}
            </div>
          ) : showCloseButton && (
            <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
              >
                OK
              </button>
            </div>
          )}
        </div>
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
