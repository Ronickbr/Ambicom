import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { offlineQueue } from '@/lib/offline-queue'
import { toast } from 'sonner'
import { Product } from '@/lib/types'
import { logger } from '@/lib/logger'
import { generateNextInternalSerial } from '@/lib/id-generator'

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
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
      const model = import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.NEXT_PUBLIC_OPENROUTER_MODEL || "x-ai/grok-4.1-fast";

      if (!apiKey) {
        throw new Error("API Key do OpenRouter não configurada.");
      }

      // Converte Base64 (com data:image/...) para apenas o conteúdo se necessário
      const base64Image = imageSrc.includes('base64,') ? imageSrc.split('base64,')[1] : imageSrc;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Scan Relatorio"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analise esta etiqueta de produto (geralmente Electrolux) e extraia os dados técnicos. Retorne APENAS um objeto JSON com estes campos (use nulo se não encontrar): fabricante, modelo, codigo_comercial, cor, pnc_ml, numero_serie, data_fabricacao, gas_refrigerante, volume_total, tensao, tipo, classe_mercado, carga_gas, compressor, volume_freezer, volume_refrigerator, pressao_alta_baixa, capacidade_congelamento, corrente_eletrica, potencia_degelo, frequencia. Não escreva nada além do JSON."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        // OpenRouter error handled silently
        throw new Error(`Falha na API do OpenRouter: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

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

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          ...data,
          ...photoUrls,
          internal_serial: internalSerial,
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
