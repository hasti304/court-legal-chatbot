import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { FaGavel, FaPaperPlane, FaRedo, FaPhone, FaFileAlt, FaInfoCircle, FaRobot, FaArrowLeft } from "react-icons/fa";
import "./App.css";
import EmergencyButton from "./components/EmergencyButton";

const AIChat = lazy(() => import("./components/AIChat"));

function App() {
  const [showChat, setShowChat] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationState, setConversationState] = useState({});
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const sendMessage = async (message, isBackAction = false) => {
    setLoading(true);
    
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
      
      if (data.conversation_state && data.conversation_state.topic) {
        setCurrentTopic(data.conversation_state.topic.replace('_', ' '));
      }
      
      const botMessage = {
        role: "bot",
        content: data.response,
        options: data.options || [],
        referrals: data.referrals || []
      };
      
      setMessages(prev => [...prev, botMessage]);
      setConversationState(data.conversation_state || {});
      
      if (!isBackAction && data.conversation_state) {
        setConversationHistory(prev => [...prev, {
          state: data.conversation_state,
          userMessage: userMessage,
          botMessage: botMessage,
          allMessages: [...messages, userMessage, botMessage]
        }]);
      }
      
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
      sendMessage(userInput.trim());
    }
  };

  const handleOptionClick = (option) => {
    if (!loading) {
      sendMessage(option);
    }
  };

  const handleRestart = () => {
    setMessages([]);
    setConversationState({});
    setConversationHistory([]);
    setUserInput("");
    setCurrentTopic("");
    sendMessage("start");
  };

  const handleBack = () => {
    if (conversationHistory.length < 2) {
      handleRestart();
      return;
    }
    
    const newHistory = conversationHistory.slice(0, -1);
    const previousState = newHistory[newHistory.length - 1];
    
    setConversationHistory(newHistory);
    setConversationState(previousState.state);
    setMessages(previousState.allMessages);
  };

  if (showAIChat) {
    return (
      <Suspense fallback={<div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>Loading AI Chat...</div>}>
        <AIChat 
          topic={currentTopic} 
          onBack={() => setShowAIChat(false)} 
        />
      </Suspense>
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
            <h1>CAL Legal Information and Resources Chatbot</h1>
            <p className="subtitle">Self-Help Resource Navigator</p>
          </div>
        </div>
        
        <div className="landing-content">
          <h2>Welcome to the Legal Resource Portal</h2>
          <p className="tagline">
            This chatbot connects Illinois residents with legal information and referrals for:
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
              <div className="topic-icon">👶🏾</div>
              <h3>Custody</h3>
              <p>Child custody and parenting time</p>
            </div>
          </div>

          <button 
            className="btn btn-primary btn-large btn-start" 
            onClick={() => {
              setShowChat(true);
              sendMessage("start");
            }}
          >
            Begin Case Inquiry
          </button>

          <div className="disclaimer-box">
            <p className="disclaimer-title">⚖️ Important Legal Notice</p>
            <p className="disclaimer-text">
              <strong>Legal information and resources only, not legal advice.</strong>
            </p>
            <p className="privacy-warning">
              ⚠️ <strong>Privacy Notice:</strong> This chatbot is not private. Any information you provide could be disclosed. Do not share sensitive personal information.
            </p>
          </div>
        </div>
        
        <EmergencyButton />
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="header-content">
          <FaGavel size={28} color="#fff" />
          <div className="header-text">
            <h2>CAL Legal Information and Resources Chatbot</h2>
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
                          
                          {ref.is_nfp && (
                            <button 
                              className="btn btn-nfp-intake"
                              onClick={() => window.open('https://www.chicagoadvocatelegal.com/contact.html', '_blank')}
                            >
                              📅 Schedule Intake Appointment with Cindy
                            </button>
                          )}
                          
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
          <button 
            onClick={handleBack} 
            className="btn btn-back" 
            title="Go Back" 
            disabled={conversationHistory.length < 2 || loading}
          >
            <FaArrowLeft size={24} />
          </button>
          
          <button onClick={handleRestart} className="btn btn-restart" title="Restart">
            <FaRedo size={24} />
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
            <strong>Legal information and resources only, not legal advice.</strong>
          </p>
          <p className="footer-privacy-warning">
            ⚠️ <strong>Privacy Notice:</strong> This chatbot is not private. Any information you provide could be disclosed.
          </p>
        </div>
      </div>
      
      <EmergencyButton />
    </div>
  );
}

export default App;
