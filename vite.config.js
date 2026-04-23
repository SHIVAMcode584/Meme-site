import { Buffer } from 'node:buffer'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getMemeSuggestions, parseMemeApiSource, publishSelectedMemes } from './api/_lib/meme-ingest.js'
import { createAdminUserClient, requireAdminRequest } from './api/_lib/admin-auth.js'
import keywordMemeSearchHandler from './api/keyword-meme-search.js'

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

function adminMemePublisherDevPlugin() {
  return {
    name: 'admin-meme-publisher-dev-route',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname

        if (pathname !== '/api/admin/meme-publisher') {
          return next()
        }

        if (!['GET', 'POST'].includes(req.method || '')) {
          return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
        }

        try {
          const { supabase, token, user } = await requireAdminRequest(req)
          const userClient = createAdminUserClient(token)

          if (req.method === 'GET') {
            const url = new URL(req.url || '/api/admin/meme-publisher', 'http://localhost')
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 5), 1), 10)
            const source = parseMemeApiSource(url.searchParams.get('source') || 'all')
            const candidates = await getMemeSuggestions({ supabase: userClient, limit, source })

            return sendJson(res, 200, {
              ok: true,
              candidates,
            })
          }

          const body = await readRequestBody(req)
          const memes = Array.isArray(body?.memes) ? body.memes : []

          if (memes.length === 0) {
            return sendJson(res, 400, {
              ok: false,
              error: 'No memes were selected.',
            })
          }

          const result = await publishSelectedMemes({
            supabase: userClient,
            memes,
            userId: user?.id || null,
            openAiApiKey: '',
          })

          return sendJson(res, 200, {
            ok: true,
            ...result,
          })
        } catch (error) {
          return sendJson(res, error.statusCode || 500, {
            ok: false,
            error: error.message || 'Meme publishing failed',
          })
        }
      })
    },
  }
}

function keywordMemeSearchDevPlugin() {
  return {
    name: 'keyword-meme-search-dev-route',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname

        if (pathname !== '/api/keyword-meme-search' || req.method !== 'GET') {
          return next()
        }

        try {
          await keywordMemeSearchHandler(req, res)
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error.message || 'Keyword meme search failed',
          })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  process.env.SUPABASE_ANON_KEY ||= env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
  process.env.VITE_SUPABASE_ANON_KEY ||= env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY || ''
  process.env.OCR_SPACE_API_KEY ||= env.OCR_SPACE_API_KEY || ''

  return {
    plugins: [react(), tailwindcss(), ocrKeywordsDevPlugin(), adminMemePublisherDevPlugin(), keywordMemeSearchDevPlugin()],
  }
})
