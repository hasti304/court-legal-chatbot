import React from "react";
import { useTranslation } from "react-i18next";

const TERM_IDS = [
  "legal_information",
  "legal_advice",
  "pro_se",
  "plaintiff",
  "defendant",
  "eviction",
  "order",
];

export default function LegalGlossary({ className = "" }) {
  const { t } = useTranslation();

  return (
    <details className={`legal-glossary ${className}`.trim()}>
      <summary className="legal-glossary-summary">{t("glossary.title")}</summary>
      <p className="legal-glossary-intro">{t("glossary.intro")}</p>
      <dl className="legal-glossary-list">
        {TERM_IDS.map((id) => (
          <div key={id} className="legal-glossary-row">
            <dt>{t(`glossary.terms.${id}.term`)}</dt>
            <dd>{t(`glossary.terms.${id}.def`)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
