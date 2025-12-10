import React, { useState, useRef, useEffect } from 'react';
import './AIChat.css';

function AIChat({ topic, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial disclaimer message
    const disclaimer = {
      role: 'assistant',
      content: "I am not a lawyer. I can help you understand Illinois court procedures and forms, but I cannot give legal advice or tell you what you should do in your particular case.\n\nWhat questions do you have about " + 
        (topic ? topic.toLowerCase() : "Illinois court procedures") + "?"
    };
    setMessages([disclaimer]);
  }, [topic]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // For local testing: http://localhost:8000/ai-chat
      // For production: https://court-legal-chatbot.onrender.com/ai-chat
      const response = await fetch('http://localhost:8000/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].filter(m => m.role !== 'system'),
          topic: topic
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage = {
        role: 'assistant',
        content: data.response
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error connecting to the AI assistant. Please try again or contact Chicago Advocate Legal at (312) 801-5918 for assistance.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat-container">
      <div className="chat-header-ai">
        <button onClick={onBack} className="back-button">
          ← Back to Resources
        </button>
        <h2>Illinois Legal Information Assistant</h2>
        {topic && <span className="topic-badge">{topic}</span>}
      </div>

      <div className="messages-container-ai">
        {messages.map((msg, index) => (
          <div key={index} className={`message-ai ${msg.role}`}>
            <div className="message-content-ai">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-ai assistant">
            <div className="message-content-ai">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container-ai">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about forms, procedures, deadlines, or definitions..."
          rows="2"
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading || !inputValue.trim()}
          className="send-button-ai"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      <div className="chat-footer-ai">
        <small>⚠️ This assistant provides legal information only, not legal advice.</small>
      </div>
    </div>
  );
}

export default AIChat;
