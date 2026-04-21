import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

try:
    from .intake_service import log_intake_event
except ImportError:
    from services.intake_service import log_intake_event  # type: ignore


_JSON_CACHE: dict[str, dict] = {}

# Illinois placeholder when the user skips ZIP — still shows correct topic referrals.
STATEWIDE_PLACEHOLDER_ZIP = "62701"

# If the user has no digits but clearly cannot provide a ZIP, treat like Skip (statewide).
_ZIP_WIDE_FALLBACK_PHRASES = (
    "cannot find my",
    "cant find my",
    "can't find my",
    "could not find my",
    "couldn't find my",
    "don't know my zip",
    "dont know my zip",
    "don't have a zip",
    "dont have a zip",
    "no zip code",
    "lost my address",
    "don't know my address",
    "dont know my address",
    "forgot my zip",
    "don't remember my zip",
    "dont remember my zip",
    "don't know what my zip",
    "dont know what my zip",
    "i don't have a zip",
    "i dont have a zip",
    "don't have my zip",
    "dont have my zip",
)

_ZIP_SKIP_NORMALIZED = frozenset(
    {
        "skip",
        "unknown",
        "not sure",
        "dont know",
        "don't know",
        "i dont know",
        "i don't know",
        "no zip",
        "no zip code",
        "statewide",
        "anywhere",
        "anywhere in illinois",
        "n/a",
        "na",
        "none",
        "prefer not to say",
        "prefer not",
        "saltar",
        "omitir",
        "no lo se",
        "no lo sé",
        "no se",
        "no sé",
        "estatal",
    }
)


def _normalize_zip_step_input(message: str) -> str:
    s = (message or "").strip().lower()
    return s.replace("’", "'").replace("`", "'")


def resolve_five_digit_zip(message: str) -> Tuple[Optional[str], bool]:
    """
    Parse ZIP step input: exact 5 digits, 5 digits embedded in a sentence, or explicit skip.
    Returns (zip_or_none, used_skip_placeholder).
    """
    s = _normalize_zip_step_input(message)
    if not s:
        return None, False
    s_plain = s.replace(".", "").replace(",", "").strip()
    if s in _ZIP_SKIP_NORMALIZED or s_plain in _ZIP_SKIP_NORMALIZED:
        return STATEWIDE_PLACEHOLDER_ZIP, True
    m = re.search(r"(?<!\d)(\d{5})(?!\d)", s)
    if m:
        return m.group(1), False
    if s.isdigit() and len(s) == 5:
        return s, False
    if any(phrase in s for phrase in _ZIP_WIDE_FALLBACK_PHRASES):
        return STATEWIDE_PLACEHOLDER_ZIP, True
    return None, False


def load_json_file(file_path: str):
    try:
        mtime = os.path.getmtime(file_path)
        cached = _JSON_CACHE.get(file_path)
        if cached and cached.get("mtime") == mtime:
            return cached["data"]

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            _JSON_CACHE[file_path] = {"mtime": mtime, "data": data}
            return data
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Data file not found: {file_path}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in file: {file_path}")


def detect_crisis_keywords(message: str) -> bool:
    crisis_keywords = [
        "abuse", "abused", "abusing",
        "hurt", "hurting", "hitting", "hit me",
        "danger", "dangerous", "scared", "afraid",
        "threatened", "threatening", "threats",
        "kill", "suicide", "die", "dying",
        "weapon", "gun", "knife",
        "emergency", "urgent", "help me",
        "violence", "violent", "attack",
    ]
    message_lower = (message or "").lower()
    return any(keyword in message_lower for keyword in crisis_keywords)


def infer_topic_from_text(message: str) -> Optional[str]:
    text_value = (message or "").strip().lower().replace("’", "'").replace("`", "'")
    if not text_value:
        return None

    direct_topics = {
        "child support": "child_support",
        "child_support": "child_support",
        "education": "education",
        "housing": "housing",
        "divorce": "divorce",
        "custody": "custody",
    }
    if text_value in direct_topics:
        return direct_topics[text_value]

    address_zip_confusion = any(
        phrase in text_value
        for phrase in (
            "cannot find my",
            "cant find my",
            "can't find my",
            "could not find my",
            "couldn't find my",
            "don't know my zip",
            "dont know my zip",
            "don't have a zip",
            "dont have a zip",
            "no zip code",
            "lost my address",
        )
    )

    topic_keywords = {
        "housing": [
            "apartment", "landlord", "tenant", "lease", "evict", "eviction",
            "lockout", "locked out", "can't get into my apartment", "cannot get into my apartment",
            "cant get into my apartment", "can't access my apartment", "cannot access my apartment",
            "rent", "utilities",
            "heat", "water", "mold", "shelter", "homeless", "housing",
            # Avoid bare "home"/"house" — phrases like "can't find my house" often mean address/ZIP,
            # not a housing-law issue; use whole-word matches instead.
            r"\bhome\b",
            r"\bhouse\b",
        ],
        "education": [
            "school", "student", "teacher", "iep", "504", "special education",
            "suspension", "expulsion", "bullying", "education", "classroom",
            "kindergarten", "district", "university", "college", "homework",
            "principal", "superintendent",
            "admission", "admissions", "enroll", "enrollment", "registrar",
        ],
        "child_support": [
            "child support", "support payment", "support order", "pay support",
            "owed support", "maintenance payment for child",
        ],
        "divorce": [
            "divorce", "separation", "separated", "spouse", "marriage", "married",
            "dissolution",
        ],
        "custody": [
            "custody", "parenting time", "visitation", "childcare decisions",
            "my child", "see my child", "parental responsibilities",
        ],
    }

    for topic, keywords in topic_keywords.items():
        if topic == "housing" and address_zip_confusion:
            continue
        for keyword in keywords:
            if keyword.startswith(r"\b"):
                if re.search(keyword, text_value):
                    return topic
            elif keyword in text_value:
                return topic
    return None


def infer_topic_conflict_with_selection(summary: str, selected_topic: Optional[str]) -> Optional[str]:
    """If the narrative clearly matches a different issue bucket than the selected topic, return that topic code."""
    inferred = infer_topic_from_text(summary)
    if not inferred or not selected_topic or inferred == selected_topic:
        return None
    return inferred


def try_redirect_topic_from_free_text(
    state: dict, message: str, intake_id: Optional[str]
) -> Optional[dict]:
    """
    If the user clearly describes a different issue area mid-triage, switch `topic`
    and restart the safety questions for that area (emergency_check).
    """
    step = state.get("step")
    if step not in ("emergency_check", "court_status", "income_check"):
        return None

    raw = (message or "").strip()
    if len(raw) < 3:
        return None

    norm = raw.lower()
    reserved = {
        "yes",
        "no",
        "unknown",
        "not sure",
        "not_sure",
        "restart",
        "continue",
        "connect",
        "i don't know",
        "i do not know",
    }
    if norm in reserved:
        return None

    inferred = infer_topic_from_text(raw)
    if not inferred:
        return None

    current = state.get("topic")
    if not current or inferred == current:
        return None

    # Avoid hijacking very short answers that might still be yes/no in another language shape
    if len(norm) <= 3:
        return None

    state["topic"] = inferred
    state["step"] = "emergency_check"
    for key in ("emergency", "in_court", "income_eligible", "income"):
        state.pop(key, None)

    log_intake_event(
        intake_id,
        "topic_redirected",
        f"{current}->{inferred}",
    )

    return {
        "response_key": "triage.topic.redirected",
        "response_params": {"topic": inferred, "previous_topic": current},
        "options": ["yes", "no", "unknown"],
        "conversation_state": state,
        "progress": get_step_progress(state.get("step")),
    }


def _load_referral_office_geo() -> Dict[str, Any]:
    try:
        from .config_service import REFERRAL_OFFICE_GEO_PATH
    except ImportError:
        from config_service import REFERRAL_OFFICE_GEO_PATH  # type: ignore
    if not os.path.isfile(REFERRAL_OFFICE_GEO_PATH):
        return {}
    try:
        data = load_json_file(REFERRAL_OFFICE_GEO_PATH)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _attach_office_coordinates(referrals: List[dict]) -> None:
    geo = _load_referral_office_geo()
    if not geo:
        return
    for ref in referrals:
        name = ref.get("name")
        if not name or not isinstance(name, str):
            continue
        entry = geo.get(name)
        if not entry or not isinstance(entry, dict):
            continue
        lat = entry.get("latitude")
        lng = entry.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            ref["latitude"] = float(lat)
            ref["longitude"] = float(lng)
        except (TypeError, ValueError):
            continue


def filter_referrals_for_income(referrals: List[dict], income_value: Optional[str]) -> List[dict]:
    filtered = list(referrals or [])
    if income_value == "no":
        filtered = [
            ref for ref in filtered
            if not any(
                keyword in ref.get("name", "").lower()
                for keyword in ["legal aid", "prairie state", "carpls"]
            )
        ]
        for ref in filtered:
            if "Chicago Advocate Legal, NFP" in ref.get("name", ""):
                ref["is_nfp"] = True
    return filtered


def get_referrals_for_topic(referral_map: dict, topic: str, level: int, income_value: Optional[str]) -> List[dict]:
    topic_bucket = referral_map.get(topic, {}) if isinstance(referral_map, dict) else {}

    candidate_levels = []
    try:
        candidate_levels.append(int(level))
    except Exception:
        candidate_levels.append(1)

    for fallback_level in [3, 2, 1]:
        if fallback_level not in candidate_levels:
            candidate_levels.append(fallback_level)

    for lvl in candidate_levels:
        referrals = topic_bucket.get(f"level_{lvl}", [])
        referrals = filter_referrals_for_income(referrals, income_value)
        if referrals:
            _attach_office_coordinates(referrals)
            return referrals

    for fallback_topic in ["housing", "education", "child_support", "divorce", "custody", "general"]:
        if fallback_topic == topic:
            continue
        fallback_bucket = referral_map.get(fallback_topic, {})
        for lvl in [3, 2, 1]:
            referrals = fallback_bucket.get(f"level_{lvl}", [])
            referrals = filter_referrals_for_income(referrals, income_value)
            if referrals:
                _attach_office_coordinates(referrals)
                return referrals

    return []


def normalize_step(step: Optional[str]) -> str:
    if not step:
        return "topic_selection"
    return step


def get_step_progress(step: Optional[str]) -> dict:
    step = normalize_step(step)
    steps_map = {
        "topic_selection": {"current": 1, "total": 6, "label_key": "progress.selectTopic"},
        "emergency_check": {"current": 2, "total": 6, "label_key": "progress.emergencyCheck"},
        "court_status": {"current": 3, "total": 6, "label_key": "progress.courtStatus"},
        "income_check": {"current": 4, "total": 6, "label_key": "progress.incomeLevel"},
        "problem_summary": {"current": 5, "total": 6, "label_key": "progress.problemSummary"},
        "summary_topic_confirm": {"current": 5, "total": 6, "label_key": "progress.problemSummary"},
        "topic_reconfirm": {"current": 6, "total": 6, "label_key": "progress.yourLocation"},
        "get_zip": {"current": 6, "total": 6, "label_key": "progress.yourLocation"},
        "complete": {"current": 6, "total": 6, "label_key": "progress.resourcesReady"},
        "resource_selected": {"current": 6, "total": 6, "label_key": "progress.resourcesReady"},
        "continue_check": {"current": 6, "total": 6, "label_key": "progress.resourcesReady"},
    }
    return steps_map.get(step, {"current": 1, "total": 6, "label_key": "progress.defaultLabel"})


def _score_band(score: int) -> str:
    safe = max(0, min(int(score), 100))
    if safe >= 70:
        return "high"
    if safe >= 40:
        return "moderate"
    return "low"


def build_decision_support(state: dict) -> dict:
    """
    Produce explainable legal triage scoring for UI display.
    This is informational support only (not legal advice).
    """
    topic = str(state.get("topic") or "general").lower()
    emergency = str(state.get("emergency") or "no").lower()
    in_court = bool(state.get("in_court"))
    income = str(state.get("income") or "yes").lower()
    summary = str(state.get("problem_summary") or "").strip().lower()

    urgency = 10
    urgency_reasons: List[str] = []
    if emergency == "yes":
        urgency += 55
        urgency_reasons.append("Emergency indicators were flagged during triage.")
    elif emergency == "unknown":
        urgency += 25
        urgency_reasons.append("Emergency status is unclear, so urgency is raised conservatively.")

    if in_court:
        urgency += 20
        urgency_reasons.append("An active court case increases time sensitivity.")

    if any(k in summary for k in ("deadline", "hearing", "court date", "eviction", "notice")):
        urgency += 10
        urgency_reasons.append("Your summary mentions deadline-sensitive events.")

    urgency = max(0, min(100, urgency))

    complexity = 20
    complexity_reasons: List[str] = []
    if topic in {"custody", "divorce"}:
        complexity += 25
        complexity_reasons.append("Family-law issues often involve multiple procedural steps.")
    elif topic in {"housing", "child_support"}:
        complexity += 15
        complexity_reasons.append("This issue type commonly requires structured paperwork and follow-up.")
    elif topic == "education":
        complexity += 10
        complexity_reasons.append("Education matters can involve administrative and legal processes.")

    if in_court:
        complexity += 20
        complexity_reasons.append("Court involvement increases procedural complexity.")

    if len(summary) >= 300:
        complexity += 10
        complexity_reasons.append("A longer case summary suggests a multi-factor situation.")

    complexity = max(0, min(100, complexity))

    self_help = 70
    self_help_reasons: List[str] = []
    if emergency == "yes":
        self_help -= 35
        self_help_reasons.append("Emergency conditions reduce self-help suitability.")
    elif emergency == "unknown":
        self_help -= 15
        self_help_reasons.append("Unclear emergency status lowers self-help confidence.")

    if in_court:
        self_help -= 25
        self_help_reasons.append("Cases already in court are usually less self-help friendly.")

    if topic in {"custody", "divorce"}:
        self_help -= 15
        self_help_reasons.append("Family-law disputes are often better supported with professional guidance.")

    if income == "yes":
        self_help += 10
        self_help_reasons.append("You may qualify for legal-aid pathways that improve support options.")

    self_help = max(0, min(100, self_help))

    overall_risk = round((urgency * 0.45) + (complexity * 0.35) + ((100 - self_help) * 0.20))
    overall_risk = max(0, min(100, overall_risk))

    return {
        "overall_risk": overall_risk,
        "overall_band": _score_band(overall_risk),
        "urgency": {
            "score": urgency,
            "band": _score_band(urgency),
            "reasons": urgency_reasons or ["No major urgency indicators were detected."],
        },
        "complexity": {
            "score": complexity,
            "band": _score_band(complexity),
            "reasons": complexity_reasons or ["Complexity appears manageable with guided resources."],
        },
        "self_help": {
            "score": self_help,
            "band": _score_band(self_help),
            "reasons": self_help_reasons or ["Self-help pathways appear suitable at this stage."],
        },
        "note": "Informational triage support only; not legal advice.",
    }


def run_chat_flow(request, referral_map: dict):
    raw_message = (request.message or "").strip()
    message = raw_message.lower()
    state = request.conversation_state or {}

    if detect_crisis_keywords(message) and state.get("step") not in ["topic_selection", None]:
        return {
            "response_key": "triage.emergency.crisisDetectedBody",
            "response_params": {},
            "options": ["continue_to_legal_resources", "restart"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state and state.get("step") in ("emergency_check", "court_status", "income_check"):
        redirected = try_redirect_topic_from_free_text(
            state, message, getattr(request, "intake_id", None)
        )
        if redirected:
            return redirected

    if not state or message in ["start", "begin", "start over"]:
        new_state = {"step": "topic_selection"}
        return {
            "response_key": "triage.topic.prompt",
            "response_params": {},
            "options": ["child_support", "education", "housing", "divorce", "custody"],
            "conversation_state": new_state,
            "progress": get_step_progress(new_state.get("step")),
        }

    if message == "restart":
        log_intake_event(request.intake_id, "triage_restart", "restart")
        new_state = {"step": "topic_selection"}
        return {
            "response_key": "triage.topic.prompt",
            "response_params": {},
            "options": ["child_support", "education", "housing", "divorce", "custody"],
            "conversation_state": new_state,
            "progress": get_step_progress(new_state.get("step")),
        }

    if state.get("step") == "topic_selection":
        selected_topic = infer_topic_from_text(message)
        if selected_topic:
            log_intake_event(request.intake_id, "topic_selected", selected_topic)
            state["topic"] = selected_topic
            state["step"] = "emergency_check"
            return {
                "response_key": "triage.topic.selected",
                "response_params": {"topic": selected_topic},
                "options": ["yes", "no", "unknown"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        return {
            "response_key": "triage.topic.invalid",
            "response_params": {},
            "options": ["child_support", "education", "housing", "divorce", "custody"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "emergency_check":
        if message == "yes":
            state["emergency"] = "yes"
            log_intake_event(request.intake_id, "emergency_answer", "yes")
            state["step"] = "court_status"
            return {
                "response_key": "triage.emergency.policeNote",
                "response_params": {},
                "options": ["yes", "no"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        if message == "no":
            state["emergency"] = "no"
            log_intake_event(request.intake_id, "emergency_answer", "no")
            state["step"] = "court_status"
        elif message in ["i don't know", "unknown", "not sure", "not_sure"]:
            state["emergency"] = "unknown"
            log_intake_event(request.intake_id, "emergency_answer", "unknown")
            state["step"] = "court_status"
        else:
            return {
                "response_key": "triage.emergency.invalid",
                "response_params": {},
                "options": ["yes", "no", "unknown"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        return {
            "response_key": "triage.court.prompt",
            "response_params": {},
            "options": ["yes", "no"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "court_status":
        if message == "yes":
            state["in_court"] = True
            log_intake_event(request.intake_id, "court_answer", "yes")
            state["step"] = "income_check"
        elif message == "no":
            state["in_court"] = False
            log_intake_event(request.intake_id, "court_answer", "no")
            state["step"] = "income_check"
        else:
            return {
                "response_key": "triage.court.invalid",
                "response_params": {},
                "options": ["yes", "no"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        return {
            "response_key": "triage.income.prompt",
            "response_params": {},
            "options": ["yes", "no", "not_sure"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "income_check":
        if message in ["yes", "not_sure"]:
            state["income_eligible"] = True
            state["income"] = "yes"
            log_intake_event(request.intake_id, "income_answer", message)
        elif message == "no":
            state["income_eligible"] = False
            state["income"] = "no"
            log_intake_event(request.intake_id, "income_answer", "no")
        else:
            return {
                "response_key": "triage.income.invalid",
                "response_params": {},
                "options": ["yes", "no", "not_sure"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        state["step"] = "problem_summary"
        return {
            "response_key": "triage.summary.prompt",
            "response_params": {},
            "options": [],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "problem_summary":
        summary = raw_message.strip()
        if len(summary) < 15:
            return {
                "response_key": "triage.summary.invalid",
                "response_params": {},
                "options": [],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        if len(summary) > 4000:
            summary = summary[:4000]

        selected_topic = state.get("topic")
        conflict_topic = infer_topic_conflict_with_selection(summary, selected_topic)
        if conflict_topic:
            state["problem_summary"] = summary
            state["summary_inferred_topic"] = conflict_topic
            state["step"] = "summary_topic_confirm"
            mismatch_payload = json.dumps(
                {
                    "selected_topic": selected_topic,
                    "inferred_topic": conflict_topic,
                    "summary_excerpt": summary[:500],
                },
                ensure_ascii=False,
            )
            log_intake_event(request.intake_id, "summary_topic_mismatch", mismatch_payload)
            return {
                "response_key": "triage.summary.topicMismatch",
                "response_params": {
                    "selectedTopic": selected_topic,
                    "inferredTopic": conflict_topic,
                },
                "options": ["summary_topic_same", "summary_topic_change"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        state["problem_summary"] = summary
        log_intake_event(request.intake_id, "problem_summary", summary)
        state["step"] = "get_zip"
        return {
            "response_key": "triage.zip.prompt",
            "response_params": {},
            "options": [],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "summary_topic_confirm":
        choice = raw_message.strip().lower().replace(" ", "_")
        summary_text = (state.get("problem_summary") or "").strip()

        if choice == "summary_topic_same":
            log_intake_event(request.intake_id, "summary_topic_alignment", "same")
            if summary_text:
                log_intake_event(request.intake_id, "problem_summary", summary_text)
            state.pop("summary_inferred_topic", None)
            state["step"] = "get_zip"
            return {
                "response_key": "triage.zip.prompt",
                "response_params": {},
                "options": [],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        if choice == "summary_topic_change":
            log_intake_event(request.intake_id, "summary_topic_alignment", "different")
            if summary_text:
                log_intake_event(request.intake_id, "problem_summary_alternate_topic", summary_text)
            state.pop("problem_summary", None)
            state.pop("summary_inferred_topic", None)
            for key in ("topic", "emergency", "in_court", "income_eligible", "income"):
                state.pop(key, None)
            state["step"] = "topic_selection"
            return {
                "response_key": "triage.summary.topicChangePrompt",
                "response_params": {},
                "options": ["child_support", "education", "housing", "divorce", "custody"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        return {
            "response_key": "triage.summary.topicMismatchInvalid",
            "response_params": {},
            "options": ["summary_topic_same", "summary_topic_change"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "get_zip":
        zip_resolved, zip_from_skip = resolve_five_digit_zip(message)
        if zip_resolved is None:
            selected_topic = state.get("topic")
            conflict_topic = infer_topic_conflict_with_selection(raw_message, selected_topic)
            if conflict_topic:
                state["reconfirm_inferred_topic"] = conflict_topic
                state["step"] = "topic_reconfirm"
                mismatch_payload = json.dumps(
                    {
                        "selected_topic": selected_topic,
                        "inferred_topic": conflict_topic,
                        "zip_input_excerpt": raw_message[:300],
                    },
                    ensure_ascii=False,
                )
                log_intake_event(request.intake_id, "zip_topic_mismatch", mismatch_payload)
                return {
                    "response_key": "triage.topic.reconfirm",
                    "response_params": {
                        "selectedTopic": selected_topic,
                        "inferredTopic": conflict_topic,
                    },
                    "options": ["summary_topic_same", "summary_topic_change"],
                    "conversation_state": state,
                    "progress": get_step_progress(state.get("step")),
                }
            return {
                "response_key": "triage.zip.invalid",
                "response_params": {"topic": state.get("topic")},
                "options": [],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        message = zip_resolved
        state["zip_code"] = message
        if zip_from_skip:
            state["zip_skipped"] = True
            log_intake_event(request.intake_id, "zip_skipped", message)
        else:
            state.pop("zip_skipped", None)
            log_intake_event(request.intake_id, "zip_entered", message)

        topic = state.get("topic", "general")
        emergency = state.get("emergency", "no")
        in_court = state.get("in_court", False)
        income_eligible = state.get("income_eligible", False)

        if emergency == "yes" or in_court:
            level = 3
            level_name = "direct legal assistance"
        elif (not in_court) and income_eligible:
            level = 2
            level_name = "self-help legal information"
        else:
            level = 1
            level_name = "general legal information"

        state["level"] = level
        log_intake_event(request.intake_id, "triage_level_assigned", str(level))
        referrals = get_referrals_for_topic(referral_map=referral_map, topic=topic, level=level, income_value=state.get("income", "yes"))
        referral_names = [ref.get("name", "").strip() for ref in referrals if ref.get("name")]
        log_intake_event(request.intake_id, "referrals_shown", json.dumps(referral_names, ensure_ascii=False))
        log_intake_event(request.intake_id, "triage_completed", "complete")

        final_state = {
            "step": "complete",
            "topic": topic,
            "level": level,
            "zip_code": message,
            "income": state.get("income", "yes"),
        }
        ps = state.get("problem_summary")
        if ps:
            final_state["problem_summary"] = ps
        if state.get("zip_skipped"):
            final_state["zip_skipped"] = True
        decision_support = build_decision_support(state)
        final_state["decision_support"] = decision_support
        return {
            "response_key": "triage.results.intro",
            "response_params": {"levelName": level_name, "topic": topic},
            "referrals": referrals,
            "decision_support": decision_support,
            "options": ["continue", "restart", "connect"],
            "conversation_state": final_state,
            "progress": get_step_progress(final_state.get("step")),
        }

    if state.get("step") == "topic_reconfirm":
        choice = raw_message.strip().lower().replace(" ", "_")

        if choice == "summary_topic_same":
            log_intake_event(request.intake_id, "zip_topic_alignment", "same")
            state.pop("reconfirm_inferred_topic", None)
            state["step"] = "get_zip"
            return {
                "response_key": "triage.zip.prompt",
                "response_params": {},
                "options": [],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        if choice == "summary_topic_change":
            log_intake_event(request.intake_id, "zip_topic_alignment", "different")
            state.pop("reconfirm_inferred_topic", None)
            for key in ("topic", "emergency", "in_court", "income_eligible", "income", "problem_summary"):
                state.pop(key, None)
            state["step"] = "topic_selection"
            return {
                "response_key": "triage.summary.topicChangePrompt",
                "response_params": {},
                "options": ["child_support", "education", "housing", "divorce", "custody"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }

        return {
            "response_key": "triage.topic.reconfirmInvalid",
            "response_params": {},
            "options": ["summary_topic_same", "summary_topic_change"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "complete":
        if message == "continue":
            new_state = {
                "step": "continue_check",
                "topic": state.get("topic"),
                "level": state.get("level"),
                "zip_code": state.get("zip_code"),
                "income": state.get("income"),
            }
            if state.get("problem_summary"):
                new_state["problem_summary"] = state.get("problem_summary")
            return {
                "response_key": "triage.continueCheck.prompt",
                "response_params": {},
                "options": ["yes", "no"],
                "conversation_state": new_state,
                "progress": get_step_progress(new_state.get("step")),
            }
        if message == "connect":
            topic = state.get("topic", "general")
            level = state.get("level", 1)
            zip_code = state.get("zip_code", "")
            income = state.get("income", "yes")
            referrals = get_referrals_for_topic(referral_map=referral_map, topic=topic, level=level, income_value=income)
            top_resource = referrals[0] if referrals else None
            if top_resource:
                selected_state = {"step": "resource_selected", "topic": topic, "level": level, "zip_code": zip_code, "income": income}
                return {
                    "response_key": "triage.results.connectTop",
                    "response_params": {},
                    "referrals": [top_resource],
                    "options": ["restart"],
                    "conversation_state": selected_state,
                    "progress": get_step_progress(selected_state.get("step")),
                }
            return {
                "response_key": "triage.results.connectFallback",
                "response_params": {},
                "options": ["restart"],
                "conversation_state": state,
                "progress": get_step_progress(state.get("step")),
            }
        return {
            "response_key": "triage.results.completeButtonsHint",
            "response_params": {},
            "options": ["continue", "restart", "connect"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "continue_check":
        if message == "yes":
            new_state = {"step": "topic_selection"}
            return {
                "response_key": "triage.topic.prompt",
                "response_params": {},
                "options": ["child_support", "education", "housing", "divorce", "custody"],
                "conversation_state": new_state,
                "progress": get_step_progress(new_state.get("step")),
            }
        if message == "no":
            return {
                "response_key": "triage.goodbye",
                "response_params": {},
                "options": ["restart"],
                "conversation_state": {"step": "complete"},
                "progress": get_step_progress("complete"),
            }
        return {
            "response_key": "triage.continueCheck.invalid",
            "response_params": {},
            "options": ["yes", "no"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    if state.get("step") == "resource_selected":
        return {
            "response_key": "triage.results.connectTop",
            "response_params": {},
            "options": ["restart"],
            "conversation_state": state,
            "progress": get_step_progress(state.get("step")),
        }

    return {
        "response_key": "triage.topic.prompt",
        "response_params": {},
        "options": ["child_support", "education", "housing", "divorce", "custody"],
        "conversation_state": {"step": "topic_selection"},
        "progress": get_step_progress("topic_selection"),
    }
