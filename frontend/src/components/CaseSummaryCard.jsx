import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

const URGENCY_CONFIG = {
  high: { label: "High Urgency", className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  medium: { label: "Medium Urgency", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  low: { label: "Lower Urgency", className: "bg-muted text-muted-foreground border-border", icon: CheckCircle },
};

export default function CaseSummaryCard({ issue, urgency, risk, nextSteps, topic }) {
  const urgencyKey = String(urgency?.band || urgency || "low").toLowerCase();
  const urg = URGENCY_CONFIG[urgencyKey] || URGENCY_CONFIG.low;
  const UrgIcon = urg.icon;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold">Case Summary</CardTitle>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium shrink-0 ${urg.className}`}
          >
            <UrgIcon className="w-3.5 h-3.5" aria-hidden />
            {urg.label}
          </div>
        </div>
        {topic && (
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {String(topic).replace(/_/g, " ")}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {issue && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Issue
            </p>
            <p className="text-sm text-foreground leading-relaxed">{issue}</p>
          </div>
        )}

        {risk !== undefined && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Risk Score
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-foreground transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, Number(risk)))}%` }}
                  role="progressbar"
                  aria-valuenow={Number(risk)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">{risk}/100</span>
            </div>
          </div>
        )}

        {nextSteps && nextSteps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Next Steps
            </p>
            <ol className="space-y-2">
              {nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
