import React, { useState, useEffect, useRef } from "react";
import { FaGavel, FaPaperPlane, FaRedo, FaPhone, FaFileAlt, FaInfoCircle, FaRobot } from "react-icons/fa";
import AIChat from "./components/AIChat";
import "./App.css";

function App() {
  const [showChat, setShowChat] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationState, setConversationState] = useState({});
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (shouldScrollToTop) {
        setTimeout(scrollToTop, 100);
        setShouldScrollToTop(false);
      } else {
        scrollToBottom();
      }
    }
  }, [messages, shouldScrollToTop]);

  const sendMessage = async (message, scrollTop = false) => {
    setLoading(true);
    
    if (scrollTop) {
      setShouldScrollToTop(true);
    }
    
    const userMessage = { role: "user", content: message };
    setMessages(prev => [...prev, userMessage]);
    setUserInput("");

    try {
      const response = await fetch("https://court-legal-chatbot.onrender.com/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message.toLowerCase(),
          conversation_state: conversationState
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Track topic for AI assistant
      if (data.conversation_state && data.conversation_state.topic) {
        setCurrentTopic(data.conversation_state.topic.replace('_', ' '));
      }
      
      setMessages(prev => [...prev, {
        role: "bot",
        content: data.response,
        options: data.options || [],
        referrals: data.referrals || []
      }]);
      
      setConversationState(data.conversation_state || {});
    } catch (error) {
      console.error("Connection error details:", error);
      setMessages(prev => [...prev, {
        role: "bot",
        content: "⚠️ Unable to connect to the server. Please wait 60 seconds for the backend to wake up, then click 'Restart' to try again.",
        options: []
      }]);
    }
    
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim() && !loading) {
      sendMessage(userInput.trim(), false);
    }
  };

  const handleOptionClick = (option) => {
    if (!loading) {
      const shouldScroll = option.toLowerCase() === "connect with a resource";
      sendMessage(option, shouldScroll);
    }
  };

  const handleRestart = () => {
    setMessages([]);
    setConversationState({});
    setUserInput("");
    setShouldScrollToTop(false);
    setCurrentTopic("");
    sendMessage("start", false);
  };

  // Show AI Chat mode
  if (showAIChat) {
    return (
      <AIChat 
        topic={currentTopic} 
        onBack={() => setShowAIChat(false)} 
      />
    );
  }

  if (!showChat) {
    return (
      <div className="landing">
        <div className="landing-header">
          <div className="logo-container">
            <div className="icon-circle">
              <FaGavel color="#fff" size={50} />
            </div>
            <h1>Illinois Legal Triage</h1>
            <p className="subtitle">Self-Help Resource Navigator</p>
          </div>
        </div>
        
        <div className="landing-content">
          <h2>Welcome to the Legal Resource Portal</h2>
          <p className="tagline">
            This confidential chatbot connects Illinois residents with legal information and referrals for:
          </p>
          
          <div className="topic-cards">
            <div className="topic-card">
              <div className="topic-icon">👨‍👩‍👧‍👦</div>
              <h3>Child Support</h3>
              <p>Resources for custody and support matters</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">🎓</div>
              <h3>Education</h3>
              <p>School rights and special education help</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">🏠</div>
              <h3>Housing</h3>
              <p>Tenant rights and eviction assistance</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">⚖️</div>
              <h3>Divorce</h3>
              <p>Divorce proceedings and legal guidance</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">👶</div>
              <h3>Custody</h3>
              <p>Child custody and parenting time</p>
            </div>
          </div>

          <button 
            className="btn btn-primary btn-large btn-start" 
            onClick={() => {
              setShowChat(true);
              sendMessage("start", false);
            }}
          >
            Begin Case Inquiry
          </button>

          <div className="disclaimer-box">
            <p className="disclaimer-title">⚖️ Important Legal Notice</p>
            <p className="disclaimer-text">
              This tool provides general legal information only — <strong>not legal advice</strong>. 
              For emergencies or personalized guidance, contact a licensed attorney or legal aid organization directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="header-content">
          <FaGavel size={28} color="#fff" />
          <div className="header-text">
            <h2>Illinois Legal Triage Chatbot</h2>
            <p>Information & Referrals</p>
          </div>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <p>Starting conversation...</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.content}
                  
                  {msg.referrals && msg.referrals.length > 0 && (
                    <div className="referrals">
                      <h4 className="referrals-title">📋 Recommended Resources:</h4>
                      {msg.referrals.map((ref, i) => (
                        <div key={i} className="referral-card">
                          <div className="referral-header">
                            <h3>{ref.name}</h3>
                          </div>
                          <p className="referral-description">{ref.description}</p>
                          
                          <div className="referral-contact">
                            {ref.phone && ref.phone !== "" && (
                              <div className="contact-item">
                                <FaPhone size={14} />
                                <span><strong>Intake Phone:</strong> {ref.phone}</span>
                              </div>
                            )}
                            
                            {ref.intake_form && ref.intake_form !== "" && (
                              <div className="contact-item">
                                <FaFileAlt size={14} />
                                <a 
                                  href={ref.intake_form} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="intake-link"
                                >
                                  Direct Intake Form
                                </a>
                              </div>
                            )}
                            
                            {ref.intake_instructions && ref.intake_instructions !== "" && (
                              <div className="intake-instructions">
                                <FaInfoCircle size={14} />
                                <span>{ref.intake_instructions}</span>
                              </div>
                            )}
                          </div>
                          
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-referral"
                          >
                            Visit Website →
                          </a>
                        </div>
                      ))}
                      
                      {/* ADD AI ASSISTANT BUTTON AFTER REFERRALS */}
                      {conversationState.step === "complete" && (
                        <div className="ai-assistant-prompt">
                          <button 
                            className="btn btn-ai-assistant"
                            onClick={() => setShowAIChat(true)}
                          >
                            <FaRobot size={18} /> Have Questions? Ask the AI Legal Assistant
                          </button>
                          <p className="ai-assistant-hint">
                            Get answers about forms, procedures, deadlines, and court processes
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {msg.options && msg.options.length > 0 && (
                    <div className="options">
                      {msg.options.map((option, i) => (
                        <button
                          key={i}
                          className="btn btn-option"
                          onClick={() => handleOptionClick(option)}
                          disabled={loading}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message-wrapper bot">
              <div className="message bot">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <button onClick={handleRestart} className="btn btn-restart" title="Restart">
            <FaRedo size={16} />
          </button>
          
          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={loading}
              className="chat-input"
            />
            <button 
              type="submit" 
              className="btn btn-send" 
              disabled={loading || !userInput.trim()}
              title="Send message"
            >
              <FaPaperPlane size={18} />
            </button>
          </form>
        </div>

        <div className="chat-footer">
          <p className="footer-disclaimer">
            ⚖️ Information only — not legal advice. For emergencies, contact an attorney.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
