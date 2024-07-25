import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

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

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let botReply = ''

      setMessages(prev => [...prev, { text: '', sender: 'bot' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        botReply += chunk
        setMessages(prev => [
          ...prev.slice(0, -1),
          { text: prev[prev.length - 1].text + chunk, sender: 'bot' }
        ])
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { text: "I apologize, but I encountered an error while processing your request. Please try again later or contact our support team if the issue persists.", sender: 'bot' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Head>
        <title>AI Customer Care Assistant</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col h-screen">
        <h1 className="text-2xl font-bold mb-4 text-center">AI Customer Care Assistant</h1>
        <div className="flex-grow overflow-y-auto mb-4 border rounded p-2 bg-gray-50">
          {messages.map((message, index) => (
            <div key={index} className={`mb-2 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block p-2 rounded-lg ${
                message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300'
              }`}>
                {message.text}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
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
            className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  )
}
