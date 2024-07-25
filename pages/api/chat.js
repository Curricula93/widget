// File: pages/api/chat.js
import { HfInference } from '@huggingface/inference'
import { PdfReader } from 'pdfreader'
import fetch from 'node-fetch'

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

const getPdfContent = async (url) => {
  const response = await fetch(url)
  const buffer = await response.buffer()
  return new Promise((resolve, reject) => {
    const reader = new PdfReader()
    let content = ''
    reader.parseBuffer(buffer, (err, item) => {
      if (err) reject(err)
      else if (!item) resolve(content)
      else if (item.text) content += item.text + ' '
    })
  })
}

let pdfContent = null

export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (!pdfContent) {
      try {
        pdfContent = await getPdfContent(process.env.PDF_URL)
      } catch (error) {
        console.error('Error fetching PDF content:', error)
        return res.status(500).json({ error: 'Failed to fetch PDF content' })
      }
    }

    const { message } = req.body
    
    const prompt = `You are a professional customer care specialist. Use the following information to answer the customer's question: "${pdfContent}". Customer: ${message}\nCustomer Care Specialist:`
    
    try {
      const response = await hf.textGeneration({
        model: 'google/gemma-1.1-7b-it',
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          top_p: 0.95,
          repetition_penalty: 1.1,
        },
      })

      res.status(200).json({ reply: response.generated_text })
    } catch (error) {
      console.error('Error generating response:', error)
      res.status(500).json({ error: 'Failed to generate response' })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
