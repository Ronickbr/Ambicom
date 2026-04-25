import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { offlineQueue } from '@/lib/offline-queue'
import { toast } from 'sonner'
import { Product } from '@/lib/types'
import { logger } from '@/lib/logger'
import { generateNextInternalSerial } from '@/lib/id-generator'
import { calculateProductSize, resolveCanonicalBrand } from '@/lib/product-utils'

const SCAN_COOLDOWN = 3000

export function useScan() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastScans, setLastScans] = useState<Product[]>([])
  const [lastScanTime, setLastScanTime] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // OCR States
  const [ocrResult, setOcrResult] = useState<Record<string, any> | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)

  // Sync logic
  useEffect(() => {
    const processSync = () => {
      if (navigator.onLine) {
        offlineQueue.processQueue(async (item) => {
          if (item.type === 'scan') {
            try {
              const { data } = await supabase
                .from("products")
                .select("*")
                .or(`internal_serial.eq.${item.code.toUpperCase()},original_serial.eq.${item.code.toUpperCase()}`)
                .maybeSingle()

              if (data) {
                setLastScans(prev => {
                  const filtered = prev.filter(p => p.internal_serial !== item.code)
                  return [data, ...filtered].slice(0, 5)
                })
                toast.success(`Item sincronizado: ${item.code}`)
              } else {
                toast.warning(`Item não encontrado no banco: ${item.code}`)
              }
            } catch (e) {
              logger.error("Sync error in useScan", e)
              throw e // Re-throw to keep in queue
            }
          }
        })
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      toast.success("Conexão restabelecida. Sincronizando dados...")
      processSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("Você está offline. Scans serão salvos localmente.")
    }

    // Check sync on mount
    processSync()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const scanImage = async (imageSrc: string) => {
    setOcrLoading(true)
    try {
      // Converte Base64 (com data:image/...) para apenas o conteúdo
      const base64Image = imageSrc.includes('base64,') ? imageSrc.split('base64,')[1] : imageSrc;
      const configuredModel = import.meta.env.VITE_OPENAI_MODEL;

      // Chama a Edge Function do Supabase para processar o OCR com segurança
      const { data, error: functionError, response } = await supabase.functions.invoke('ocr', {
        body: {
          image: base64Image,
          model: typeof configuredModel === "string" && configuredModel.trim().length > 0 ? configuredModel.trim() : undefined
        },
        timeout: 60000
      });

      if (functionError) {
        let description = functionError.message;
        try {
          const contentType = response?.headers?.get("Content-Type") || "";
          if (response) {
            if (contentType.includes("application/json")) {
              const json = await response.json();
              description = typeof json?.error === "string" ? json.error : JSON.stringify(json);
            } else {
              const text = await response.text();
              if (typeof text === "string" && text.trim().length > 0) description = text;
            }
          }
        } catch (e) {
          logger.debug("Falha ao ler o corpo do erro da Edge Function", e);
        }
        throw new Error(`Falha no processamento via Edge Function: ${description}`);
      }

      const content = data?.content;

      if (content) {
        const parsedData = typeof content === 'string' ? JSON.parse(content) : content;
        setOcrResult(parsedData);
        toast.success("Dados extraídos com precisão via IA!");
        return parsedData;
      } else {
        toast.warning("Não foi possível processar a imagem.");
        return null;
      }
    } catch (error) {
      logger.error("AI OCR Error:", error);
      toast.error("Erro na leitura da IA", {
        description: "Verifique sua conexão ou API Key."
      });
      return null;
    } finally {
      setOcrLoading(false);
    }
  }

  const registerProduct = async (data: Partial<Product>, base64Photos?: Record<string, string | null>) => {
    setIsProcessing(true)
    try {
      const internalSerial = await generateNextInternalSerial()
      const { has_water_dispenser, ...rest } = data
      const photoUrls: Record<string, string | null> = {
        photo_product: null,
        photo_model: null,
        photo_serial: null,
        photo_defect: null
      }

      // Upload photos in parallel if provided
      if (base64Photos && isOnline) {
        const uploadPromises = Object.entries(base64Photos).map(async ([key, base64]) => {
          if (!base64) return;

          const fileName = `${internalSerial}/${key}_${Date.now()}.jpg`;
          const blob = await fetch(base64).then(res => res.blob());

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-photos')
            .upload(fileName, blob, { contentType: 'image/jpeg' });

          if (uploadError) {
            logger.error(`Error uploading ${key}`, uploadError);
            toast.error("Falha ao salvar imagem no Storage", {
              description: uploadError.message
            });
          } else if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('product-photos')
              .getPublicUrl(fileName);
            photoUrls[key] = publicUrl;
          }
        });

        await Promise.all(uploadPromises);
      }

      const { data: { user } } = await supabase.auth.getUser();
      const productSize = await calculateProductSize(data.volume_total);
      const canonicalBrand = await resolveCanonicalBrand(data.brand);

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          ...rest,
          has_water_dispenser: Boolean(has_water_dispenser),
          ...photoUrls,
          size: productSize,
          internal_serial: internalSerial,
          brand: canonicalBrand,
          status: 'CADASTRO',
          is_in_stock: true,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error

      toast.success("Produto registrado com sucesso!", {
        description: `ID Interno: ${internalSerial}`
      })

      setLastScans(prev => [newProduct, ...prev].slice(0, 5))
      setNotFound(null)
      setOcrResult(null)
      return newProduct
    } catch (error) {
      const err = error as Error
      logger.error("Error registering product", err)
      toast.error("Erro ao cadastrar", { description: err.message })
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    lastScans,
    isOnline,
    ocrResult,
    ocrLoading,
    scanImage,
    setOcrResult,
    notFound,
    setNotFound,
    registerProduct
  }
}
