export type PublicLang = "ko" | "en";

type PublicSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type PublicPageContent = {
  title: string;
  description: string;
  sections: PublicSection[];
};

type PublicPageKey = "privacy" | "terms" | "support" | "deleteAccount";

export function normalizePublicLang(lang: string | undefined): PublicLang {
  return lang === "en" ? "en" : "ko";
}

export const PUBLIC_LANG_LABELS: Record<PublicLang, string> = {
  ko: "한국어",
  en: "English"
};

export const PUBLIC_PAGES_CONTENT: Record<
  PublicPageKey,
  Record<PublicLang, PublicPageContent>
> = {
  privacy: {
    ko: {
      title: "개인정보 처리방침",
      description:
        "LUCL이 현재 어떤 정보를 처리하는지와 그 목적을 간단히 안내합니다.",
      sections: [
        {
          heading: "수집 및 처리 정보",
          bullets: [
            "계정 정보: 로그인 이메일 및 인증 식별자",
            "프로필 정보: 닉네임, 프로필 이미지, 프로필 설정값",
            "학교 인증 정보: 학교 이메일, 인증 상태 및 인증 이력",
            "커뮤니티 활동 정보: 게시글, 댓글, 신고 및 운영 기록",
            "업로드 콘텐츠: 사용자가 앱에서 업로드한 이미지 등",
            "알림 관련 정보: 인앱 알림 레코드 및 참조 메타데이터"
          ]
        },
        {
          heading: "이용 목적",
          bullets: [
            "계정 접근 및 커뮤니티 핵심 기능 제공",
            "신고/운영/안전 관련 처리",
            "사용자 콘텐츠 노출 및 프로필 상태 반영",
            "장애 대응 및 사용자 문의 처리"
          ]
        },
        {
          heading: "정책 변경 가능성",
          paragraphs: [
            "서비스 기능은 운영 상황에 따라 변경될 수 있습니다.",
            "검증/커뮤니케이션 관련 일부 기능은 단계적으로 발전할 수 있으며, 이에 따라 본 문서도 갱신될 수 있습니다."
          ]
        },
        {
          heading: "문의",
          paragraphs: ["개인정보 관련 문의는 아래 Support 페이지 또는 이메일로 접수해 주세요."]
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      description:
        "This page explains what information LUCL currently handles and why.",
      sections: [
        {
          heading: "Information We Handle",
          bullets: [
            "Account data: sign-in email and authentication identifiers",
            "Profile data: display name, profile image, and profile settings",
            "School verification data: school email, verification status, and verification history",
            "Community activity: posts, comments, reports, and moderation records",
            "Uploaded content: images and other content users upload",
            "Notification-related data: in-app notification records and reference metadata"
          ]
        },
        {
          heading: "How We Use It",
          bullets: [
            "To provide account access and core community features",
            "To process safety, moderation, and report workflows",
            "To display user content and profile state",
            "To maintain service stability and handle support requests"
          ]
        },
        {
          heading: "Policy Updates",
          paragraphs: [
            "Service features may change over time.",
            "Some verification and communication workflows may evolve, and this policy may be updated accordingly."
          ]
        },
        {
          heading: "Contact",
          paragraphs: [
            "For privacy-related questions, please use the Support page or email contact."
          ]
        }
      ]
    }
  },
  terms: {
    ko: {
      title: "이용약관",
      description: "LUCL 사용 시 적용되는 기본 이용 조건입니다.",
      sections: [
        {
          heading: "허용되는 이용",
          paragraphs: [
            "사용자는 관련 법령과 커뮤니티 규칙을 준수하는 범위에서 게시, 댓글, 상호작용 기능을 이용할 수 있습니다."
          ]
        },
        {
          heading: "금지 행위",
          bullets: [
            "괴롭힘, 혐오, 위협, 욕설 등 타인에게 위해를 주는 행위",
            "스팸, 사기, 사칭, 허위/오해 유발 정보 유포",
            "무단 접근 시도, 서비스 방해 행위",
            "법령 또는 제3자 권리를 침해하는 콘텐츠 게시"
          ]
        },
        {
          heading: "계정 및 콘텐츠 책임",
          paragraphs: [
            "계정 보안 및 계정 내 활동에 대한 책임은 사용자에게 있습니다.",
            "사용자가 게시한 콘텐츠의 책임은 해당 사용자에게 있습니다."
          ]
        },
        {
          heading: "운영 및 제재",
          paragraphs: [
            "LUCL은 신고와 운영 정책에 따라 콘텐츠 제한/삭제 또는 계정 제한 조치를 적용할 수 있습니다."
          ]
        },
        {
          heading: "서비스 변경",
          paragraphs: [
            "서비스는 사전 고지 없이 일부 기능이 변경, 중단 또는 종료될 수 있습니다."
          ]
        },
        {
          heading: "문의",
          paragraphs: ["약관 관련 문의는 Support 페이지 또는 이메일로 접수해 주세요."]
        }
      ]
    },
    en: {
      title: "Terms of Service",
      description: "These are the basic terms for using LUCL.",
      sections: [
        {
          heading: "Acceptable Use",
          paragraphs: [
            "Users may use posting, commenting, and community features in compliance with laws and community rules."
          ]
        },
        {
          heading: "Prohibited Conduct",
          bullets: [
            "Harassment, hate, threats, or abusive behavior",
            "Spam, fraud, impersonation, or misleading content",
            "Unauthorized access attempts or service disruption",
            "Content that violates laws or third-party rights"
          ]
        },
        {
          heading: "Account and Content Responsibility",
          paragraphs: [
            "Users are responsible for account security and activity under their account.",
            "Users are responsible for the content they submit."
          ]
        },
        {
          heading: "Moderation and Enforcement",
          paragraphs: [
            "LUCL may apply moderation actions, including limiting/removing content or restricting accounts based on reports and policy enforcement."
          ]
        },
        {
          heading: "Service Changes",
          paragraphs: [
            "Features may be changed, suspended, or discontinued without prior notice when necessary."
          ]
        },
        {
          heading: "Contact",
          paragraphs: ["For terms-related questions, use the Support page or email contact."]
        }
      ]
    }
  },
  support: {
    ko: {
      title: "고객지원",
      description: "LUCL 이용 중 도움이 필요하면 아래 방법으로 문의해 주세요.",
      sections: [
        {
          heading: "지원 가능한 항목",
          bullets: [
            "앱 사용 방법 및 계정 접근 문제",
            "버그 제보 및 기능 개선 제안",
            "안전/신고/운영 관련 문의"
          ]
        },
        {
          heading: "문의 방법",
          paragraphs: [
            "이메일로 문의해 주세요. 빠른 확인을 위해 기기/OS 정보, 앱 버전, 재현 방법을 함께 보내 주세요."
          ]
        }
      ]
    },
    en: {
      title: "Support",
      description: "If you need help with LUCL, contact us through the channels below.",
      sections: [
        {
          heading: "What You Can Request",
          bullets: [
            "App usage help and account access issues",
            "Bug reports and feature feedback",
            "Safety, reporting, and moderation-related questions"
          ]
        },
        {
          heading: "How to Contact Us",
          paragraphs: [
            "Please contact us by email. For faster support, include device/OS details, app version, and reproduction steps."
          ]
        }
      ]
    }
  },
  deleteAccount: {
    ko: {
      title: "계정 삭제 안내",
      description: "LUCL 계정 삭제/비활성화 요청 방법을 안내합니다.",
      sections: [
        {
          heading: "앱에서 직접 처리",
          paragraphs: [
            "앱 설정의 ‘계정 삭제하기 / Delete Account’ 메뉴에서 삭제/비활성화 요청을 진행할 수 있습니다."
          ]
        },
        {
          heading: "앱 접근이 어려운 경우",
          paragraphs: [
            "앱에 로그인할 수 없는 경우 Support 이메일로 계정 삭제 요청을 접수할 수 있습니다."
          ]
        },
        {
          heading: "데이터 처리 방식",
          bullets: [
            "일부 사용자 소유 데이터는 삭제 처리될 수 있습니다.",
            "즉시 완전 삭제가 어려운 경우 일부 정보는 비식별화(익명화)/비활성화될 수 있습니다.",
            "법적 의무, 보안, 부정 이용 방지, 운영상 필요에 따라 일부 기록은 보관될 수 있습니다."
          ]
        },
        {
          heading: "추가 안내",
          paragraphs: [
            "계정 삭제 절차는 백엔드 개선에 따라 단계적으로 보완될 수 있습니다."
          ]
        }
      ]
    },
    en: {
      title: "Delete Account",
      description: "How to request account deletion/deactivation for LUCL.",
      sections: [
        {
          heading: "Delete from the App",
          paragraphs: [
            "You can request account deletion/deactivation in app settings via ‘계정 삭제하기 / Delete Account’."
          ]
        },
        {
          heading: "If You Cannot Access the App",
          paragraphs: [
            "If you cannot sign in to the app, you can request deletion through the support email."
          ]
        },
        {
          heading: "How Data Is Handled",
          bullets: [
            "Some user-owned data may be deleted during cleanup.",
            "When immediate full deletion is not operationally safe, some data may be anonymized/deactivated.",
            "Some records may be retained when required for legal, security, anti-abuse, or operational reasons."
          ]
        },
        {
          heading: "Additional Note",
          paragraphs: [
            "Deletion workflows may be improved over time as backend systems are strengthened."
          ]
        }
      ]
    }
  }
};

