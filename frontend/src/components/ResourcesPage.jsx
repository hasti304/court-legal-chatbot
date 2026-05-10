import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, Phone, ExternalLink, MapPin, Bookmark, Search } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiBase";
import { useTranslation } from "react-i18next";
import { printReferralsSummary } from "../utils/printReferrals";

const GOLD = "#C9A84C";
const BOOKMARKS_KEY = "cal_resource_bookmarks_v1";

const FILTER_LABELS = [
  { label: "All", value: "" },
  { label: "Housing", value: "housing" },
  { label: "Divorce", value: "divorce" },
  { label: "Child Custody", value: "custody" },
  { label: "Child Support", value: "child_support" },
  { label: "Education", value: "education" },
  { label: "General Legal", value: "general" },
];

function getBookmarks(userEmail) {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "{}");
    return Array.isArray(all[userEmail]) ? all[userEmail] : [];
  } catch {
    return [];
  }
}

function toggleBookmark(userEmail, resourceId) {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "{}");
    const existing = Array.isArray(all[userEmail]) ? all[userEmail] : [];
    if (existing.includes(resourceId)) {
      all[userEmail] = existing.filter((id) => id !== resourceId);
    } else {
      all[userEmail] = [...existing, resourceId];
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    return all[userEmail];
  } catch {
    return [];
  }
}

function IssueBadge({ label }) {
  if (!label) return null;
  return (
    <span style={{
      background: GOLD, color: "#1A1A1A", borderRadius: 4,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function ResourceCardItem({ resource, issueLabel, userEmail, isMatched }) {
  const [bookmarks, setBookmarks] = useState(() => getBookmarks(userEmail || ""));
  const resourceId = isMatched
    ? String(resource.name || resource.id || "")
    : String(resource.id || "");
  const isBookmarked = bookmarks.includes(resourceId);

  const name = isMatched ? (resource.name || resource.title || "") : (resource.title || "");
  const description = resource.description || "";
  const phone = resource.phone || "";
  const url = isMatched ? (resource.url || "") : (resource.website_url || "");
  const address = isMatched ? (resource.address || "") : (
    [resource.address_line1, resource.address_line2, resource.postal_code].filter(Boolean).join(", ")
  );

  const handleBookmark = () => {
    const updated = toggleBookmark(userEmail || "", resourceId);
    setBookmarks(updated);
  };

  const directionsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : null;

  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      padding: 20, marginBottom: 14, position: "relative",
    }}>
      {/* Bookmark */}
      <button
        type="button"
        onClick={handleBookmark}
        aria-label={isBookmarked ? "Remove bookmark" : "Save bookmark"}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "none", border: "none", cursor: "pointer", padding: 4,
          color: isBookmarked ? GOLD : "#9CA3AF",
        }}
      >
        <Bookmark className="w-4 h-4" fill={isBookmarked ? GOLD : "none"} />
      </button>

      <div style={{ paddingRight: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "#1A1A1A", fontSize: 15 }}>{name}</span>
          {issueLabel && <IssueBadge label={issueLabel} />}
        </div>

        {description && (
          <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        {phone && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{phone}</span>
          </div>
        )}

        {directionsUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: GOLD, textDecoration: "none", fontWeight: 500 }}
            >
              Get Directions
            </a>
          </div>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 8,
              padding: "6px 14px", fontSize: 13, fontWeight: 600,
              textDecoration: "none", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visit Website
          </a>
        )}
      </div>
    </div>
  );
}

function FilterBar({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20 }}>
      {FILTER_LABELS.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          style={{
            padding: "6px 14px", borderRadius: 20, border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: active === value ? 700 : 500,
            color: active === value ? "#1A1A1A" : "#6B7280",
            background: "transparent",
            borderBottom: active === value ? `2px solid ${GOLD}` : "2px solid transparent",
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function matchesFilter(filter, issueType) {
  if (!filter) return true;
  const v = String(issueType || "").toLowerCase();
  return v === filter || v.includes(filter);
}

function resourceMatchesCaseType(resource, filter) {
  if (!filter) return true;
  const types = Array.isArray(resource.case_types)
    ? resource.case_types.map((t) => String(t).toLowerCase())
    : [];
  const cat = String(resource.category || "").toLowerCase();
  if (filter === "general") {
    return !types.some((t) =>
      ["housing", "divorce", "custody", "child_support", "education"].some((k) => t.includes(k))
    ) || types.includes("general") || cat.includes("general");
  }
  return types.some((t) => t.includes(filter)) || cat.includes(filter);
}

export default function ResourcesPage({ messages, conversationState, userEmail, savedReferrals = [], onStartConsultation }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("matched");
  const [matchedFilter, setMatchedFilter] = useState("");
  const [allFilter, setAllFilter] = useState("");
  const [allResources, setAllResources] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Collect unique referrals from all messages and savedReferrals
  const matchedReferrals = useMemo(() => {
    const seen = new Set();
    const result = [];
    const addRef = (ref) => {
      const key = String(ref.name || ref.id || JSON.stringify(ref));
      if (!seen.has(key)) { seen.add(key); result.push(ref); }
    };
    for (const msg of (messages || [])) { for (const ref of (msg.referrals || [])) addRef(ref); }
    for (const ref of (savedReferrals || [])) addRef(ref);
    console.log("[ResourcesPage] userEmail:", userEmail);
    console.log("[ResourcesPage] savedReferrals prop:", savedReferrals);
    console.log("[ResourcesPage] referrals from messages:", (messages || []).flatMap((m) => m.referrals || []));
    console.log("[ResourcesPage] computed matchedReferrals:", result);
    return result;
  }, [messages, savedReferrals]);

  const topic = conversationState?.topic || conversationState?.category || "";
  const zip = conversationState?.zip_code || "";

  const topicLabel = useMemo(() => {
    if (!topic) return "";
    const map = {
      housing: "Housing", divorce: "Divorce", custody: "Child Custody",
      child_support: "Child Support", education: "Education", general: "General Legal",
    };
    return map[String(topic).toLowerCase()] || "";
  }, [topic]);

  // Fetch all resources when that tab is active
  useEffect(() => {
    if (activeTab !== "all" || allResources.length > 0) return;
    setAllLoading(true);
    setAllError("");
    fetch(`${getApiBaseUrl()}/resources?state=IL&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        setAllResources(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setAllError("Unable to load resources. Please try again.");
      })
      .finally(() => setAllLoading(false));
  }, [activeTab]);

  const filteredMatched = useMemo(
    () => matchedReferrals.filter((r) => matchesFilter(matchedFilter, topic)),
    [matchedReferrals, matchedFilter, topic]
  );

  const filteredAll = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allResources.filter((r) => {
      if (!resourceMatchesCaseType(r, allFilter)) return false;
      if (q) {
        const name = String(r.title || "").toLowerCase();
        const desc = String(r.description || "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      }
      return true;
    });
  }, [allResources, allFilter, searchQuery]);

  const tabStyle = (tab) => ({
    padding: "10px 20px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: activeTab === tab ? "#1A1A1A" : "#6B7280",
    borderBottom: activeTab === tab ? `2px solid ${GOLD}` : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div style={{ background: "#F4F5F7", minHeight: "100%", padding: "32px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
          Legal Resources
        </h1>
        <p style={{ color: "#6B7280", marginBottom: 24, fontSize: 14 }}>
          Resources matched to your situation and additional Illinois legal services.
        </p>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #E5E7EB", marginBottom: 24, display: "flex" }}>
          <button type="button" style={tabStyle("matched")} onClick={() => setActiveTab("matched")}>
            My Matched Resources
          </button>
          <button type="button" style={tabStyle("all")} onClick={() => setActiveTab("all")}>
            All Resources
          </button>
        </div>

        {activeTab === "matched" && (
          <div>
            {matchedReferrals.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => printReferralsSummary({ referrals: filteredMatched, topicLabel, zipCode: zip, t })}
                  style={{
                    background: "transparent", border: `1px solid ${GOLD}`,
                    color: GOLD, fontWeight: 700, borderRadius: 8,
                    padding: "7px 16px", cursor: "pointer", fontSize: 13,
                  }}
                >
                  Print my resource list
                </button>
              </div>
            )}
            <FilterBar active={matchedFilter} onChange={setMatchedFilter} />

            {matchedReferrals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 24px" }}>
                <BookOpen style={{
                  color: GOLD, width: 44, height: 44,
                  margin: "0 auto 14px", display: "block",
                }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 8 }}>
                  No matched resources yet
                </h3>
                <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>
                  Complete your legal consultation to see resources matched to your situation.
                </p>
                <button
                  type="button"
                  onClick={onStartConsultation}
                  style={{
                    background: GOLD, color: "#1A1A1A", fontWeight: 700,
                    borderRadius: 8, padding: "10px 24px",
                    border: "none", cursor: "pointer",
                    fontSize: 14, display: "inline-block",
                  }}
                >
                  Start Consultation
                </button>
              </div>
            ) : (
              <>
                {filteredMatched.length === 0 ? (
                  <p style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
                    No resources match this filter.
                  </p>
                ) : (
                  filteredMatched.map((ref, i) => (
                    <ResourceCardItem
                      key={String(ref.name || i)}
                      resource={ref}
                      issueLabel={topicLabel}
                      userEmail={userEmail}
                      isMatched
                    />
                  ))
                )}

                {zip && (
                  <div style={{
                    background: "#FFFFFF", borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 20, marginTop: 8,
                  }}>
                    <p style={{ fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 }}>
                      Searching near ZIP code: <strong>{zip}</strong>
                    </p>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>
                      View the map in the Legal Consultation tab to see directions to each resource.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "all" && (
          <div>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search
                style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  color: "#9CA3AF", width: 16, height: 16,
                }}
              />
              <input
                type="text"
                placeholder="Search resources…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#F4F5F7", border: "1px solid #E5E7EB",
                  borderRadius: 8, padding: "10px 12px 10px 36px",
                  fontSize: 14, color: "#1A1A1A", outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = GOLD)}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            <FilterBar active={allFilter} onChange={setAllFilter} />

            {allLoading && (
              <p style={{ color: "#6B7280", textAlign: "center", padding: "32px 0", fontSize: 14 }}>
                Loading resources…
              </p>
            )}
            {allError && (
              <p style={{ color: "#DC2626", textAlign: "center", padding: "16px 0", fontSize: 14 }}>
                {allError}
              </p>
            )}

            {!allLoading && !allError && filteredAll.length === 0 && (
              <div style={{ textAlign: "center", padding: "56px 24px" }}>
                <BookOpen style={{
                  color: GOLD, width: 44, height: 44,
                  margin: "0 auto 14px", display: "block",
                }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 6 }}>
                  No resources found
                </h3>
                <p style={{ color: "#6B7280", fontSize: 14 }}>
                  Try a different search or filter
                </p>
              </div>
            )}

            {!allLoading && !allError && filteredAll.map((res) => {
              const caseTypes = Array.isArray(res.case_types) ? res.case_types : [];
              const badgeLabel = caseTypes.length > 0
                ? (FILTER_LABELS.find((f) => f.value && caseTypes.some((t) =>
                    String(t).toLowerCase().includes(f.value)))?.label || "")
                : "";
              return (
                <ResourceCardItem
                  key={res.id}
                  resource={res}
                  issueLabel={badgeLabel}
                  userEmail={userEmail}
                  isMatched={false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
