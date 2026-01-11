import React, { useState, useEffect, useRef } from "react";
import "./AIChat.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { getNormalizedLanguage } from "../i18n";

const AIChat = ({ topic, onBack }) => {
  const { t, i18n } = useTranslation();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: t("ai.placeholder"),
    },
  ]);

  // If the user changes language, keep the initial assistant line aligned
  // when the conversation is still just the first message.
  useEffect(() => {
    if (messages.length === 1 && messages[0]?.role === "assistant") {
      setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: "user", content: inputValue };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("https://court-legal-chatbot.onrender.com/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          topic: topic || "general",
          language: getNormalizedLanguage(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI server error:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response || t("ai.error") },
      ]);
    } catch (error) {
      console.error("AI request failed:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: t("ai.error") }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat-page">
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <button onClick={onBack} className="back-button">
            {t("ai.back")}
          </button>

          <h2>{t("ai.title")}</h2>

          <p className="ai-disclaimer">{t("ai.disclaimer")}</p>
          <p className="ai-privacy-notice">{t("ai.privacy")}</p>
        </div>

        <div className="ai-chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`ai-message ${message.role === "user" ? "user-message" : "assistant-message"}`}
            >
              <div
                className="message-content"
                dangerouslySetInnerHTML={renderMessageContent(message.content)}
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
            onKeyDown={handleKeyDown}
            placeholder={t("ai.placeholder")}
            className="ai-chat-input"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="ai-send-button"
          >
            {isLoading ? t("ai.sending") : t("ai.send")}
          </button>
        </div>

        <div className="ai-chat-footer">
          <p className="help-text">{t("ai.needHelp")}</p>
          <div className="footer-contacts">
            <div className="footer-contact-item">
              <strong>Chicago Advocate Legal, NFP:</strong>{" "}
              <a href="tel:+13128015918">(312) 801-5918</a>
              {" | "}
              <a
                href="https://www.chicagoadvocatelegal.com/contact.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Schedule Appointment
              </a>
            </div>
            <div className="footer-contact-item">
              <strong>Justice Entrepreneurs Project (JEP):</strong>{" "}
              <a href="tel:+13125463282">(312) 546-3282</a>
              {" | "}
              <a href="https://jepchicago.org/intake-form/" target="_blank" rel="noopener noreferrer">
                JEP Intake Form
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
