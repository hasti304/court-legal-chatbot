import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Phone, ExternalLink, FileText, Info } from "lucide-react";

export default function ReferralCard({ referral }) {
  const ref = referral;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{ref.name}</CardTitle>
          {ref.is_nfp && (
            <Badge variant="secondary" className="shrink-0 text-[10px] leading-none">
              Partner
            </Badge>
          )}
        </div>
        {ref.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{ref.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        {ref.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
            <span className="text-sm font-medium text-foreground">{ref.phone}</span>
          </div>
        )}

        {ref.special_education_helpline && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
            <span className="text-xs text-muted-foreground">Special Ed Helpline:</span>
            <span className="text-sm font-medium text-foreground">{ref.special_education_helpline}</span>
          </div>
        )}

        {ref.intake_instructions && (
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-muted-foreground leading-relaxed">{ref.intake_instructions}</p>
          </div>
        )}

        {ref.intake_form && (
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
            <a
              href={ref.intake_form}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground underline underline-offset-2 hover:no-underline font-medium"
            >
              Online Intake Form
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 gap-2 flex-wrap">
        {ref.is_nfp && (
          <Button
            size="sm"
            className="flex-1 font-bold"
            style={{
              background: "#C9A84C",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "50px",
              padding: "12px 24px",
            }}
            onClick={() =>
              window.open(
                ref.intake_form || "https://www.chicagoadvocatelegal.com/contact.html",
                "_blank"
              )
            }
          >
            Connect with CAL
          </Button>
        )}
        {ref.url && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            style={{
              background: "#ffffff",
              border: "1px solid #1B2A4A",
              color: "#1B2A4A",
              borderRadius: "50px",
              padding: "12px 24px",
            }}
            onClick={() => window.open(ref.url, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            Visit Website
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
