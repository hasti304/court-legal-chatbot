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

      theme: {
        useLight: "Switch to light mode",
        useDark: "Switch to dark mode",
      },

      login: {
        heading: "Sign in to Chicago Advocate Legal, NFP",
        lead: "Use the same email you used when you created your account with us.",
        emailLabel: "Email address",
        passwordLabel: "Password",
        createPassword: "Create a password (min 8 characters)",
        confirmAccountPassword: "Confirm password (min 8 characters)",
        passwordLoginButton: "Sign in",
        signingIn: "Signing in…",
        forgotPassword: "Forgot password?",
        forgotTitle: "Reset your password",
        forgotBody: "Enter your account email and we will send you a reset link.",
        sendReset: "Send reset email",
        forgotNotice:
          "If that email exists in our records, we sent a password reset link. Please check your inbox.",
        resetTitle: "Choose a new password",
        resetBody: "Enter and confirm your new password.",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        savingPassword: "Saving…",
        resetPasswordButton: "Reset password",
        resetDone: "Password updated. You can now sign in with your email and password.",
        resetInvalid: "This reset link is invalid or expired. Please request a new one.",
        passwordTooShort: "Password must be at least 8 characters.",
        passwordMismatch: "Passwords do not match.",
        passwordLoginFailed: "Invalid email or password.",
        show: "Show",
        hide: "Hide",
        showPassword: "Show password",
        hidePassword: "Hide password",
        passwordStrength: {
          weak: "Password strength: Weak",
          medium: "Password strength: Medium",
          strong: "Password strength: Strong",
        },
        emailLoginButton: "Email me a login link",
        sending: "Sending…",
        or: "or",
        google: "Continue with Google",
        apple: "Continue with Apple",
        socialSoon: "Coming soon",
        socialSectionNote:
          "Google and Apple sign-in are not set up yet. Use your email above for now.",
        checkTitle: "Check your email",
        checkBody:
          "We sent a one-time sign-in link to {{email}}. It expires in a few minutes. If you have not created an account with us yet, go back and choose “Create an account”.",
        resend: "Send another login email",
        backToSignIn: "Back to sign in",
        returningPrompt: "Already have an account?",
        signInWithEmail: "Click here to sign in with email",
        newUserPrompt: "First time here?",
        createAccount: "Create an account",
        createAccountTitle: "Create an account",
        clientLogin: "Client login",
        staffLogin: "Admin login",
        intakeLoginChoiceAria: "Choose client or staff sign-in",
        welcomeBackTitle: "Welcome back",
        welcomeBackBody:
          "Continue on this device, or sign in on another device using the same email.",
        continueThisDevice: "Continue to resources",
        useDifferentEmail: "Sign in with a different email",
        signOutDevice: "Forget this device",
        requestFailed: "We could not send the link. Try again later.",
        verifyFailed: "This sign-in link is invalid or has expired. Request a new one.",
        devLinkLabel: "Development only — open this link to sign in:",
        resetDevLinkLabel: "Development only — open this link to reset your password:",
        authAside: {
          ariaLabel: "About this portal",
          kicker: "Chicago Advocate Legal, NFP",
          headline: "Illinois legal information and referrals",
          body:
            "A professional, secure entry point to our resource navigator. We provide general legal information and referrals—not legal advice, and no attorney–client relationship is created.",
          item1: "Guided intake aligned with your situation and Illinois resources",
          item2: "Clear referrals and next steps based on your answers",
          item3: "Optional AI assistant for general court and forms questions",
          item4: "Privacy-minded tools including Quick Exit when you need to leave fast",
        },
      },

      intake: {
        title: "Before we begin",
        subtitle:
          "Please enter your information so we can connect you with the right resources.",
        samePersonTitle: "Welcome back",
        samePersonBody: "Is this the same person as last time on this device?",
        samePerson: "I'm the same person",
        newInquiry: "Create Login",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone number",
        zip: "ZIP code",
        consentText:
          "We do not share your information with third parties except as required by law or to provide requested services.",
        consentRequired: "You must agree to continue.",
        submit: "Continue",
        privacyLink: "Privacy Notice",
        invalidEmail: "Please enter a valid email address.",
        invalidZip: "Please enter a valid 5-digit ZIP code.",
        invalidPhone: "Please enter a valid 10-digit US phone number.",
        submitting: "Submitting…",
        savingDetail: "Saving your information securely…",
        retryingDetail: "Retrying connection…",
        successTitle: "You're signed in",
        successBody:
          "Your information was saved on this device. You can continue to the resource navigator.",
        continueToPortal: "Continue to resources",
        serverError:
          "Sorry – we could not save your information. Please try again.",
        duplicateAccount:
          "An account already exists with this email or phone number. Please sign in, or use a different email and phone number to register.",
      },

      privacy: {
        title: "Privacy Notice",
        body:
          "We collect your name, email, phone number, and the issue area you select to help route you to appropriate resources. We may ask for your ZIP code when you use the navigator to show nearby options. We do not share your information with third parties except as required by law or to provide requested services. You may request deletion of your data by contacting the organization listed in the app.",
        back: "Back",
      },

      app: {
        title: "CAL Legal Information and Resources Chatbot",
        subtitle: "Self-Help Resource Navigator",
        infoReferrals: "Information & Referrals",
      },

      site: {
        footerOrg:
          "Chicago Advocate Legal, NFP — Illinois legal information and referrals",
        footerDisclaimer:
          "This tool provides general legal information, not legal advice. No attorney–client relationship is created.",
        footerContactLabel: "Questions about this service:",
        staffSignIn: "Staff sign-in",
      },

      trust: {
        title: "What this tool does",
        buttonLabel: "What does this tool do",
        quickLabel: "What's this?",
        lead: "Use this navigator to learn about options and find organizations that may help.",
        doesHeading: "You can use it to",
        doesNotHeading: "It does not",
        doesLines:
          "• Learn about Illinois court processes and resources\n• Get connected to legal aid and community organizations\n• Use the AI assistant for general information about forms and procedures",
        doesNotLines:
          "• Provide legal advice for your specific situation\n• Represent you in court or predict outcomes\n• Guarantee privacy from all disclosure (see the Privacy Notice)",
      },

      resume: {
        title: "Continue your last session?",
        detail:
          "You have a triage session in progress on this device. You can pick up where you left off or start over.",
        continueBtn: "Resume session",
        startNewBtn: "Start new triage",
      },

      referral: {
        matchLevel1:
          "Suggested for general legal information based on your answers (not a guarantee of services).",
        matchLevel2:
          "Suggested for self-help legal information based on your answers (not a guarantee of services).",
        matchLevel3:
          "Suggested for more direct assistance options based on your answers (not a guarantee of services).",
      },

      glossary: {
        title: "Common legal terms (plain language)",
        intro: "Short definitions for unfamiliar words. This is educational only.",
        terms: {
          legal_information: {
            term: "Legal information",
            def: "General explanations of laws and court processes—not tailored advice about what you should do in your case.",
          },
          legal_advice: {
            term: "Legal advice",
            def: "Guidance about your specific rights and what you should do next from a licensed attorney.",
          },
          pro_se: {
            term: "Pro se",
            def: "Representing yourself in court without an attorney.",
          },
          plaintiff: {
            term: "Plaintiff",
            def: "The person who starts a civil court case.",
          },
          defendant: {
            term: "Defendant",
            def: "The person responding to a civil court case.",
          },
          eviction: {
            term: "Eviction",
            def: "A legal process to remove a tenant—rules and timelines vary by situation.",
          },
          order: {
            term: "Court order",
            def: "A written decision by a judge that can be enforced.",
          },
        },
      },

      resources: {
        panelTitle: "Next steps & self-help (general information)",
        panelDisclaimer:
          "These ideas are educational—not legal advice. Adapt any letter to your situation.",
        nextStepsTitle: "Checklist — typical next steps",
        formsTitle: "Official information & court links",
        letterTitle: "Sample letter (copy and edit)",
        letterHint:
          "Replace bracketed parts. Keep a copy. This does not replace legal advice.",
        copyLetter: "Copy text",
        copied: "Copied!",
        forms: {
          ilaHome: "Illinois Legal Aid Online (home)",
          ilaHousing: "Illinois Legal Aid — housing",
          ilaEducation: "Illinois Legal Aid — school & education",
          ilaFamily: "Illinois Legal Aid — family & safety",
          courts: "Illinois Courts portal",
          isbe: "Illinois State Board of Education",
          dcfs: "Illinois DCFS (child welfare)",
        },
        nextSteps: {
          housing:
            "1. Save notices, lease, rent receipts, and photos of conditions.\n2. Read Illinois Legal Aid materials on tenant rights before deadlines.\n3. If you have a court date, confirm time and courthouse location.\n4. Contact legal aid or a tenant organization if you may qualify for help.",
          education:
            "1. Keep copies of IEP/504 plans, emails, and discipline notices.\n2. Ask the school for your child’s records in writing if needed.\n3. Note important dates for meetings or appeals.\n4. Use protection & advocacy resources if disability rights are involved.",
          child_support:
            "1. Gather income documents and any existing court orders.\n2. Use Illinois Legal Aid resources to understand modification basics.\n3. Keep a log of payments or missed payments if relevant.\n4. Ask the court clerk about forms used in your county.",
          divorce:
            "1. List assets and debts; collect marriage and financial documents.\n2. Learn filing basics for Illinois dissolution of marriage.\n3. Consider mediation if both parties are willing.\n4. Ask the clerk about parenting education requirements in your county.",
          custody:
            "1. Collect existing parenting plans or orders.\n2. Document parenting time and important communications calmly.\n3. Review Illinois information on allocation of parental responsibilities.\n4. Prepare questions if you speak with legal aid or a mediator.",
          general:
            "1. Write down dates, deadlines, and names of agencies involved.\n2. Keep copies of letters and forms you send or receive.\n3. Confirm court dates and locations with the clerk.\n4. Contact legal aid if you may qualify for free help.",
        },
        letterTemplate: {
          housing:
            "[Today’s date]\n\n[Landlord or manager name]\n[Address]\n\nRe: [Unit address]\n\nDear [name],\n\nI am writing about [issue — e.g., repairs, notice, lease question]. I request [specific action you want]. Please respond by [date].\n\nThank you,\n[Your name]\n[Phone] [Email]",
          education:
            "[Today’s date]\n\n[School principal or district contact]\n[Address]\n\nRe: [Student name, grade]\n\nDear [name],\n\nI am writing to request [meeting / records / clarification] regarding [brief issue]. Please confirm receipt and next steps by [date].\n\nThank you,\n[Your name]\n[Phone] [Email]",
          child_support:
            "[Today’s date]\n\n[Agency or court name if known]\n[Address if known]\n\nRe: Child support — [case or ID if any]\n\nDear [name],\n\nI am requesting information about [payment record / order / next hearing]. Please advise what documents you need from me.\n\nThank you,\n[Your name]\n[Phone] [Email]",
          divorce:
            "[Today’s date]\n\n[Other party or attorney if known]\n[Address if known]\n\nRe: Divorce case\n\nDear [name],\n\nI am writing about [topic — e.g., exchange of documents, scheduling]. Please reply by [date] so we can [goal].\n\nThank you,\n[Your name]\n[Phone] [Email]",
          custody:
            "[Today’s date]\n\n[Other parent or attorney if applicable]\n[Address if known]\n\nRe: Parenting time / custody\n\nDear [name],\n\nI am writing to propose [specific schedule or change] because [brief reason]. I am open to discussing [mediation / court process].\n\nThank you,\n[Your name]\n[Phone] [Email]",
          general:
            "[Today’s date]\n\n[Agency or person]\n[Address]\n\nRe: [Subject]\n\nDear [name],\n\nI need help with [brief description]. My contact information is below. Please tell me the next steps or forms required.\n\nThank you,\n[Your name]\n[Phone] [Email]",
        },
      },

      landing: {
        welcomeTitle: "Welcome to the Legal Resource Portal",
        tagline:
          "This chatbot connects Illinois residents with legal information and referrals for:",
        begin: "Begin",
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
        placeholderSummary:
          "Briefly describe your situation in your own words (about 2–4 sentences). This helps staff understand your needs.",
        placeholderTopicAlign:
          "Tap a button above, or type yes if it is still the same topic, or no if you need a different topic.",
        backTitle: "Go Back",
        restartTitle: "Restart",
        sendTitle: "Send message",
        footerInfoOnly: "Legal information and resources only, not legal advice.",
        footerPrivacyTitle: "⚠️ Privacy Notice:",
        footerPrivacyText:
          "This chatbot is not private. Any information you provide could be disclosed.",
        referralsTitle: "📋 Recommended Resources:",
        aiButton: "Have Questions? Ask the AI Legal Assistant",
        aiHint:
          "Get answers about forms, procedures, deadlines, and court processes",
        serverDown:
          "⚠️ Unable to connect to the server. Please wait a moment for the backend to wake up, then click 'Restart' to try again.",
        loadingBanner:
          "Reviewing your answers and preparing the next step…",
        printResources: "Print my resource list",
        printTitle: "Legal resources summary",
        printIntro: "Topic: {{topic}} · ZIP: {{zip}}",
        printFooter:
          "Generated by the CAL Legal Resource Navigator. This list is for your records only and does not constitute legal advice.",
        feedbackQuestion: "Was this resource list helpful?",
        feedbackYes: "Yes",
        feedbackNo: "No",
        feedbackThanks: "Thank you for your feedback.",
        referralMapApproxMi:
          "About {{miles}} mi straight-line from your ZIP to this office (not driving distance).",
        referralMapDisclaimer:
          "Blue dot ≈ your ZIP area center; green dot ≈ one representative office used for distance. Confirm the address on the organization’s website.",
        referralMapYouZip: "Your ZIP (approx. center)",
        referralMapDrivingDirections: "Open driving directions in Google Maps",
        referralMapDirectionsOnly: "Open in Google Maps / directions",
        referralMapOpenInMaps: "Search in Google Maps",
        referralMapZipGeoFail:
          "We couldn’t look up your ZIP on the map. You can still open driving directions below.",
        referralMapLoading: "Loading map…",
      },

      accessibility: {
        largeText: "Larger text",
        largeTextOff: "Standard text",
      },

      progress: {
        stepOf: "Step {{current}} of {{total}}",
        defaultLabel: "Getting Started",
        selectTopic: "Select Topic",
        emergencyCheck: "Emergency Check",
        courtStatus: "Court Status",
        incomeLevel: "Income Level",
        problemSummary: "Your summary",
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
          "I apologize, but I encountered an error. Please try asking your question again, or contact Chicago Advocate Legal, NFP at (312) 801-5918 for direct assistance.",
      },

      emergency: {
        button: "Emergency",
        title: "Emergency Contacts",
        warning: "If you are in immediate danger, call 911 now.",
        safetyNoteTitle: "Safety note:",
        safetyNoteText:
          "If someone is monitoring your internet activity, consider calling instead of using online resources.",
        installHint:
          "If needed, open discreet mode before installing to home screen so the app appears as a neutral Resource Portal.",
        installDiscreet: "Open discreet app mode",
        installRegular: "Open regular app mode",
        quickExit: "Exit",
        callAction: "Call {{phone}}",
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
          notSure: "I don't know",
          continue: "Continue",
          restart: "Restart",
          connect: "Connect with Chicago Advocate Legal, NFP",
          continueToLegalResources: "Continue to Legal Resources",
          summaryTopicSame: "Yes — same topic I selected",
          summaryTopicChange: "No — I need a different topic",
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
          redirected:
            "It sounds like you need help with {{topicLabel}} instead. We updated your topic. Is this an emergency?",
          reconfirm:
            "This sounds more like {{inferredTopicLabel}} than {{selectedTopicLabel}}. Are you still enquiring about the same topic you selected?",
          reconfirmInvalid: "Please tap one of the buttons below to continue.",
        },

        emergency: {
          crisisDetectedBody:
            "🚨 CRISIS DETECTED\\n\\nIf you are in immediate danger, please call 911 now.\\n\\nYou can also contact:\\n- National Domestic Violence Hotline: 1-800-799-7233\\n- Illinois DV Hotline: 1-877-863-6338\\n- 988 Suicide & Crisis Lifeline: 988\\n- Illinois Child Abuse Hotline (DCFS): 1-800-252-2873\\n\\nClick the Emergency button for more resources.\\n\\nWould you like to continue?",
          invalid: "Please select an option.",
          policeNote:
            "🚨 If this is an emergency, call the police immediately at 911.\\n\\nAfter you have contacted the police, I can help you find legal resources for your situation.\\n\\nDo you currently have an open court case related to this issue?",
        },

        court: {
          prompt:
            "Do you currently have an open court case related to this issue?",
          invalid: "Please answer Yes or No.",
        },

        income: {
          prompt:
            "Are you low-income or receiving public benefits (like SNAP, Medicaid, SSI)?",
          invalid: "Please select an option.",
        },

        summary: {
          prompt:
            "In a few sentences, what is going on and what kind of help are you looking for? This summary is shared with our staff so they can assist you—not with the public.",
          invalid:
            "Please add a bit more detail (at least 15 characters) so staff can understand your situation.",
          topicMismatch:
            "Your notes sound more like {{inferredTopicLabel}} than {{selectedTopicLabel}}. Are you still enquiring about the same topic you selected?",
          topicMismatchInvalid: "Please tap one of the buttons below to continue.",
          topicChangePrompt:
            "No problem — pick the legal issue that best matches what you need help with now.",
        },

        zip: {
          prompt:
            "Please provide your Illinois ZIP code to find resources near you. You can type it inside a sentence (for example: “I live in 60612”). If you don’t have a ZIP, type Skip—or briefly explain (for example that you can’t find your address)—to see statewide Illinois resources.",
          invalid:
            "We still have you down for {{topicLabel}}. Please enter a valid 5-digit Illinois ZIP code, or type Skip for statewide resources.",
        },

        results: {
          intro:
            "Based on your situation, here are {{levelName}} resources for {{topicLabel}} in Illinois:",
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
      },

      theme: {
        useLight: "Cambiar a modo claro",
        useDark: "Cambiar a modo oscuro",
      },

      login: {
        heading: "Iniciar sesión en Chicago Advocate Legal, NFP",
        lead: "Use el mismo correo que usó al crear su cuenta con nosotros.",
        emailLabel: "Correo electrónico",
        passwordLabel: "Contraseña",
        createPassword: "Cree una contraseña (mínimo 8 caracteres)",
        confirmAccountPassword: "Confirmar contraseña (mínimo 8 caracteres)",
        passwordLoginButton: "Iniciar sesión",
        signingIn: "Iniciando sesión…",
        forgotPassword: "¿Olvidó su contraseña?",
        forgotTitle: "Restablecer contraseña",
        forgotBody: "Ingrese el correo de su cuenta y le enviaremos un enlace para restablecerla.",
        sendReset: "Enviar correo de restablecimiento",
        forgotNotice:
          "Si ese correo existe en nuestros registros, enviamos un enlace para restablecer la contraseña. Revise su bandeja de entrada.",
        resetTitle: "Elija una nueva contraseña",
        resetBody: "Ingrese y confirme su nueva contraseña.",
        newPassword: "Nueva contraseña",
        confirmPassword: "Confirmar nueva contraseña",
        savingPassword: "Guardando…",
        resetPasswordButton: "Restablecer contraseña",
        resetDone: "Contraseña actualizada. Ahora puede iniciar sesión con su correo y contraseña.",
        resetInvalid: "Este enlace de restablecimiento no es válido o venció. Solicite uno nuevo.",
        passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
        passwordMismatch: "Las contraseñas no coinciden.",
        show: "Mostrar",
        hide: "Ocultar",
        showPassword: "Mostrar contraseña",
        hidePassword: "Ocultar contraseña",
        passwordStrength: {
          weak: "Seguridad de contraseña: Débil",
          medium: "Seguridad de contraseña: Media",
          strong: "Seguridad de contraseña: Fuerte",
        },
        passwordLoginFailed: "Correo o contraseña incorrectos.",
        emailLoginButton: "Enviarme un enlace de inicio de sesión",
        sending: "Enviando…",
        or: "o",
        google: "Continuar con Google",
        apple: "Continuar con Apple",
        socialSoon: "Próximamente",
        socialSectionNote:
          "El inicio de sesión con Google y Apple aún no está disponible. Use su correo arriba por ahora.",
        checkTitle: "Revise su correo",
        checkBody:
          "Enviamos un enlace de inicio de sesión de un solo uso a {{email}}. Caduca en unos minutos. Si aún no creó una cuenta con nosotros, vuelva y elija “Crear una cuenta”.",
        resend: "Enviar otro correo de inicio de sesión",
        backToSignIn: "Volver al inicio de sesión",
        returningPrompt: "¿Ya tiene una cuenta?",
        signInWithEmail: "Iniciar sesión con correo",
        newUserPrompt: "¿Es su primera vez aquí?",
        createAccount: "Crear una cuenta",
        createAccountTitle: "Crear una cuenta",
        clientLogin: "Inicio de cliente",
        staffLogin: "Acceso de administrador",
        intakeLoginChoiceAria: "Elija inicio de sesión de cliente o de personal",
        welcomeBackTitle: "Bienvenido/a de nuevo",
        welcomeBackBody:
          "Continúe en este dispositivo o inicie sesión en otro con el mismo correo.",
        continueThisDevice: "Continuar a los recursos",
        useDifferentEmail: "Iniciar sesión con otro correo",
        signOutDevice: "Olvidar este dispositivo",
        requestFailed: "No pudimos enviar el enlace. Inténtelo más tarde.",
        verifyFailed: "Este enlace no es válido o caducó. Solicite uno nuevo.",
        devLinkLabel: "Solo desarrollo — abra este enlace para iniciar sesión:",
        resetDevLinkLabel: "Solo desarrollo — abra este enlace para restablecer su contraseña:",
        authAside: {
          ariaLabel: "Acerca de este portal",
          kicker: "Chicago Advocate Legal, NFP",
          headline: "Información legal y referencias en Illinois",
          body:
            "Un punto de entrada profesional y seguro a nuestro navegador de recursos. Ofrecemos información legal general y referencias—no asesoría legal ni relación abogado–cliente.",
          item1: "Registro guiado según su situación y recursos en Illinois",
          item2: "Referencias claras y próximos pasos según sus respuestas",
          item3: "Asistente de IA opcional para preguntas generales sobre cortes y formularios",
          item4: "Herramientas pensadas en la privacidad, incluida Salida rápida",
        },
      },

      intake: {
        title: "Antes de comenzar",
        subtitle:
          "Por favor ingrese su información para conectarle con los recursos adecuados.",
        samePersonTitle: "Bienvenido/a de nuevo",
        samePersonBody: "¿Es la misma persona que la última vez en este dispositivo?",
        samePerson: "Soy la misma persona",
        newInquiry: "Crear inicio de sesión",
        firstName: "Nombre",
        lastName: "Apellido",
        email: "Correo electrónico",
        phone: "Número de teléfono",
        zip: "Código postal (ZIP)",
        consentText:
          "No compartimos su información con terceros excepto cuando la ley lo requiera o para brindar los servicios solicitados.",
        consentRequired: "Debe aceptar para continuar.",
        submit: "Continuar",
        privacyLink: "Aviso de privacidad",
        invalidEmail: "Por favor ingrese un correo electrónico válido.",
        invalidZip: "Por favor ingrese un ZIP válido de 5 dígitos.",
        invalidPhone: "Por favor ingrese un número de teléfono válido de 10 dígitos (EE. UU.).",
        submitting: "Enviando…",
        savingDetail: "Guardando su información de forma segura…",
        retryingDetail: "Reintentando conexión…",
        successTitle: "Sesión iniciada",
        successBody:
          "Su información se guardó en este dispositivo. Puede continuar al navegador de recursos.",
        continueToPortal: "Continuar a los recursos",
        serverError:
          "Lo siento – no pudimos guardar su información. Inténtelo de nuevo.",
        duplicateAccount:
          "Ya existe una cuenta con este correo o número de teléfono. Inicie sesión o use otro correo y número para registrarse.",
      },

      privacy: {
        title: "Aviso de privacidad",
        body:
          "Recopilamos su nombre, correo electrónico, número de teléfono y el tema legal seleccionado para ayudar a dirigirle a recursos adecuados. Podemos pedir su código postal (ZIP) cuando use el navegador para mostrar opciones cercanas. No compartimos su información con terceros excepto cuando la ley lo requiera o para brindar los servicios solicitados. Puede solicitar la eliminación de sus datos contactando a la organización indicada en la app.",
        back: "Volver",
      },

      app: {
        title: "Chatbot de Información y Recursos Legales de CAL",
        subtitle: "Navegador de recursos de autoayuda",
        infoReferrals: "Información y referencias",
      },

      site: {
        footerOrg:
          "Chicago Advocate Legal, NFP — información legal y referencias en Illinois",
        footerDisclaimer:
          "Esta herramienta ofrece información legal general, no asesoría legal. No crea relación abogado–cliente.",
        footerContactLabel: "Preguntas sobre este servicio:",
        staffSignIn: "Acceso para personal",
      },

      trust: {
        title: "Qué hace esta herramienta",
        buttonLabel: "¿Qué hace esta herramienta?",
        quickLabel: "¿Qué es esto?",
        lead: "Use este navegador para conocer opciones y encontrar organizaciones que puedan ayudarle.",
        doesHeading: "Puede usarla para",
        doesNotHeading: "No puede",
        doesLines:
          "• Informarse sobre procesos judiciales y recursos en Illinois\n• Conectarse con ayuda legal y organizaciones comunitarias\n• Usar el asistente de IA para información general sobre formularios y procedimientos",
        doesNotLines:
          "• Dar asesoría legal para su caso específico\n• Representarle en la corte o predecir resultados\n• Garantizar privacidad total ante cualquier divulgación (vea el Aviso de privacidad)",
      },

      resume: {
        title: "¿Continuar la última sesión?",
        detail:
          "Hay una sesión de triage en curso en este dispositivo. Puede continuar o empezar de nuevo.",
        continueBtn: "Continuar sesión",
        startNewBtn: "Nuevo triage",
      },

      referral: {
        matchLevel1:
          "Sugerido para información legal general según sus respuestas (no garantiza servicios).",
        matchLevel2:
          "Sugerido para información de autoayuda según sus respuestas (no garantiza servicios).",
        matchLevel3:
          "Sugerido para opciones de asistencia más directa según sus respuestas (no garantiza servicios).",
      },

      glossary: {
        title: "Términos legales comunes (lenguaje sencillo)",
        intro: "Definiciones breves. Solo fines educativos.",
        terms: {
          legal_information: {
            term: "Información legal",
            def: "Explicaciones generales sobre leyes y la corte—no es consejo sobre qué hacer en su caso.",
          },
          legal_advice: {
            term: "Asesoría legal",
            def: "Orientación sobre sus derechos y qué hacer, dada por un abogado licenciado.",
          },
          pro_se: {
            term: "Pro se (por su cuenta)",
            def: "Representarse en la corte sin abogado.",
          },
          plaintiff: {
            term: "Demandante",
            def: "La persona que inicia un caso civil.",
          },
          defendant: {
            term: "Demandado",
            def: "La persona a quien se demanda en un caso civil.",
          },
          eviction: {
            term: "Desalojo (eviction)",
            def: "Proceso legal para quitar a un inquilino—las reglas varían.",
          },
          order: {
            term: "Orden judicial",
            def: "Decisión escrita de un juez que puede hacerse cumplir.",
          },
        },
      },

      resources: {
        panelTitle: "Próximos pasos y autoayuda (información general)",
        panelDisclaimer:
          "Ideas educativas—no son asesoría legal. Adapte cualquier carta a su situación.",
        nextStepsTitle: "Lista — pasos típicos",
        formsTitle: "Enlaces oficiales e información",
        letterTitle: "Carta modelo (copiar y editar)",
        letterHint:
          "Reemplace lo que está entre corchetes. Guarde una copia. No sustituye asesoría legal.",
        copyLetter: "Copiar texto",
        copied: "¡Copiado!",
        forms: {
          ilaHome: "Illinois Legal Aid Online (inicio)",
          ilaHousing: "Illinois Legal Aid — vivienda",
          ilaEducation: "Illinois Legal Aid — escuela y educación",
          ilaFamily: "Illinois Legal Aid — familia y seguridad",
          courts: "Portal de tribunales de Illinois",
          isbe: "Junta estatal de educación de Illinois",
          dcfs: "DCFS de Illinois (bienestar infantil)",
        },
        nextSteps: {
          housing:
            "1. Guarde avisos, contrato, recibos de renta y fotos de condiciones.\n2. Lea materiales de Illinois Legal Aid antes de los plazos.\n3. Si tiene fecha en corte, confirme hora y lugar.\n4. Contacte ayuda legal si puede calificar.",
          education:
            "1. Guarde planes IEP/504, correos y avisos disciplinarios.\n2. Pida registros escolares por escrito si hace falta.\n3. Anote fechas de reuniones o apelaciones.\n4. Use recursos de protección y defensa si hay derechos por discapacidad.",
          child_support:
            "1. Reúna documentos de ingresos y órdenes existentes.\n2. Use recursos de Illinois Legal Aid sobre modificaciones.\n3. Lleve registro de pagos si aplica.\n4. Pregunte al secretario del juzgado sobre formularios locales.",
          divorce:
            "1. Liste bienes y deudas; reúna documentos financieros.\n2. Infórmese sobre trámites básicos de divorcio en Illinois.\n3. Considere mediación si ambas partes acuerdan.\n4. Pregunte por educación para padres en su condado.",
          custody:
            "1. Reúna planes de crianza u órdenes vigentes.\n2. Documente tiempo con los hijos y comunicación con calma.\n3. Revise información sobre responsabilidades parentales en Illinois.\n4. Prepare preguntas si habla con ayuda legal o mediador.",
          general:
            "1. Anote fechas, plazos y nombres de agencias.\n2. Guarde copias de cartas y formularios.\n3. Confirme fechas de corte con el secretario.\n4. Llame a ayuda legal si puede calificar.",
        },
        letterTemplate: {
          housing:
            "[Fecha de hoy]\n\n[Nombre del administrador]\n[Dirección]\n\nRef: [Dirección de la unidad]\n\nEstimado/a [nombre]:\n\nEscribo sobre [problema — ej. reparaciones, aviso, arrendamiento]. Solicito [acción concreta]. Por favor responda antes del [fecha].\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
          education:
            "[Fecha de hoy]\n\n[Director/a o contacto del distrito]\n[Dirección]\n\nRef: [Nombre del estudiante, grado]\n\nEstimado/a [nombre]:\n\nSolicito [reunión / registros / aclaración] sobre [tema breve]. Confirme recepción y próximos pasos antes del [fecha].\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
          child_support:
            "[Fecha de hoy]\n\n[Agencia o tribunal si se conoce]\n[Dirección si se conoce]\n\nRef: Manutención — [caso o ID]\n\nEstimado/a [nombre]:\n\nSolicito información sobre [historial de pagos / orden / próxima audiencia]. Indique qué documentos necesita.\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
          divorce:
            "[Fecha de hoy]\n\n[Otra parte o abogado si se conoce]\n[Dirección si se conoce]\n\nRef: Divorcio\n\nEstimado/a [nombre]:\n\nEscribo sobre [tema — ej. intercambio de documentos, fechas]. Responda antes del [fecha] para [objetivo].\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
          custody:
            "[Fecha de hoy]\n\n[Otro padre/madre o abogado si aplica]\n[Dirección si se conoce]\n\nRef: Tiempo con hijos / custodia\n\nEstimado/a [nombre]:\n\nPropongo [cambio de horario o arreglo] porque [motivo breve]. Estoy dispuesto/a a [mediación / proceso en corte].\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
          general:
            "[Fecha de hoy]\n\n[Agencia o persona]\n[Dirección]\n\nRef: [Asunto]\n\nEstimado/a [nombre]:\n\nNecesito ayuda con [descripción breve]. Mi contacto está abajo. Indique los pasos o formularios requeridos.\n\nGracias,\n[Su nombre]\n[Teléfono] [Correo]",
        },
      },

      landing: {
        welcomeTitle: "Bienvenido/a al Portal de Recursos Legales",
        tagline:
          "Este chatbot conecta a residentes de Illinois con información legal y referencias para:",
        begin: "Comenzar",
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
        placeholderSummary:
          "Describa brevemente su situación con sus propias palabras (aprox. 2–4 oraciones). Esto ayuda al personal a entender sus necesidades.",
        placeholderTopicAlign:
          "Toque un botón de arriba, o escriba sí si sigue siendo el mismo tema, o no si necesita otro tema.",
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
          "⚠️ No se pudo conectar al servidor. Espere un momento para que el backend se active y luego haga clic en 'Reiniciar' para intentarlo de nuevo.",
        loadingBanner:
          "Revisando sus respuestas y preparando el siguiente paso…",
        printResources: "Imprimir mi lista de recursos",
        printTitle: "Resumen de recursos legales",
        printIntro: "Tema: {{topic}} · ZIP: {{zip}}",
        printFooter:
          "Generado por el Navegador de Recursos Legales de CAL. Esta lista es solo para sus registros y no constituye asesoría legal.",
        feedbackQuestion: "¿Le resultó útil esta lista de recursos?",
        feedbackYes: "Sí",
        feedbackNo: "No",
        feedbackThanks: "Gracias por sus comentarios.",
        referralMapApproxMi:
          "Aprox. {{miles}} mi en línea recta desde su ZIP hasta esta oficina (no es distancia en carro).",
        referralMapDisclaimer:
          "El punto azul ≈ centro de su ZIP; el verde ≈ una oficina representativa. Confirme la dirección en el sitio web de la organización.",
        referralMapYouZip: "Su ZIP (centro aproximado)",
        referralMapDrivingDirections: "Abrir indicaciones para manejar en Google Maps",
        referralMapDirectionsOnly: "Abrir en Google Maps / indicaciones",
        referralMapOpenInMaps: "Buscar en Google Maps",
        referralMapZipGeoFail:
          "No pudimos ubicar su ZIP en el mapa. Aún puede abrir indicaciones para manejar abajo.",
        referralMapLoading: "Cargando mapa…",
      },

      accessibility: {
        largeText: "Texto más grande",
        largeTextOff: "Texto estándar",
      },

      progress: {
        stepOf: "Paso {{current}} de {{total}}",
        defaultLabel: "Comenzando",
        selectTopic: "Elegir tema",
        emergencyCheck: "Emergencia",
        courtStatus: "Situación del caso",
        incomeLevel: "Ingresos",
        problemSummary: "Su resumen",
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
          "Lo siento, ocurrió un error. Intente preguntar de nuevo o contacte a Chicago Advocate Legal, NFP al (312) 801-5918 para obtener ayuda directa.",
      },

      emergency: {
        button: "Emergencia",
        title: "Contactos de emergencia",
        warning: "Si está en peligro inmediato, llame al 911 ahora.",
        safetyNoteTitle: "Nota de seguridad:",
        safetyNoteText:
          "Si alguien está monitoreando su actividad en internet, considere llamar por teléfono en lugar de usar recursos en línea.",
        installHint:
          "Si lo necesita, abra el modo discreto antes de instalar en la pantalla de inicio para que la app aparezca como un Portal de Recursos neutral.",
        installDiscreet: "Abrir modo discreto de la app",
        installRegular: "Abrir modo normal de la app",
        quickExit: "Salir",
        callAction: "Llamar al {{phone}}",
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
          unknown: "No sé",
          notSure: "No sé",
          continue: "Continuar",
          restart: "Reiniciar",
          connect: "Conectarme con Chicago Advocate Legal, NFP",
          continueToLegalResources: "Continuar a recursos legales",
          summaryTopicSame: "Sí — el mismo tema que elegí",
          summaryTopicChange: "No — necesito otro tema",
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
          redirected:
            "Parece que necesita ayuda con {{topicLabel}}. Actualizamos su tema. ¿Es una emergencia?",
          reconfirm:
            "Esto suena más a {{inferredTopicLabel}} que a {{selectedTopicLabel}}. ¿Sigue siendo el mismo tema sobre el que preguntó?",
          reconfirmInvalid: "Por favor use uno de los botones de abajo para continuar.",
        },

        emergency: {
          crisisDetectedBody:
            "🚨 SE DETECTÓ UNA CRISIS\\n\\nSi está en peligro inmediato, llame al 911 ahora.\\n\\nTambién puede comunicarse con:\\n- Línea nacional contra la violencia doméstica: 1-800-799-7233\\n- Línea de violencia doméstica de Illinois: 1-877-863-6338\\n- Línea 988 de crisis y prevención del suicidio: 988\\n- Línea de abuso infantil de Illinois (DCFS): 1-800-252-2873\\n\\nHaga clic en el botón de Emergencia para más recursos.\\n\\n¿Desea continuar?",
          invalid: "Por favor seleccione una opción.",
          policeNote:
            "🚨 Si es una emergencia, llame a la policía inmediatamente al 911.\\n\\nDespués de llamar, puedo ayudarle a encontrar recursos legales.\\n\\n¿Actualmente tiene un caso abierto en la corte relacionado con este asunto?",
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

        summary: {
          prompt:
            "En unas pocas oraciones, ¿qué está pasando y qué tipo de ayuda busca? Este resumen lo verá nuestro personal para poder ayudarle—no es público.",
          invalid:
            "Por favor agregue un poco más de detalle (al menos 15 caracteres) para que el personal entienda su situación.",
          topicMismatch:
            "Sus notas suenan más a {{inferredTopicLabel}} que a {{selectedTopicLabel}}. ¿Sigue siendo el mismo tema sobre el que preguntó?",
          topicMismatchInvalid: "Por favor use uno de los botones de abajo para continuar.",
          topicChangePrompt:
            "De acuerdo — elija el asunto legal que mejor coincida con lo que necesita ahora.",
        },

        zip: {
          prompt:
            "Por favor indique su código postal (ZIP) de Illinois para encontrar recursos cerca de usted. Puede escribirlo en una oración (por ejemplo: “vivo en 60612”). Si no tiene ZIP, escriba Omitir—o explique en pocas palabras (por ejemplo que no sabe su dirección)—para recursos de todo el estado.",
          invalid:
            "Seguimos registrando su tema como {{topicLabel}}. Indique un ZIP válido de 5 dígitos, o escriba Omitir para recursos de todo el estado.",
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