import React, { useEffect, useState } from "react";

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
    setAnswers({ ...answers, [current.id]: answer });

    if (step === questions.length - 1) {
      setDone(true);
    } else {
      setStep(step + 1);
    }
  };

  if (done) {
    // For now just print collected answers as JSON as a placeholder
    return (
      <div>
        <h1>Illinois Court Legal Chatbot</h1>
        <p>Thank you. Here are your triage answers:</p>
        <pre>{JSON.stringify(answers, null, 2)}</pre>
        <p>
          (Next: backend/AI will use your answers to route you to the right info/referral.)
        </p>
      </div>
    );
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
