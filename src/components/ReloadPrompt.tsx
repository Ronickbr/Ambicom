import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { logger } from "@/lib/logger"

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      // SW Registered
    },
    onRegisterError(error: unknown) {
      logger.error('SW registration error:', error);
    },
  })

  const close = React.useCallback(() => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }, [setOfflineReady, setNeedRefresh])

  React.useEffect(() => {
    if (offlineReady) {
      toast.success('Aplicativo pronto para uso offline', {
        duration: 3000,
        onDismiss: close,
      })
    }
  }, [offlineReady, close])

  React.useEffect(() => {
    if (needRefresh) {
      toast('Nova versão disponível', {
        description: 'Clique para atualizar o aplicativo',
        action: {
          label: 'Atualizar',
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity,
        onDismiss: close,
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      })
    }
  }, [needRefresh, updateServiceWorker, close])

  return null
}
