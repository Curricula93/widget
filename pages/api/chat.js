import { HfInference } from '@huggingface/inference'
import { PdfReader } from 'pdfreader'
import fetch from 'node-fetch'
import { createParser } from 'eventsource-parser'

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

let pdfContent = null

const getPdfContent = async (url) => {
  if (pdfContent) return pdfContent
  const response = await fetch(url)
  const buffer = await response.buffer()
  return new Promise((resolve, reject) => {
    const reader = new PdfReader()
    let content = ''
    reader.parseBuffer(buffer, (err, item) => {
      if (err) reject(err)
      else if (!item) {
        pdfContent = content // Cache the content
        resolve(content)
      }
      else if (item.text) content += item.text + ' '
    })
  })
}

const streamingHandler = async (res, prompt) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const response = await hf.textGenerationStream({
    model: 'google/gemma-1.1-7b-it',
    inputs: prompt,
    parameters: {
      max_new_tokens: 250,
      temperature: 0.7,
      top_p: 0.95,
      repetition_penalty: 1.1,
    },
  })

  const parser = createParser((event) => {
    if (event.type === 'event') {
      const data = JSON.parse(event.data)
      if (data.token?.text) {
        const queue = encoder.encode(data.token.text)
        res.write(queue)
      }
    }
  })

  for await (const chunk of response) {
    parser.feed(decoder.decode(chunk))
  }
  
  res.end()
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const content = await getPdfContent(process.env.PDF_URL)
      const { message } = req.body
      
      const prompt = `You are a professional customer care specialist. Use the following information to answer the customer's question: "${content}". Customer: ${message}\nCustomer Care Specialist:`
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      })

      await streamingHandler(res, prompt)
    } catch (error) {
      console.error('Error:', error)
      res.status(500).json({ error: 'An error occurred while processing your request.' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
