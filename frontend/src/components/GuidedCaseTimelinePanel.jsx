import React, { useMemo, useState } from "react";

const TIMELINES_BY_TOPIC = {
  housing: [
    {
      id: "intake",
      title: "Intake and fact gathering",
      eta: "1-3 days",
      checklist: [
        "Collect notices, lease documents, and payment records",
        "Write a short timeline of what happened",
      ],
    },
    {
      id: "filing",
      title: "Filing or response preparation",
      eta: "3-14 days",
      checklist: [
        "Check filing/response deadlines on your notice",
        "Prepare draft response or filing packet",
      ],
    },
    {
      id: "hearing",
      title: "Hearing readiness",
      eta: "1-6 weeks",
      checklist: [
        "Organize evidence and witness notes",
        "Confirm court date, time, and courtroom",
      ],
    },
    {
      id: "outcome",
      title: "Outcome and next orders",
      eta: "Same day to 2 weeks",
      checklist: ["Document court outcome", "Track any compliance deadlines"],
    },
    {
      id: "followup",
      title: "Follow-up support",
      eta: "1-8 weeks",
      checklist: ["Connect with referrals", "Set reminders for deadlines"],
    },
  ],
  education: [
    {
      id: "intake",
      title: "Issue intake",
      eta: "1-3 days",
      checklist: ["Gather school records", "Summarize concern in writing"],
    },
    {
      id: "filing",
      title: "School/case submissions",
      eta: "3-21 days",
      checklist: ["Submit request/complaint", "Save submission confirmation"],
    },
    {
      id: "hearing",
      title: "Meeting or hearing prep",
      eta: "1-8 weeks",
      checklist: ["Prepare key points", "Bring supporting records"],
    },
    {
      id: "outcome",
      title: "Decision stage",
      eta: "Same day to 4 weeks",
      checklist: ["Record decision details", "Track required actions"],
    },
    {
      id: "followup",
      title: "Follow-up and escalation",
      eta: "1-12 weeks",
      checklist: ["Monitor compliance", "Escalate if deadlines are missed"],
    },
  ],
  child_support: [
    {
      id: "intake",
      title: "Intake and financial records",
      eta: "1-5 days",
      checklist: ["Gather income/payment records", "Collect prior court orders"],
    },
    {
      id: "filing",
      title: "Petition/response filing",
      eta: "1-3 weeks",
      checklist: ["Prepare filing packet", "Confirm service requirements"],
    },
    {
      id: "hearing",
      title: "Hearing preparation",
      eta: "2-10 weeks",
      checklist: ["Organize evidence", "Prepare key timeline facts"],
    },
    {
      id: "outcome",
      title: "Order and payment terms",
      eta: "Same day to 3 weeks",
      checklist: ["Review support order", "Track payment schedule"],
    },
    {
      id: "followup",
      title: "Enforcement or modification follow-up",
      eta: "2-12 weeks",
      checklist: ["Track missed payments", "Document changes in circumstances"],
    },
  ],
  divorce: [
    {
      id: "intake",
      title: "Case intake",
      eta: "1-7 days",
      checklist: ["Gather marriage/asset records", "Document immediate concerns"],
    },
    {
      id: "filing",
      title: "Petition and service phase",
      eta: "1-4 weeks",
      checklist: ["Prepare petition", "Confirm service completion"],
    },
    {
      id: "hearing",
      title: "Court conference/hearing prep",
      eta: "2-12 weeks",
      checklist: ["Prepare key facts", "Organize supporting documents"],
    },
    {
      id: "outcome",
      title: "Orders or settlement",
      eta: "1 day to several weeks",
      checklist: ["Review terms carefully", "Track compliance deadlines"],
    },
    {
      id: "followup",
      title: "Post-order follow-up",
      eta: "2-12 weeks",
      checklist: ["Record all completed actions", "Plan next filing if needed"],
    },
  ],
  custody: [
    {
      id: "intake",
      title: "Parenting issue intake",
      eta: "1-5 days",
      checklist: ["Collect prior parenting orders", "Write child-related timeline"],
    },
    {
      id: "filing",
      title: "Petition/response stage",
      eta: "1-4 weeks",
      checklist: ["Prepare documents", "Confirm filing and service steps"],
    },
    {
      id: "hearing",
      title: "Hearing preparation",
      eta: "2-12 weeks",
      checklist: ["Prepare child-focused facts", "Bring records and communications"],
    },
    {
      id: "outcome",
      title: "Parenting order outcome",
      eta: "Same day to 4 weeks",
      checklist: ["Review parenting terms", "Track handoff/schedule requirements"],
    },
    {
      id: "followup",
      title: "Compliance follow-up",
      eta: "2-12 weeks",
      checklist: ["Document violations or changes", "Plan modification/enforcement if needed"],
    },
  ],
  general: [
    {
      id: "intake",
      title: "Intake and issue outline",
      eta: "1-3 days",
      checklist: ["Gather records", "Write a short case summary"],
    },
    {
      id: "filing",
      title: "Document preparation",
      eta: "3-14 days",
      checklist: ["Identify needed forms", "Prepare submission drafts"],
    },
    {
      id: "hearing",
      title: "Hearing readiness",
      eta: "1-8 weeks",
      checklist: ["Organize evidence", "Confirm hearing logistics"],
    },
    {
      id: "outcome",
      title: "Outcome stage",
      eta: "Same day to 4 weeks",
      checklist: ["Capture result details", "Track next deadlines"],
    },
    {
      id: "followup",
      title: "Follow-up actions",
      eta: "1-12 weeks",
      checklist: ["Complete post-order steps", "Check deadlines regularly"],
    },
  ],
};

export default function GuidedCaseTimelinePanel({ topic = "general", onTrackEvent }) {
  const steps = useMemo(() => TIMELINES_BY_TOPIC[String(topic || "").trim()] || TIMELINES_BY_TOPIC.general, [topic]);
  const [expandedStep, setExpandedStep] = useState(steps[0]?.id || "intake");
  const [checkedMap, setCheckedMap] = useState({});

  const toggleStep = (stepId) => {
    const next = expandedStep === stepId ? "" : stepId;
    setExpandedStep(next);
    if (next && typeof onTrackEvent === "function") {
      onTrackEvent("timeline_step_viewed", `${topic}:${next}`);
    }
  };

  const toggleChecklist = (stepId, item) => {
    const key = `${stepId}::${item}`;
    setCheckedMap((prev) => ({ ...prev, [key]: !prev[key] }));
    if (typeof onTrackEvent === "function") {
      onTrackEvent("timeline_checklist_toggled", `${topic}:${stepId}:${item}`.slice(0, 200));
    }
  };

  return (
    <div className="guided-timeline-panel">
      <h4 className="guided-timeline-title">Guided case timeline</h4>
      <p className="guided-timeline-disclaimer">
        Informational only — this is not legal advice. Steps and time ranges vary by court and case facts.
      </p>
      <div className="guided-timeline-steps">
        {steps.map((step, idx) => {
          const isOpen = expandedStep === step.id;
          return (
            <div key={step.id} className={`guided-timeline-step${isOpen ? " open" : ""}`}>
              <button
                type="button"
                className="guided-timeline-step-header"
                onClick={() => toggleStep(step.id)}
                aria-expanded={isOpen}
              >
                <span className="guided-timeline-step-index">{idx + 1}</span>
                <span className="guided-timeline-step-main">
                  <span className="guided-timeline-step-title">{step.title}</span>
                  <span className="guided-timeline-step-eta">Estimated time: {step.eta}</span>
                </span>
              </button>
              {isOpen ? (
                <ul className="guided-timeline-checklist">
                  {step.checklist.map((item) => {
                    const key = `${step.id}::${item}`;
                    return (
                      <li key={key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!checkedMap[key]}
                            onChange={() => toggleChecklist(step.id, item)}
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

