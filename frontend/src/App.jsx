import React, { useEffect, useState } from "react";

// ReferralResult component (new)
function ReferralResult({ answers }) {
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/triage/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data) => {
        setReferral(data.referral);
        setLoading(false);
      })
      .catch(() => {
  setError("Failed to fetch referral.");
  setLoading(false);
      });

  }, [answers]);

  if (loading) return <p>Finding the best resource for you...</p>;
  if (error) return <p>{error}</p>;

  // Parse the resource for a clickable link
  let name = "";
  let url = "";
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
    <div>
      <h1>Illinois Court Legal Chatbot</h1>
      <p>
        Based on your answers, we suggest this resource:
        <br />
        <strong>Level {referral.level} Referral</strong>
        <br />
        <a href={url} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      </p>
      <p>
        This chatbot provides general legal info only—not legal advice.  
        If you need immediate legal help, contact a licensed attorney.
      </p>
    </div>
  );
}

function App() {
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/triage/questions")
      .then((res) => res.json())
      .then((data) => setQuestions(data.questions || []));
  }, []);

  if (!questions.length) return <div>Loading triage...</div>;

  const current = questions[step];

  const handleNext = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const answer = formData.get("answer");
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));

    if (step === questions.length - 1) {
      setDone(true);
    } else {
      setStep(step + 1);
    }
  };

  // ReferralResult replaces the old placeholder when triage is complete
  if (done) {
    return <ReferralResult answers={answers} />;
  }

  return (
    <div>
      <h1>Illinois Court Legal Chatbot</h1>
      <form onSubmit={handleNext}>
        <label>
          {current.prompt}
          <br />
          {current.type === "choice" ? (
            <select name="answer" required>
              <option value="">--Select--</option>
              {current.choices.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              name="answer"
              required
              pattern={current.id === "zipcode" ? "\\d{5}" : undefined}
            />
          )}
        </label>
        <br />
        <button type="submit">Next</button>
      </form>
      <p>
        This chatbot provides general legal info only—not legal advice.
      </p>
    </div>
  );
}

export default App;
