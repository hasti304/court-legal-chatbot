import React, { useState, useEffect, useRef } from "react";
import "./AIChat.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { getNormalizedLanguage } from "../i18n";
import {
  FaArrowLeft,
  FaPaperPlane,
  FaVolumeUp,
  FaStop,
  FaSignOutAlt,
  FaTrashAlt,
} from "react-icons/fa";

const API_BASE = String(
  import.meta.env.VITE_API_BASE_URL ?? "https://court-legal-chatbot.onrender.com"
).replace(/\/+$/, "");

const AIChat = ({ topic, onBack }) => {
  const { t, i18n } = useTranslation();

  const [messages, setMessages] = useState([
    { role: "assistant", content: t("ai.placeholder") },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const messagesEndRef = useRef(null);

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  const apiUrl = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  useEffect(() => {
    if (messages.length === 1 && messages[0]?.role === "assistant") {
      setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  useEffect(() => {
    if (!speechEnabled || !messages.length) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage?.content) {
      speakText(lastMessage.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, speechEnabled]);

  const renderMessageContent = (content) => {
    const rawHtml = marked.parse(content || "", { breaks: true });
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speakText = (text) => {
    if (!speechSupported || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(String(text));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const clearAIConversation = () => {
    stopSpeaking();
    setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
    setInputValue("");
  };

  const quickExit = () => {
    try {
      stopSpeaking();
      setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
      setInputValue("");
      window.location.replace("https://www.google.com");
    } catch (e) {
      window.location.href = "https://www.google.com";
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: "user", content: inputValue.trim() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(apiUrl("/ai-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("ai.error") },
      ]);
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
          <div className="ai-header-top">
            <button onClick={onBack} className="back-button" type="button">
              <FaArrowLeft /> {t("ai.back")}
            </button>

            <h2>{t("ai.title")}</h2>
          </div>

          <p className="ai-disclaimer">{t("ai.disclaimer")}</p>
          <p className="ai-privacy-notice">{t("ai.privacy")}</p>

          <div className="ai-toolbar">
            <button
              type="button"
              className="ai-toolbar-button danger"
              onClick={quickExit}
            >
              <FaSignOutAlt /> Quick Exit
            </button>

            <button
              type="button"
              className="ai-toolbar-button neutral"
              onClick={clearAIConversation}
            >
              <FaTrashAlt /> Clear Chat
            </button>

            {speechSupported && (
              <button
                type="button"
                className="ai-toolbar-button dark"
                onClick={() => {
                  if (speechEnabled) {
                    stopSpeaking();
                    setSpeechEnabled(false);
                  } else {
                    setSpeechEnabled(true);
                  }
                }}
              >
                {speechEnabled ? (
                  <>
                    <FaStop /> Turn Off Read Aloud
                  </>
                ) : (
                  <>
                    <FaVolumeUp /> Turn On Read Aloud
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="ai-chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`ai-message ${
                message.role === "user" ? "user-message" : "assistant-message"
              }`}
            >
              <div
                className="message-content"
                dangerouslySetInnerHTML={renderMessageContent(message.content)}
              />

              {message.role === "assistant" && speechSupported && (
                <div className="ai-message-tools">
                  <button
                    type="button"
                    className="ai-read-button"
                    onClick={() => speakText(message.content)}
                  >
                    <FaVolumeUp /> Read aloud
                  </button>

                  {speaking && (
                    <button
                      type="button"
                      className="ai-read-button stop"
                      onClick={stopSpeaking}
                    >
                      <FaStop /> Stop
                    </button>
                  )}
                </div>
              )}
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
            type="button"
          >
            <FaPaperPlane />
            <span>{isLoading ? t("ai.sending") : t("ai.send")}</span>
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
                Direct Intake Form
              </a>
            </div>

            <div className="footer-contact-item">
              <strong>Justice Entrepreneurs Project (JEP):</strong>{" "}
              <a href="tel:+13125463282">(312) 546-3282</a>
              {" | "}
              <a
                href="https://jepchicago.org/connect-with-a-lawyer/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Find a Lawyer
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;