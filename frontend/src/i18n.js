import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANG_STORAGE_KEY = "cal_lang_v1";

// Supported (BCP 47 primary language tags).
const SUPPORTED = ["en", "es", "pl", "ar", "tl", "ru", "ko", "cmn", "yue"];

const resources = {
  en: {
    translation: {
      lang: {
        label: "Language / Idioma",
        english: "English",
        spanish: "Spanish (Español)",
        polish: "Polish (Polski)",
        arabic: "Arabic (العربية)",
        tagalog: "Tagalog (Tagalog)",
        russian: "Russian (Русский)",
        korean: "Korean (한국어)",
        mandarin: "Mandarin (普通话)",
        cantonese: "Cantonese (粵語)",
      },
      app: {
        title: "CAL Legal Information and Resources Chatbot",
        subtitle: "Self-Help Resource Navigator",
        infoReferrals: "Information & Referrals",
      },
      landing: {
        welcomeTitle: "Welcome to the Legal Resource Portal",
        tagline:
          "This chatbot connects Illinois residents with legal information and referrals for:",
        begin: "Begin Case Inquiry",
        importantNoticeTitle: "⚖️ Important Legal Notice",
        infoOnly: "Legal information and resources only, not legal advice.",
        privacyTitle: "⚠️ Privacy Notice:",
        privacyText:
          "This chatbot is not private. Any information you provide could be disclosed. Do not share sensitive personal information.",
        topics: {
          childSupportTitle: "Child Support",
          childSupportDesc: "Resources for custody and support matters",
          educationTitle: "Education",
          educationDesc: "School rights and special education help",
          housingTitle: "Housing",
          housingDesc: "Tenant rights and eviction assistance",
          divorceTitle: "Divorce",
          divorceDesc: "Divorce proceedings and legal guidance",
          custodyTitle: "Custody",
          custodyDesc: "Child custody and parenting time",
        },
      },
      chat: {
        starting: "Starting conversation...",
        placeholder: "Type your message here...",
        backTitle: "Go Back",
        restartTitle: "Restart",
        sendTitle: "Send message",
        footerInfoOnly: "Legal information and resources only, not legal advice.",
        footerPrivacyTitle: "⚠️ Privacy Notice:",
        footerPrivacyText:
          "This chatbot is not private. Any information you provide could be disclosed.",
        referralsTitle: "📋 Recommended Resources:",
        aiButton: "Have Questions? Ask the AI Legal Assistant",
        aiHint: "Get answers about forms, procedures, deadlines, and court processes",
        serverDown:
          "⚠️ Unable to connect to the server. Please wait 60 seconds for the backend to wake up, then click 'Restart' to try again.",
      },
      progress: {
        stepOf: "Step {{current}} of {{total}}",
        defaultLabel: "Getting Started",
        selectTopic: "Select Topic",
        emergencyCheck: "Emergency Check",
        courtStatus: "Court Status",
        incomeLevel: "Income Level",
        yourLocation: "Your Location",
        resourcesReady: "Resources Ready",
      },
      ai: {
        back: "← Back to Resources",
        title: "Illinois Legal Information Assistant",
        disclaimer: "⚖️ Legal information and resources only, not legal advice",
        privacy:
          "⚠️ This chatbot is not private. Information provided could be disclosed.",
        placeholder:
          "Ask about Illinois court procedures, forms, or legal processes...",
        send: "Send",
        sending: "Sending...",
        needHelp: "Need immediate help? Contact:",
        error:
          "I apologize, but I encountered an error. Please try asking your question again, or contact Chicago Advocate Legal at (312) 801-5918 for direct assistance.",
      },
      emergency: {
        button: "EMERGENCY",
        title: "🚨 Emergency Resources",
        warning: "If you are in immediate danger, call 911 now.",
        safetyNoteTitle: "Safety Note:",
        safetyNoteText:
          "If someone is monitoring your internet activity, consider calling instead of using online resources.",
        quickExit: "Quick Exit →",
        resources: {
          emsName: "Emergency Services (Police/Fire/Ambulance)",
          emsDesc: "Immediate life-threatening emergency",
          ndvName: "National Domestic Violence Hotline",
          ndvDesc: "24/7 support for domestic violence survivors",
          idvName: "Illinois Domestic Violence Hotline",
          idvDesc: "Illinois-specific domestic violence resources",
          lifelineName: "National Suicide Prevention Lifeline",
          lifelineDesc: "24/7 mental health crisis support",
          dcfsName: "Illinois Child Abuse Hotline (DCFS)",
          dcfsDesc: "Report child abuse or neglect",
          rainnName: "National Sexual Assault Hotline (RAINN)",
          rainnDesc: "Confidential support for sexual assault survivors",
        },
      },

      // Option-A triage keys (English baseline)
      triage: {
        options: {
          yes: "Yes",
          no: "No",
          unknown: "I don't know",
          notSure: "Not sure",
          continue: "Continue",
          restart: "Restart",
          connect: "Connect with a Resource",
          continueToLegalResources: "Continue to Legal Resources",

          topic_child_support: "Child Support",
          topic_education: "Education",
          topic_housing: "Housing",
          topic_divorce: "Divorce",
          topic_custody: "Custody",
        },
        topic: {
          prompt:
            "Hello! I'm here to help connect you with Illinois legal resources. This chatbot provides legal information only and is not legal advice. What legal issue do you need help with?",
          invalid: "Please select a valid legal issue.",
          selected: "You selected {{topicLabel}}. Is this an emergency?",
        },
        emergency: {
          crisisDetectedTitle: "🚨 **CRISIS DETECTED**",
          crisisDetectedBody:
            "If you are in immediate danger, please call 911 now. You can also contact the National Domestic Violence Hotline (1-800-799-7233) or the Illinois DV Hotline (1-877-863-6338). Click the red EMERGENCY button for more resources. Would you like to continue?",
          prompt:
            "Do you currently have an open court case related to this issue?",
          invalid: "Please select an option.",
          policeNote:
            "🚨 If this is an emergency, call the police immediately at 911. After you have contacted the police, I can help you find legal resources for your situation.",
        },
        court: {
          prompt: "Do you currently have an open court case related to this issue?",
          invalid: "Please answer Yes or No.",
        },
        income: {
          prompt:
            "Are you low-income or receiving public benefits (like SNAP, Medicaid, SSI)?",
          invalid: "Please select an option.",
        },
        zip: {
          prompt:
            "Please provide your Illinois ZIP code to find resources near you.",
          invalid: "Please provide a valid 5-digit Illinois ZIP code.",
        },
        results: {
          intro:
            "Based on your situation, here are {{levelName}} resources for {{topicLabel}} in Illinois:",
          cookCountyNote:
            "Since you're in Cook County, I'm including Chicago-specific legal aid organizations.",
          connectTop:
            "🎯 Here's your recommended contact for immediate assistance:",
          connectFallback:
            "Please contact one of the organizations listed above for assistance with your legal issue.",
          completeButtonsHint:
            "Use the buttons to continue, restart, or connect with a resource.",
        },
        continueCheck: {
          prompt: "Would you like help with another legal issue?",
          promptTopic: "What legal issue would you like help with?",
          goodbye:
            "Thank you for using Illinois Legal Triage. If you need help in the future, feel free to return. Take care!",
          invalid: "Please select Yes or No.",
        },
        continueToLegalResources: {
          prompt:
            "I understand. Let's continue finding legal resources for your situation. What legal issue do you need help with?",
        },
        fallback: {
          prompt:
            "I'm not sure I understood that. Click one of the buttons above, use Restart to begin again, or type your ZIP code if requested. How can I assist you?",
        },
      },
    },
  },

  es: {
    translation: {
      lang: {
        label: "Language / Idioma",
        english: "English",
        spanish: "Español",
        polish: "Polski",
        arabic: "العربية",
        tagalog: "Tagalog",
        russian: "Русский",
        korean: "한국어",
        mandarin: "Mandarin (普通话)",
        cantonese: "Cantonese (粵語)",
      },
      app: {
        title: "Chatbot de Información y Recursos Legales de CAL",
        subtitle: "Navegador de recursos de autoayuda",
        infoReferrals: "Información y referencias",
      },
      landing: {
        welcomeTitle: "Bienvenido/a al Portal de Recursos Legales",
        tagline:
          "Este chatbot conecta a residentes de Illinois con información legal y referencias para:",
        begin: "Comenzar consulta",
        importantNoticeTitle: "⚖️ Aviso legal importante",
        infoOnly: "Solo información y recursos legales, no asesoría legal.",
        privacyTitle: "⚠️ Aviso de privacidad:",
        privacyText:
          "Este chatbot no es privado. La información que proporcione podría divulgarse. No comparta información personal sensible.",
        topics: {
          childSupportTitle: "Manutención infantil",
          childSupportDesc: "Recursos para custodia y manutención",
          educationTitle: "Educación",
          educationDesc: "Derechos escolares y ayuda de educación especial",
          housingTitle: "Vivienda",
          housingDesc: "Derechos de inquilinos y ayuda con desalojos",
          divorceTitle: "Divorcio",
          divorceDesc: "Trámites de divorcio y orientación",
          custodyTitle: "Custodia",
          custodyDesc: "Custodia infantil y tiempo de crianza",
        },
      },
      chat: {
        starting: "Iniciando conversación...",
        placeholder: "Escriba su mensaje aquí...",
        backTitle: "Volver",
        restartTitle: "Reiniciar",
        sendTitle: "Enviar",
        footerInfoOnly: "Solo información y recursos legales, no asesoría legal.",
        footerPrivacyTitle: "⚠️ Aviso de privacidad:",
        footerPrivacyText:
          "Este chatbot no es privado. La información que proporcione podría divulgarse.",
        referralsTitle: "📋 Recursos recomendados:",
        aiButton: "¿Tiene preguntas? Pregunte al asistente legal con IA",
        aiHint:
          "Respuestas sobre formularios, procedimientos, plazos y procesos judiciales",
        serverDown:
          "⚠️ No se pudo conectar al servidor. Espere 60 segundos para que el backend se active y luego haga clic en 'Reiniciar' para intentarlo de nuevo.",
      },
      progress: {
        stepOf: "Paso {{current}} de {{total}}",
        defaultLabel: "Comenzando",
        selectTopic: "Elegir tema",
        emergencyCheck: "Emergencia",
        courtStatus: "Situación del caso",
        incomeLevel: "Ingresos",
        yourLocation: "Ubicación",
        resourcesReady: "Recursos listos",
      },
      ai: {
        back: "← Volver a recursos",
        title: "Asistente de información legal de Illinois",
        disclaimer: "⚖️ Solo información y recursos legales, no asesoría legal",
        privacy:
          "⚠️ Este chatbot no es privado. La información proporcionada podría divulgarse.",
        placeholder:
          "Pregunte sobre procedimientos judiciales, formularios o procesos legales en Illinois...",
        send: "Enviar",
        sending: "Enviando...",
        needHelp: "¿Necesita ayuda inmediata? Contacte a:",
        error:
          "Lo siento, ocurrió un error. Intente preguntar de nuevo o contacte a Chicago Advocate Legal al (312) 801-5918 para obtener ayuda directa.",
      },
      emergency: {
        button: "EMERGENCIA",
        title: "🚨 Recursos de emergencia",
        warning: "Si está en peligro inmediato, llame al 911 ahora.",
        safetyNoteTitle: "Nota de seguridad:",
        safetyNoteText:
          "Si alguien está monitoreando su actividad en internet, considere llamar por teléfono en lugar de usar recursos en línea.",
        quickExit: "Salida rápida →",
        resources: {
          emsName: "Servicios de emergencia (policía/bomberos/ambulancia)",
          emsDesc: "Emergencia inmediata con riesgo de vida",
          ndvName: "Línea nacional contra la violencia doméstica",
          ndvDesc: "Apoyo 24/7 para sobrevivientes de violencia doméstica",
          idvName: "Línea de violencia doméstica de Illinois",
          idvDesc: "Recursos específicos de Illinois",
          lifelineName: "Línea 988 de crisis y prevención del suicidio",
          lifelineDesc: "Apoyo 24/7 para crisis de salud mental",
          dcfsName: "Línea de abuso infantil de Illinois (DCFS)",
          dcfsDesc: "Reportar abuso o negligencia infantil",
          rainnName: "Línea nacional de agresión sexual (RAINN)",
          rainnDesc: "Apoyo confidencial para sobrevivientes de agresión sexual",
        },
      },

      // Spanish triage (fill what you have; missing keys fall back to English)
      triage: {
        options: {
          yes: "Sí",
          no: "No",
          unknown: "No estoy seguro/a",
          notSure: "No estoy seguro/a",
          continue: "Continuar",
          restart: "Reiniciar",
          connect: "Conectarme con un recurso",
          continueToLegalResources: "Continuar a recursos legales",

          topic_child_support: "Manutención infantil",
          topic_education: "Educación",
          topic_housing: "Vivienda",
          topic_divorce: "Divorcio",
          topic_custody: "Custodia",
        },
        topic: {
          prompt:
            "¡Hola! Estoy aquí para ayudarle a conectarse con recursos legales de Illinois. Este chatbot solo proporciona información legal y no es asesoría legal. ¿Con qué asunto legal necesita ayuda?",
          invalid: "Por favor seleccione un asunto legal válido.",
          selected: "Seleccionó {{topicLabel}}. ¿Es una emergencia?",
        },
        emergency: {
          prompt:
            "¿Actualmente tiene un caso abierto en la corte relacionado con este asunto?",
          invalid: "Por favor seleccione una opción.",
          policeNote:
            "🚨 Si es una emergencia, llame a la policía inmediatamente al 911. Después de llamar, puedo ayudarle a encontrar recursos legales.",
        },
        court: {
          prompt:
            "¿Actualmente tiene un caso abierto en la corte relacionado con este asunto?",
          invalid: "Por favor responda Sí o No.",
        },
        income: {
          prompt:
            "¿Tiene bajos ingresos o recibe beneficios públicos (como SNAP, Medicaid, SSI)?",
          invalid: "Por favor seleccione una opción.",
        },
        zip: {
          prompt:
            "Por favor indique su código postal (ZIP) de Illinois para encontrar recursos cerca de usted.",
          invalid: "Por favor indique un ZIP válido de 5 dígitos.",
        },
        continueCheck: {
          prompt: "¿Quiere ayuda con otro asunto legal?",
          promptTopic: "¿Con qué asunto legal le gustaría ayuda?",
          goodbye:
            "Gracias por usar Illinois Legal Triage. Si necesita ayuda en el futuro, regrese cuando quiera. ¡Cuídese!",
          invalid: "Por favor seleccione Sí o No.",
        },
      },
    },
  },

  // Mandarin (written)
  cmn: {
    translation: {
      lang: {
        label: "Language / Idioma",
        english: "English",
        spanish: "Español",
        polish: "Polski",
        arabic: "العربية",
        tagalog: "Tagalog",
        russian: "Русский",
        korean: "한국어",
        mandarin: "Mandarin (普通话)",
        cantonese: "Cantonese (粵語)",
      },
      app: {
        title: "CAL 法律信息与资源聊天机器人",
        subtitle: "自助资源导航",
        infoReferrals: "信息与转介",
      },
      landing: {
        welcomeTitle: "欢迎来到法律资源门户",
        tagline: "本聊天机器人为伊利诺伊州居民提供以下方面的法律信息与转介：",
        begin: "开始咨询",
        importantNoticeTitle: "⚖️ 重要法律声明",
        infoOnly: "仅提供法律信息与资源，不构成法律建议。",
        privacyTitle: "⚠️ 隐私提示：",
        privacyText:
          "本聊天机器人不具备隐私性。您提供的信息可能会被披露。请勿分享敏感个人信息。",
        topics: {
          childSupportTitle: "子女抚养费",
          childSupportDesc: "关于监护与抚养的资源",
          educationTitle: "教育",
          educationDesc: "学校权利与特殊教育帮助",
          housingTitle: "住房",
          housingDesc: "租客权利与驱逐援助",
          divorceTitle: "离婚",
          divorceDesc: "离婚程序与相关指导",
          custodyTitle: "监护权",
          custodyDesc: "子女监护与探视时间",
        },
      },
      chat: {
        starting: "正在开始对话...",
        placeholder: "在此输入消息...",
        backTitle: "返回",
        restartTitle: "重新开始",
        sendTitle: "发送",
        footerInfoOnly: "仅提供法律信息与资源，不构成法律建议。",
        footerPrivacyTitle: "⚠️ 隐私提示：",
        footerPrivacyText: "本聊天机器人不具备隐私性。您提供的信息可能会被披露。",
        referralsTitle: "📋 推荐资源：",
        aiButton: "有问题？询问 AI 法律助手",
        aiHint: "关于表格、流程、期限和法院程序的说明",
        serverDown: "⚠️ 无法连接服务器。请等待 60 秒后点击“重新开始”再试。",
      },
      progress: {
        stepOf: "第 {{current}} 步（共 {{total}} 步）",
        defaultLabel: "开始",
      },
      ai: {
        back: "← 返回资源列表",
        title: "伊利诺伊州法律信息助手",
        disclaimer: "⚖️ 仅提供法律信息与资源，不构成法律建议",
        privacy: "⚠️ 本聊天机器人不具备隐私性。您提供的信息可能会被披露。",
        placeholder: "询问伊利诺伊州法院程序、表格或法律流程...",
        send: "发送",
        sending: "发送中...",
        needHelp: "需要立即帮助？请联系：",
        error: "抱歉，发生错误。请重试，或致电 Chicago Advocate Legal：(312) 801-5918。",
      },
      emergency: {
        button: "紧急",
        title: "🚨 紧急资源",
        warning: "如有迫在眉睫的危险，请立即拨打 911。",
        safetyNoteTitle: "安全提示：",
        safetyNoteText: "如果有人在监控您的上网行为，请考虑改用电话联系。",
        quickExit: "快速退出 →",
        resources: {
          emsName: "紧急服务（警察/消防/救护）",
          emsDesc: "危及生命的紧急情况",
          ndvName: "全国家庭暴力热线",
          ndvDesc: "24/7 支持服务",
          idvName: "伊利诺伊州家庭暴力热线",
          idvDesc: "伊利诺伊州本地资源",
          lifelineName: "988 自杀与危机热线",
          lifelineDesc: "24/7 心理危机支持",
          dcfsName: "伊利诺伊州儿童虐待热线（DCFS）",
          dcfsDesc: "报告儿童虐待或忽视",
          rainnName: "全国性侵热线（RAINN）",
          rainnDesc: "保密支持服务",
        },
      },
    },
  },

  // Cantonese (written)
  yue: {
    translation: {
      lang: {
        label: "Language / Idioma",
        english: "English",
        spanish: "Español",
        polish: "Polski",
        arabic: "العربية",
        tagalog: "Tagalog",
        russian: "Русский",
        korean: "한국어",
        mandarin: "Mandarin (普通话)",
        cantonese: "Cantonese (粵語)",
      },
      app: {
        title: "CAL 法律資訊與資源聊天機械人",
        subtitle: "自助資源導航",
        infoReferrals: "資訊與轉介",
      },
      landing: {
        welcomeTitle: "歡迎使用法律資源入口",
        tagline: "本聊天機械人為伊利諾伊州居民提供以下範疇嘅法律資訊與轉介：",
        begin: "開始查詢",
        importantNoticeTitle: "⚖️ 重要法律聲明",
        infoOnly: "只提供法律資訊與資源，唔構成法律意見。",
        privacyTitle: "⚠️ 私隱提示：",
        privacyText:
          "本聊天機械人並非私密。你提供嘅資料有機會被披露。請勿分享敏感個人資料。",
        topics: {
          childSupportTitle: "子女撫養費",
          childSupportDesc: "關於監護與撫養嘅資源",
          educationTitle: "教育",
          educationDesc: "學校權利同特殊教育支援",
          housingTitle: "住房",
          housingDesc: "租客權利同驅逐援助",
          divorceTitle: "離婚",
          divorceDesc: "離婚程序同相關指引",
          custodyTitle: "監護權",
          custodyDesc: "子女監護同探視時間",
        },
      },
      chat: {
        starting: "正在開始對話...",
        placeholder: "喺度輸入訊息...",
        backTitle: "返回",
        restartTitle: "重新開始",
        sendTitle: "送出",
        footerInfoOnly: "只提供法律資訊與資源，唔構成法律意見。",
        footerPrivacyTitle: "⚠️ 私隱提示：",
        footerPrivacyText:
          "本聊天機械人並非私密。你提供嘅資料有機會被披露。",
        referralsTitle: "📋 推薦資源：",
        aiButton: "有問題？問 AI 法律助手",
        aiHint: "講解表格、程序、期限同法院流程",
        serverDown: "⚠️ 連唔到伺服器。請等 60 秒後按「重新開始」再試。",
      },
      progress: {
        stepOf: "第 {{current}} 步（共 {{total}} 步）",
        defaultLabel: "開始",
      },
      ai: {
        back: "← 返回資源",
        title: "伊利諾伊州法律資訊助手",
        disclaimer: "⚖️ 只提供法律資訊與資源，唔構成法律意見",
        privacy: "⚠️ 本聊天機械人並非私密。你提供嘅資料有機會被披露。",
        placeholder: "查詢伊利諾伊州法院程序、表格或法律流程...",
        send: "送出",
        sending: "送出中...",
        needHelp: "需要即時協助？請聯絡：",
        error:
          "對唔住，發生錯誤。請再試，或致電 Chicago Advocate Legal：(312) 801-5918。",
      },
      emergency: {
        button: "緊急",
        title: "🚨 緊急資源",
        warning: "如有即時危險，請即刻打 911。",
        safetyNoteTitle: "安全提示：",
        safetyNoteText: "如果有人監控你嘅上網活動，建議改用電話聯絡。",
        quickExit: "快速離開 →",
        resources: {
          emsName: "緊急服務（警察/消防/救護）",
          emsDesc: "危及生命嘅緊急情況",
          ndvName: "全國家庭暴力熱線",
          ndvDesc: "24/7 支援服務",
          idvName: "伊利諾伊州家庭暴力熱線",
          idvDesc: "伊利諾伊州本地資源",
          lifelineName: "988 自殺與危機熱線",
          lifelineDesc: "24/7 心理危機支援",
          dcfsName: "伊利諾伊州兒童虐待熱線（DCFS）",
          dcfsDesc: "舉報兒童虐待或疏忽",
          rainnName: "全國性侵熱線（RAINN）",
          rainnDesc: "保密支援服務",
        },
      },
    },
  },

  // NOTE: Other languages not provided -> fallback to English automatically.
};

function normalizeToSupported(lng) {
  if (!lng) return "en";
  const lower = String(lng).toLowerCase();

  for (const code of SUPPORTED) {
    if (lower === code || lower.startsWith(code + "-")) return code;
  }

  const base = lower.split("-")[0];
  if (SUPPORTED.includes(base)) return base;

  return "en";
}

function getInitialLanguage() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && SUPPORTED.includes(saved)) return saved;
  return normalizeToSupported(navigator.language || "en");
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function setAppLanguage(lng) {
  const normalized = normalizeToSupported(lng);
  localStorage.setItem(LANG_STORAGE_KEY, normalized);
  i18n.changeLanguage(normalized);
}

export function getNormalizedLanguage() {
  return normalizeToSupported(i18n.resolvedLanguage || i18n.language || "en");
}

export default i18n;
