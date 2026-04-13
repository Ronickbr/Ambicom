import { toast } from 'sonner'
import { logger } from '@/lib/logger'

export interface OfflineScan<T = unknown> {
  id: string
  code: string
  timestamp: number
  type: 'scan' | 'checklist'
  data?: T
}

const QUEUE_KEY = 'offline_scan_queue'

class OfflineQueueManager {
  private getQueue(): OfflineScan[] {
    try {
      if (typeof window === 'undefined') return []
      const stored = localStorage.getItem(QUEUE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      logger.error('Failed to parse offline queue', error)
      return []
    }
  }

  private saveQueue(queue: OfflineScan[]): void {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    } catch (error) {
      logger.error('Failed to save offline queue', error)
      toast.error('Erro ao salvar dados offline. Verifique o armazenamento do navegador.')
    }
  }

  public add<T>(item: Omit<OfflineScan<T>, 'id' | 'timestamp'>): OfflineScan<T> {
    const queue = this.getQueue()
    const newItem: OfflineScan<T> = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }
    
    // Generic type complexity in storage
    queue.push(newItem as unknown as OfflineScan)
    this.saveQueue(queue)
    
    toast.warning('Sem conexão. Item salvo na fila offline.', {
      description: 'Será sincronizado automaticamente quando online.'
    })
    
    logger.info('Added item to offline queue', newItem)
    return newItem
  }

  public getAll(): OfflineScan[] {
    return this.getQueue()
  }

  public remove(id: string): void {
    const queue = this.getQueue()
    const filtered = queue.filter(item => item.id !== id)
    this.saveQueue(filtered)
  }

  public clear(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(QUEUE_KEY)
  }

  public async processQueue(processor: (item: OfflineScan) => Promise<void>): Promise<void> {
    const queue = this.getQueue()
    if (queue.length === 0) return

    toast.info(`Sincronizando ${queue.length} itens offline...`)

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    // Process sequentially to avoid race conditions or flooding the server
    for (const item of queue) {
      try {
        await processor(item)
        this.remove(item.id)
        successCount++
      } catch (error) {
        logger.error('Falha ao processar item offline', { item, error })
        failCount++
        errors.push((error as Error).message || 'Erro desconhecido')
      }
    }

    if (successCount > 0) {
      logger.info(`Synced ${successCount} offline items successfully`)
      toast.success(`${successCount} itens sincronizados com sucesso!`)
    }
    
    if (failCount > 0) {
      toast.error(`${failCount} itens falharam na sincronização.`, {
        description: errors.slice(0, 2).join(', ') + (errors.length > 2 ? '...' : '')
      })
    }
  }
}

export const offlineQueue = new OfflineQueueManager()
