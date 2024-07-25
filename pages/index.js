// File: pages/index.js
import { useState } from 'react'
import Head from 'next/head'

export default function Home() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)
    setMessages(prev => [...prev, { text: input, sender: 'user' }])
    setInput('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch response')
      }

      const data = await response.json()
      setMessages(prev => [...prev, { text: data.reply, sender: 'bot' }])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { text: "Sorry, I couldn't process your request. Please try again.", sender: 'bot' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Head>
        <title>Customer Care Chatbot</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col h-screen">
        <h1 className="text-2xl font-bold mb-4 text-center">Customer Care Chatbot</h1>
        <div className="flex-grow overflow-y-auto mb-4 border rounded p-2">
          {messages.map((message, index) => (
            <div key={index} className={`mb-2 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block p-2 rounded-lg ${message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                {message.text}
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-grow border rounded-l p-2"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  )
}

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
