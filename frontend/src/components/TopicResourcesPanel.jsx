import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCopy, FaExternalLinkAlt } from "react-icons/fa";

const TOPIC_KEYS = [
  "housing",
  "education",
  "child_support",
  "divorce",
  "custody",
  "general",
];

/** Official / widely used Illinois self-help links (general information). */
const FORM_LINKS_BY_TOPIC = {
  housing: [
    {
      labelKey: "resources.forms.ilaHousing",
      url: "https://www.illinoislegalaid.org/legal-information/housing",
    },
    {
      labelKey: "resources.forms.courts",
      url: "https://www.illinoiscourts.gov",
    },
  ],
  education: [
    {
      labelKey: "resources.forms.ilaEducation",
      url: "https://www.illinoislegalaid.org/legal-information/school-education",
    },
    {
      labelKey: "resources.forms.isbe",
      url: "https://www.isbe.net/",
    },
  ],
  child_support: [
    {
      labelKey: "resources.forms.ilaFamily",
      url: "https://www.illinoislegalaid.org/legal-information/family-safety",
    },
    {
      labelKey: "resources.forms.dcfs",
      url: "https://dcfs.illinois.gov/",
    },
  ],
  divorce: [
    {
      labelKey: "resources.forms.ilaFamily",
      url: "https://www.illinoislegalaid.org/legal-information/family-safety",
    },
    {
      labelKey: "resources.forms.courts",
      url: "https://www.illinoiscourts.gov",
    },
  ],
  custody: [
    {
      labelKey: "resources.forms.ilaFamily",
      url: "https://www.illinoislegalaid.org/legal-information/family-safety",
    },
    {
      labelKey: "resources.forms.courts",
      url: "https://www.illinoiscourts.gov",
    },
  ],
  general: [
    {
      labelKey: "resources.forms.ilaHome",
      url: "https://www.illinoislegalaid.org",
    },
    {
      labelKey: "resources.forms.courts",
      url: "https://www.illinoiscourts.gov",
    },
  ],
};

function normalizeTopic(topic) {
  const t = String(topic || "").trim();
  return TOPIC_KEYS.includes(t) ? t : "general";
}

export default function TopicResourcesPanel({ topic }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const key = normalizeTopic(topic);
  const nextStepsRaw = t(`resources.nextSteps.${key}`);
  const letterTemplate = t(`resources.letterTemplate.${key}`);
  const links = FORM_LINKS_BY_TOPIC[key] || FORM_LINKS_BY_TOPIC.general;

  const steps = String(nextStepsRaw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letterTemplate);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (steps.length === 0 && !letterTemplate) return null;

  return (
    <div className="topic-resources-panel">
      <h4 className="topic-resources-title">{t("resources.panelTitle")}</h4>
      <p className="topic-resources-disclaimer">{t("resources.panelDisclaimer")}</p>

      {steps.length > 0 && (
        <div className="topic-resources-section">
          <h5 className="topic-resources-sub">{t("resources.nextStepsTitle")}</h5>
          <ol className="topic-resources-steps">
            {steps.map((line) => (
              <li key={line}>{line.replace(/^\d+[\).\s]+/, "")}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="topic-resources-section">
        <h5 className="topic-resources-sub">{t("resources.formsTitle")}</h5>
        <ul className="topic-resources-links">
          {links.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {t(item.labelKey)} <FaExternalLinkAlt size={12} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>

      {letterTemplate && letterTemplate.length > 10 && (
        <div className="topic-resources-section">
          <h5 className="topic-resources-sub">{t("resources.letterTitle")}</h5>
          <p className="topic-resources-letter-hint">{t("resources.letterHint")}</p>
          <pre className="topic-resources-letter">{letterTemplate}</pre>
          <button type="button" className="btn btn-copy-template" onClick={handleCopy}>
            <FaCopy /> {copied ? t("resources.copied") : t("resources.copyLetter")}
          </button>
        </div>
      )}
    </div>
  );
}
