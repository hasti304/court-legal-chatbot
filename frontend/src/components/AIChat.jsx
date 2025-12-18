import React, { useState, useEffect, useRef } from 'react';
import './AIChat.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';


const AIChat = ({ topic, onBack }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I'm your Illinois Legal Information Assistant. I can help you understand court procedures, forms, and processes in Illinois. Remember, I provide general legal information, not legal advice. What would you like to know?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const renderMessageContent = (content) => {
    const rawHtml = marked.parse(content, { breaks: true });
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };


  const sendMessage = async () => {
    if (!inputValue.trim()) return;


    const userMessage = { role: 'user', content: inputValue };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);


    try {
      const response = await fetch(
        'https://court-legal-chatbot.onrender.com/ai-chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: updatedMessages.map((msg) => ({
              role: msg.role,
              content: msg.content
            })),
            topic: topic || 'general'
          })
        }
      );


      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }


      const data = await response.json();


      const assistantMessage = {
        role: 'assistant',
        content: data.response
      };


      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content:
          'I apologize, but I encountered an error. Please try asking your question again, or contact Chicago Advocate Legal at (312) 801-5918 for direct assistance.'
      };
      setMessages((prev) => [...prev, errorMessage]);
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
    <div className="ai-chat-page">
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <button onClick={onBack} className="back-button">
            ← Back to Resources
          </button>
          <h2>Illinois Legal Information Assistant</h2>
          {/* Updated disclaimer per client requirements */}
          <p className="ai-disclaimer">
            ⚖️ Legal information and resources only, not legal advice
          </p>
          <p className="ai-privacy-notice">
            ⚠️ This chatbot is not private. Information provided could be disclosed.
          </p>
        </div>


        <div className="ai-chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`ai-message ${
                message.role === 'user' ? 'user-message' : 'assistant-message'
              }`}
            >
              <div
                className="message-content"
                dangerouslySetInnerHTML={renderMessageContent(
                  message.content
                )}
              />
            </div>
          ))}
          {isLoading && (
            <div className="ai-message assistant-message">
              <div className="message-content typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>


        <div className="ai-chat-input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about Illinois court procedures, forms, or legal processes..."
            className="ai-chat-input"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="ai-send-button"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>


        <div className="ai-chat-footer">
          <p className="help-text">
            Need immediate help? Call Chicago Advocate Legal at{' '}
            <a href="tel:+13128015918">(312) 801-5918</a>
          </p>
        </div>
      </div>
    </div>
  );
};


export default AIChat;
