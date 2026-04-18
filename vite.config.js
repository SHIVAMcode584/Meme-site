import { Buffer } from 'node:buffer'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const process = globalThis.process
const OCR_API_URL = 'https://api.ocr.space/parse/image'
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function extractTextFromPayload(payload) {
  if (Array.isArray(payload?.ParsedResults)) {
    return payload.ParsedResults.map((item) => item?.ParsedText || '').join('\n').trim()
  }

  return String(payload?.ParsedText || '').trim()
}

async function readRequestBody(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  if (!rawBody) return {}

  try {
    return JSON.parse(rawBody)
  } catch {
    return {}
  }
}

function ocrKeywordsDevPlugin() {
  return {
    name: 'ocr-keywords-dev-route',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/ocr-keywords' || req.method !== 'POST') {
          return next()
        }

        try {
          const body = await readRequestBody(req)
          const imageSource = String(body?.imageSource || body?.imageUrl || body?.base64Image || '').trim()
          const isBase64 = imageSource.startsWith('data:')
          const isRemoteUrl = /^https?:\/\//i.test(imageSource)

          if (!imageSource) {
            return sendJson(res, 400, { error: 'Missing image source.' })
          }

          if (!isBase64 && !isRemoteUrl) {
            return sendJson(res, 400, { error: 'Image source must be a direct image URL or data URL.' })
          }

          const params = new URLSearchParams()
          params.set('language', String(body?.language || 'eng'))
          params.set('isOverlayRequired', 'false')

          if (isBase64) {
            params.set('base64Image', imageSource)
          } else {
            params.set('url', imageSource)
          }

          const response = await fetch(OCR_API_URL, {
            method: 'POST',
            headers: {
              apikey: OCR_API_KEY,
            },
            body: params,
          })

          const payload = await response.json()
          const parsedText = extractTextFromPayload(payload)
          const errorMessage =
            (Array.isArray(payload?.ErrorMessage) && payload.ErrorMessage.filter(Boolean).join(' ')) ||
            (typeof payload?.ErrorMessage === 'string' && payload.ErrorMessage.trim()) ||
            (typeof payload?.ErrorDetails === 'string' && payload.ErrorDetails.trim()) ||
            null

          if (!response.ok || payload?.IsErroredOnProcessing || !parsedText) {
            return sendJson(res, 200, {
              ok: false,
              text: '',
              error: errorMessage || 'No text detected in image',
            })
          }

          return sendJson(res, 200, {
            ok: true,
            text: parsedText,
          })
        } catch (error) {
          return sendJson(res, 500, {
            error: error.message || 'OCR request failed',
          })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ocrKeywordsDevPlugin()],
})
