'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'

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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50'
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center z-[10000] p-4 pointer-events-none">
      <div
        className={`
          mt-16 max-w-md w-full rounded-lg shadow-lg border pointer-events-auto
          transform transition-all duration-300 ease-out
          ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
          ${getTypeStyles()}
        `}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="ml-3 flex-1">
              {title && (
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {title}
                </h3>
              )}
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {message}
              </div>
            </div>
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="ml-3 flex-shrink-0 inline-flex rounded-md p-1.5 
                         hover:bg-gray-200 hover:bg-opacity-50 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for managing popup state
export function usePopup() {
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
