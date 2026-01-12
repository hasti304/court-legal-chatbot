import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANG_STORAGE_KEY = "cal_lang_v1";
const SUPPORTED = ["en", "es"];

const resources = {
  en: {
    translation: {
      lang: {
        label: "Language / Idioma",
        english: "English",
        spanish: "Spanish (Español)",
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
        button: "Emergency",
        title: "Emergency Contacts",
        warning: "If you are in immediate danger, call 911 now.",
        safetyNoteTitle: "Safety note:",
        safetyNoteText:
          "If someone is monitoring your internet activity, consider calling instead of using online resources.",
        quickExit: "Exit",
        resources: {
          emsName: "Emergency services (Police / Fire / Ambulance)",
          emsDesc: "Call 911 for immediate, life-threatening emergencies.",
          ndvName: "National Domestic Violence Hotline",
          ndvDesc: "24/7 confidential support for domestic violence survivors.",
          idvName: "Illinois Domestic Violence Hotline",
          idvDesc: "Illinois-specific domestic violence resources and support.",
          lifelineName: "988 Suicide & Crisis Lifeline",
          lifelineDesc: "24/7 support for mental health or suicide crisis.",
          dcfsName: "Illinois Child Abuse Hotline (DCFS)",
          dcfsDesc: "Report suspected child abuse or neglect.",
          rainnName: "RAINN National Sexual Assault Hotline",
          rainnDesc: "Confidential support for sexual assault survivors.",
        },
      },

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
          crisisDetectedBody:
            "🚨 CRISIS DETECTED\n\nIf you are in immediate danger, please call 911 now.\n\nYou can also contact:\n- National Domestic Violence Hotline: 1-800-799-7233\n- Illinois DV Hotline: 1-877-863-6338\n- 988 Suicide & Crisis Lifeline: 988\n- Illinois Child Abuse Hotline (DCFS): 1-800-252-2873\n\nClick the Emergency button for more resources.\n\nWould you like to continue?",
          invalid: "Please select an option.",
          policeNote:
            "🚨 If this is an emergency, call the police immediately at 911.\n\nAfter you have contacted the police, I can help you find legal resources for your situation.\n\nDo you currently have an open court case related to this issue?",
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
          connectTop: "🎯 Here's your recommended contact for immediate assistance:",
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
        button: "Emergencia",
        title: "Contactos de emergencia",
        warning: "Si está en peligro inmediato, llame al 911 ahora.",
        safetyNoteTitle: "Nota de seguridad:",
        safetyNoteText:
          "Si alguien está monitoreando su actividad en internet, considere llamar por teléfono en lugar de usar recursos en línea.",
        quickExit: "Salir",
        resources: {
          emsName: "Servicios de emergencia (Policía / Bomberos / Ambulancia)",
          emsDesc: "Llame al 911 para emergencias inmediatas y peligrosas.",
          ndvName: "Línea Nacional contra la Violencia Doméstica",
          ndvDesc: "Apoyo confidencial 24/7 para sobrevivientes de violencia doméstica.",
          idvName: "Línea de Violencia Doméstica de Illinois",
          idvDesc: "Recursos y apoyo específicos de Illinois.",
          lifelineName: "Línea 988 de Crisis y Prevención del Suicidio",
          lifelineDesc: "Apoyo 24/7 para crisis de salud mental o suicidio.",
          dcfsName: "Línea de Abuso Infantil de Illinois (DCFS)",
          dcfsDesc: "Reporte sospecha de abuso o negligencia infantil.",
          rainnName: "Línea Nacional de Agresión Sexual (RAINN)",
          rainnDesc: "Apoyo confidencial para sobrevivientes de agresión sexual.",
        },
      },

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
          crisisDetectedBody:
            "🚨 SE DETECTÓ UNA CRISIS\n\nSi está en peligro inmediato, llame al 911 ahora.\n\nTambién puede comunicarse con:\n- Línea nacional contra la violencia doméstica: 1-800-799-7233\n- Línea de violencia doméstica de Illinois: 1-877-863-6338\n- Línea 988 de crisis y prevención del suicidio: 988\n- Línea de abuso infantil de Illinois (DCFS): 1-800-252-2873\n\nHaga clic en el botón de Emergencia para más recursos.\n\n¿Desea continuar?",
          invalid: "Por favor seleccione una opción.",
          policeNote:
            "🚨 Si es una emergencia, llame a la policía inmediatamente al 911.\n\nDespués de llamar, puedo ayudarle a encontrar recursos legales.\n\n¿Actualmente tiene un caso abierto en la corte relacionado con este asunto?",
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
        results: {
          intro:
            "Según su situación, aquí hay recursos de {{levelName}} para {{topicLabel}} en Illinois:",
          connectTop:
            "🎯 Aquí está su contacto recomendado para asistencia inmediata:",
          connectFallback:
            "Por favor contacte a una de las organizaciones mencionadas arriba para obtener ayuda.",
          completeButtonsHint:
            "Use los botones para continuar, reiniciar o conectarse con un recurso.",
        },
        continueCheck: {
          prompt: "¿Quiere ayuda con otro asunto legal?",
          promptTopic: "¿Con qué asunto legal le gustaría ayuda?",
          goodbye:
            "Gracias por usar Illinois Legal Triage. Si necesita ayuda en el futuro, regrese cuando quiera. ¡Cuídese!",
          invalid: "Por favor seleccione Sí o No.",
        },
        continueToLegalResources: {
          prompt:
            "Entiendo. Continuemos buscando recursos legales para su situación. ¿Con qué asunto legal necesita ayuda?",
        },
        fallback: {
          prompt:
            "No estoy seguro/a de haber entendido. Haga clic en uno de los botones, use Reiniciar para comenzar de nuevo, o escriba su ZIP si se lo pedí. ¿Cómo puedo ayudarle?",
        },
      },
    },
  },
};

function normalizeToSupported(lng) {
  if (!lng) return "en";
  const lower = String(lng).toLowerCase();
  if (lower === "es" || lower.startsWith("es-")) return "es";
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
