import React, { useEffect, useState } from "react";
import { FaGavel } from "react-icons/fa";
import "./App.css";

function ReferralResult({ answers, onRestart }) {
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    fetch("https://court-legal-chatbot.onrender.com/triage/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
      .then(res => res.json())
      .then(data => {
        setReferral(data.referral);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch referral.");
        setLoading(false);
      });
  }, [answers]);

  const handleFeedback = (e) => {
    e.preventDefault();
    fetch("https://court-legal-chatbot.onrender.com/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, referral, feedback }),
    }).then(() => setFeedbackSent(true));
  };

  if (loading) return <div className="loading">Finding the best resource for you...</div>;
  if (error) return <div className="error">{error}</div>;

  let name = "", url = "";
  if (referral && referral.resource) {
    const splitIndex = referral.resource.indexOf(" - ");
    if (splitIndex > -1) {
      name = referral.resource.substring(0, splitIndex);
      url = referral.resource.substring(splitIndex + 3);
    } else {
      name = referral.resource;
      url = referral.resource;
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Your Recommended Resource</h2>
        <p className="subtitle">Based on your answers, we recommend this resource for help:</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-large">
          {name}
        </a>
        <div className="info-box">
          {referral.level === 1 && "📘 Level 1: General self-help legal information and forms to get started."}
          {referral.level === 2 && "📗 Level 2: Illinois Legal Aid or trusted nonprofit for more specific guidance."}
          {referral.level === 3 && "📕 Level 3: Direct referral to a nonprofit legal organization that may offer live attorney assistance."}
        </div>
        <button onClick={onRestart} className="btn btn-outline btn-large">Start Over / New Inquiry</button>
        <p className="disclaimer">
          ⚖️ This chatbot provides general legal information only—not legal advice.<br />
          For emergencies or personalized advice, contact a licensed attorney or legal aid provider.
        </p>
        <form onSubmit={handleFeedback} className="feedback-form">
          <label htmlFor="feedback">Was this referral helpful?</label>
          <select id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} required>
            <option value="">-- Please select --</option>
            <option value="yes">Yes, very helpful</option>
            <option value="no">No, not helpful</option>
            <option value="unsure">Not sure yet</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={feedbackSent || !feedback}>
            {feedbackSent ? "✓ Thank you!" : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [showTriage, setShowTriage] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (showTriage) {
      fetch("https://court-legal-chatbot.onrender.com/triage/questions")
        .then(res => res.json())
        .then(data => setQuestions(data.questions || []));
    }
  }, [showTriage]);

  if (!showTriage) {
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
          <button className="btn btn-primary btn-large" onClick={() => setShowTriage(true)}>
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

  if (!questions.length && showTriage) return <div className="loading">Loading your inquiry...</div>;

  const current = questions[step];

  const handleNext = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const answer = formData.get("answer");
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    if (step === questions.length - 1) setDone(true);
    else setStep(step + 1);
  };

  const handleRestart = () => {
    setAnswers({});
    setStep(0);
    setDone(false);
    setShowTriage(false);
  };

  if (done) return <ReferralResult answers={answers} onRestart={handleRestart} />;

  return (
    <div className="container">
      <div className="card">
        <h2>Case Inquiry - Step {step + 1} of {questions.length}</h2>
        <form onSubmit={handleNext}>
          <label htmlFor="answer" className="question-label">{current.prompt}</label>
          {current.type === "choice" ? (
            <select name="answer" id="answer" required>
              <option value="">-- Please select --</option>
              {current.choices.map((choice) => (
                <option value={choice} key={choice}>{choice}</option>
              ))}
            </select>
          ) : (
            <input
              name="answer"
              id="answer"
              type="text"
              required
              pattern={current.id === "zipcode" ? "\\d{5}" : undefined}
              inputMode={current.id === "zipcode" ? "numeric" : "text"}
              placeholder={current.id === "zipcode" ? "e.g., 60601" : "Type your answer"}
            />
          )}
          <div className="button-row">
            <button type="submit" className="btn btn-primary">Next</button>
            <button type="button" className="btn btn-outline" onClick={handleRestart}>Back / Restart</button>
          </div>
        </form>
        <p className="disclaimer">This is an Illinois-specific court triage tool. It does not provide personalized legal advice.</p>
      </div>
    </div>
  );
}

export default App;
