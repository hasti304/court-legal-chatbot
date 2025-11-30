import React, { useState } from "react";
import { FaGavel } from "react-icons/fa";
import "./App.css";

function App() {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationState, setConversationState] = useState({});
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (message) => {
    setLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: "user", content: message }]);

    try {
      console.log("Sending request to backend..."); // Debug
      
      const response = await fetch("https://court-legal-chatbot.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.toLowerCase(),
          conversation_state: conversationState
        }),
      });

      console.log("Response status:", response.status); // Debug

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received data:", data); // Debug
      
      // Add bot response to chat
      setMessages(prev => [...prev, {
        role: "bot",
        content: data.response,
        options: data.options || [],
        referrals: data.referrals || []
      }]);
      
      setConversationState(data.conversation_state || {});
      setUserInput("");
    } catch (error) {
      console.error("Connection error:", error); // Debug
      setMessages(prev => [...prev, {
        role: "bot",
        content: "Connection error. The backend may be starting up (takes 30-60 seconds on Render free tier). Please wait a moment and try again.",
        options: ["Start Over"]
      }]);
    }
    
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim()) {
      sendMessage(userInput.trim());
    }
  };

  const handleOptionClick = (option) => {
    sendMessage(option);
  };

  const handleRestart = () => {
    setMessages([]);
    setConversationState({});
    setUserInput("");
    sendMessage("start");
  };

  if (!showChat) {
    return (
      <div className="landing">
        <div className="landing-content">
          <div className="icon-circle">
            <FaGavel color="#fff" size={55} />
          </div>
          <h1>Illinois Court Case Inquiry Portal</h1>
          <p className="tagline">
            Welcome! This confidential chatbot helps you find legal self-help resources and referrals for issues in <strong>child support, education, and housing</strong>.
          </p>
          <button 
            className="btn btn-primary btn-large" 
            onClick={() => {
              setShowChat(true);
              sendMessage("start");
            }}
          >
            Begin Your Case Inquiry
          </button>
        </div>
        <p className="footer-text">
          ⚠️ For emergencies or immediate legal advice, contact a lawyer or legal aid directly.<br />
          This tool provides information only, not legal advice.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card chat-container">
        <h2>Illinois Legal Triage Chatbot</h2>
        
        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.content}
                
                {/* Show referrals if present */}
                {msg.referrals && msg.referrals.length > 0 && (
                  <div className="referrals">
                    {msg.referrals.map((ref, i) => (
                      <div key={i} className="referral-card">
                        <h3>{ref.name}</h3>
                        <p>{ref.description}</p>
                        <a 
                          href={ref.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                        >
                          Visit Website
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Show options as buttons */}
                {msg.options && msg.options.length > 0 && (
                  <div className="options">
                    {msg.options.map((option, i) => (
                      <button
                        key={i}
                        className="btn btn-outline"
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
          ))}
          
          {loading && <div className="loading">Thinking...</div>}
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !userInput.trim()}>
            Send
          </button>
        </form>

        <button onClick={handleRestart} className="btn btn-outline btn-large">
          Start Over
        </button>

        <p className="disclaimer">
          ⚖️ This chatbot provides general legal information only—not legal advice.<br />
          For emergencies or personalized advice, contact a licensed attorney or legal aid provider.
        </p>
      </div>
    </div>
  );
}

export default App;
