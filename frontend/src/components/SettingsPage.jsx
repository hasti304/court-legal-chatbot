import React, { useState } from "react";
import { Eye, EyeOff, User, Lock, Sliders, AlertTriangle } from "lucide-react";
import { setAppLanguage, getNormalizedLanguage } from "../i18n";

const GOLD = "#C9A84C";
const PREF_LANG_KEY = "cal_pref_language_v1";
const PREF_NOTIF_KEY = "cal_pref_notifications_v1";
const INTAKE_PROFILE_KEY = "cal_intake_profile_v1";

function loadNotifPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_NOTIF_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveNotifPrefs(prefs) {
  try {
    localStorage.setItem(PREF_NOTIF_KEY, JSON.stringify(prefs));
  } catch {}
}

function FieldLabel({ children }) {
  return (
    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, onBlur, readOnly, placeholder, type = "text", rightIcon }) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          background: readOnly ? "#F9FAFB" : "#F4F5F7",
          border: "1px solid #E5E7EB",
          borderRadius: 8, padding: "10px 12px",
          paddingRight: rightIcon ? 40 : 12,
          fontSize: 14,
          color: readOnly ? "#9CA3AF" : "#1A1A1A",
          outline: "none",
          transition: "border-color 0.15s",
          cursor: readOnly ? "default" : "text",
        }}
        onFocus={(e) => { if (!readOnly) e.target.style.borderColor = GOLD; }}
        onBlur={(e) => {
          e.target.style.borderColor = "#E5E7EB";
          if (onBlur) onBlur(e);
        }}
      />
      {rightIcon && (
        <div style={{
          position: "absolute", right: 12, top: "50%",
          transform: "translateY(-50%)", cursor: "pointer",
        }}>
          {rightIcon}
        </div>
      )}
    </div>
  );
}

function GoldButton({ onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#E5E7EB" : GOLD,
        color: disabled ? "#9CA3AF" : "#1A1A1A",
        fontWeight: 700, borderRadius: 8, padding: "10px 24px",
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14, transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}
    >
      <span style={{ fontSize: 14, color: "#374151" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: "none",
          background: checked ? GOLD : "#D1D5DB",
          position: "relative", cursor: "pointer",
          transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute", top: 3,
            left: checked ? 21 : 3,
            width: 18, height: 18, borderRadius: "50%",
            background: "#FFFFFF",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 24, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        {Icon && <Icon className="w-4 h-4" style={{ color: GOLD }} />}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage({
  firstName, lastName, email, phone,
  onFirstNameChange, onLastNameChange, onPhoneChange,
}) {
  // Profile section
  const [profileFirst, setProfileFirst] = useState(firstName || "");
  const [profileLast, setProfileLast] = useState(lastName || "");
  const [profilePhone, setProfilePhone] = useState(phone || "");
  const [profileStatus, setProfileStatus] = useState("");

  // Password section
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwStatus, setPwStatus] = useState("");
  const [newPwTouched, setNewPwTouched] = useState(false);
  const [confirmPwTouched, setConfirmPwTouched] = useState(false);

  // Preferences section
  const [lang, setLang] = useState(() => {
    return localStorage.getItem(PREF_LANG_KEY) || getNormalizedLanguage() || "en";
  });
  const [notifPrefs, setNotifPrefs] = useState(() => loadNotifPrefs());
  const [prefStatus, setPrefStatus] = useState("");

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Toast
  const [toast, setToast] = useState("");
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleSaveProfile = () => {
    try {
      const existing = JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}");
      localStorage.setItem(INTAKE_PROFILE_KEY, JSON.stringify({ ...existing, phone: profilePhone }));
    } catch {}
    if (onPhoneChange) onPhoneChange(profilePhone);
    showToast("Profile update coming soon");
  };

  const handleChangePassword = () => {
    setPwError("");
    setPwStatus("");
    if (!currentPw) { setPwError("Current password is required."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    showToast("Password change coming soon. To change your password, use Forgot Password on the login page.");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  const handleSavePreference = () => {
    localStorage.setItem(PREF_LANG_KEY, lang);
    setAppLanguage(lang);
    setPrefStatus("success");
    setTimeout(() => setPrefStatus(""), 2500);
  };

  const handleNotifChange = (key, value) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
  };

  const newPwInlineError = newPwTouched && newPw.length > 0 && newPw.length < 8
    ? "Password must be at least 8 characters."
    : "";
  const confirmPwInlineError = confirmPwTouched && confirmPw.length > 0 && newPw !== confirmPw
    ? "Passwords do not match."
    : "";

  return (
    <div style={{ background: "#F4F5F7", minHeight: "100%", padding: "32px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A1A", marginBottom: 28 }}>
          Settings
        </h1>

        {/* Profile */}
        <SectionCard icon={User} title="Profile">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>First name</FieldLabel>
              <TextInput
                value={profileFirst}
                readOnly
                placeholder="First name"
              />
            </div>
            <div>
              <FieldLabel>Last name</FieldLabel>
              <TextInput
                value={profileLast}
                readOnly
                placeholder="Last name"
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Email</FieldLabel>
            <TextInput value={email || ""} readOnly />
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              Email cannot be changed
            </p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Phone number</FieldLabel>
            <TextInput
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="(555) 000-0000"
              type="tel"
            />
          </div>
          <GoldButton onClick={handleSaveProfile}>Save changes</GoldButton>
        </SectionCard>

        {/* Password */}
        <SectionCard icon={Lock} title="Change Password">
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Current password</FieldLabel>
            <TextInput
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6B7280" }}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>New password</FieldLabel>
            <TextInput
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onBlur={() => setNewPwTouched(true)}
              placeholder="New password (min 8 characters)"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6B7280" }}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {newPwTouched && !newPwInlineError && newPw.length >= 8 && (
              <p style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>✓ Password length OK</p>
            )}
            {newPwInlineError && (
              <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{newPwInlineError}</p>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput
              type={showConfirm ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onBlur={() => setConfirmPwTouched(true)}
              placeholder="Confirm new password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6B7280" }}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {confirmPwInlineError && (
              <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{confirmPwInlineError}</p>
            )}
          </div>
          {pwError && (
            <p style={{ fontSize: 14, color: "#DC2626", marginBottom: 12 }}>{pwError}</p>
          )}
          {pwStatus === "success" && (
            <p style={{ fontSize: 14, color: "#16a34a", marginBottom: 12 }}>
              Password changed successfully
            </p>
          )}
          <GoldButton
            onClick={handleChangePassword}
            disabled={!currentPw || newPw.length < 8 || newPw !== confirmPw}
          >
            Change Password
          </GoldButton>
        </SectionCard>

        {/* Preferences */}
        <SectionCard icon={Sliders} title="Preferences">
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Default language</FieldLabel>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                width: "100%", background: "#F4F5F7", border: "1px solid #E5E7EB",
                borderRadius: 8, padding: "10px 12px", fontSize: 14,
                color: "#1A1A1A", outline: "none", cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = GOLD)}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            >
              <option value="en">English</option>
              <option value="es">Spanish / Español</option>
            </select>
            <div style={{ marginTop: 12 }}>
              <GoldButton onClick={handleSavePreference}>Save preference</GoldButton>
              {prefStatus === "success" && (
                <span style={{ fontSize: 13, color: "#16a34a", marginLeft: 12 }}>Saved!</span>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
            <FieldLabel>Email notifications</FieldLabel>
            <Toggle
              checked={!!notifPrefs.caseStatus}
              onChange={(v) => handleNotifChange("caseStatus", v)}
              label="Email me when my case status changes"
            />
            <Toggle
              checked={!!notifPrefs.deadlines}
              onChange={(v) => handleNotifChange("deadlines", v)}
              label="Email me important legal deadlines"
            />
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
              Email notifications require a valid email address on your account.
            </p>
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <div style={{
          background: "#FFFFFF", borderRadius: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 24, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#DC2626" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", margin: 0 }}>
              Delete Account
            </h2>
          </div>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#DC2626", fontSize: 14, fontWeight: 600,
              textDecoration: "underline", padding: 0,
            }}
          >
            Delete my account
          </button>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div style={{
            background: "#FFFFFF", borderRadius: 12, padding: 32,
            maxWidth: 440, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", marginBottom: 10 }}>
              Are you sure?
            </h3>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <p style={{ fontSize: 14, color: "#374151", marginBottom: 24, lineHeight: 1.6 }}>
              Account deletion coming soon. Please contact{" "}
              <a
                href="mailto:intake@chicagoadvocatelegal.com"
                style={{ color: GOLD, fontWeight: 600 }}
              >
                intake@chicagoadvocatelegal.com
              </a>{" "}
              to request deletion.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1, background: "#FFFFFF", border: `1px solid ${GOLD}`,
                  color: GOLD, fontWeight: 700, borderRadius: 8,
                  padding: "10px 16px", cursor: "pointer", fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1, background: "#DC2626", border: "none",
                  color: "#FFFFFF", fontWeight: 700, borderRadius: 8,
                  padding: "10px 16px", cursor: "pointer", fontSize: 14,
                }}
              >
                Yes, delete my account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A1A", color: "#FFFFFF", borderRadius: 8,
          padding: "12px 24px", fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 2000,
          maxWidth: "90vw", textAlign: "center",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
