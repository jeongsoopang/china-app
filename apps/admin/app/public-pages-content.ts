export type PublicLang = "ko" | "en";

export type PublicSection = {
  heading: string;
  level?: 2 | 3;
  paragraphs?: string[];
  bullets?: string[];
};

type PublicPageContent = {
  title: string;
  lastUpdatedLabel: string;
  introParagraphs: string[];
  sections: PublicSection[];
};

export type PublicPageKey = "privacy" | "terms" | "support" | "deleteAccount";

export function normalizePublicLang(lang: string | string[] | undefined): PublicLang {
  const value = Array.isArray(lang) ? lang[0] : lang;
  return value === "en" ? "en" : "ko";
}

export const PUBLIC_LANG_LABELS: Record<PublicLang, string> = {
  ko: "KO",
  en: "EN"
};

const LAST_UPDATED_DATE = "2026-03-30";

export const PUBLIC_PAGES_CONTENT: Record<PublicPageKey, Record<PublicLang, PublicPageContent>> = {
  privacy: {
    ko: {
      title: "개인정보처리방침",
      lastUpdatedLabel: `최종 업데이트: ${LAST_UPDATED_DATE}`,
      introParagraphs: [
        "LUCL(이하 “서비스”)은 이용자의 개인정보를 소중하게 생각하며, 관련 법령 및 개인정보 보호 원칙을 준수하기 위해 노력합니다. 본 개인정보처리방침은 LUCL이 어떤 정보를 수집하고, 어떤 목적으로 사용하며, 어떻게 보관·삭제하는지 설명합니다."
      ],
      sections: [
        {
          heading: "1. 수집하는 정보",
          paragraphs: [
            "LUCL은 서비스 제공 및 운영을 위해 다음 정보를 수집하거나 처리할 수 있습니다."
          ]
        },
        {
          heading: "1) 계정 정보",
          level: 3,
          bullets: ["이메일 주소", "인증 및 로그인에 필요한 식별 정보"]
        },
        {
          heading: "2) 프로필 정보",
          level: 3,
          bullets: ["사용자명", "프로필 이미지", "기타 이용자가 직접 입력한 프로필 관련 정보"]
        },
        {
          heading: "3) 학교 인증 관련 정보",
          level: 3,
          bullets: ["학교 이메일 주소", "학교 인증 상태", "학교 인증 이력 및 관련 참조 정보"]
        },
        {
          heading: "4) 커뮤니티 활동 정보",
          level: 3,
          bullets: [
            "게시글, 댓글, 답글",
            "신고, 제재, 운영 검토 관련 정보",
            "좋아요, 팔로우, 알림 관련 참조 정보"
          ]
        },
        {
          heading: "5) 업로드 콘텐츠",
          level: 3,
          bullets: ["이용자가 직접 업로드한 이미지 및 기타 콘텐츠"]
        },
        {
          heading: "6) 서비스 운영 정보",
          level: 3,
          bullets: ["오류 확인, 보안 대응, 운영 안정성 점검을 위한 기술적 로그 및 참조 정보"]
        },
        {
          heading: "2. 정보를 사용하는 목적",
          paragraphs: ["LUCL은 수집한 정보를 다음 목적으로 사용합니다."],
          bullets: [
            "계정 생성, 로그인 및 서비스 이용 지원",
            "커뮤니티 기능 제공 및 사용자 콘텐츠 표시",
            "학교 인증 및 계정 상태 관리",
            "신고 처리, 운영 검토, 안전 및 악용 방지",
            "고객 문의 대응 및 서비스 개선",
            "보안, 안정성, 법적 의무 이행"
          ]
        },
        {
          heading: "3. 제3자 서비스 이용",
          paragraphs: [
            "LUCL은 서비스 운영을 위해 제3자 인프라 또는 서비스 제공자를 사용할 수 있습니다. 예를 들어 인증, 데이터 저장, 파일 저장, 이메일 전달 및 운영 도구 등이 포함될 수 있습니다. 이용자의 정보는 해당 기능 제공에 필요한 범위 내에서만 처리됩니다."
          ]
        },
        {
          heading: "4. 정보 보관 및 삭제",
          paragraphs: [
            "LUCL은 서비스 운영에 필요한 기간 동안 정보를 보관할 수 있습니다.",
            "이용자가 계정 삭제를 요청하는 경우, 관련 정보는 삭제 또는 비식별화될 수 있습니다. 다만 다음 정보는 일정 기간 보관될 수 있습니다."
          ],
          bullets: [
            "법적 의무 이행에 필요한 정보",
            "보안, 악용 방지, 분쟁 대응에 필요한 정보",
            "즉시 완전 삭제가 운영상 안전하지 않은 일부 기록"
          ]
        },
        {
          heading: "5. 이용자의 권리",
          paragraphs: ["이용자는 다음을 요청할 수 있습니다."],
          bullets: [
            "본인 정보의 열람 또는 정정",
            "계정 삭제 또는 삭제 지원 요청",
            "개인정보 처리 관련 문의"
          ]
        },
        {
          heading: "6. 계정 삭제",
          paragraphs: [
            "이용자는 앱 내 설정에서 계정 삭제를 요청할 수 있습니다.",
            "앱에 접근할 수 없는 경우, 아래 문의처로 계정 삭제 지원을 요청할 수 있습니다.",
            "문의: support@lucl.kr"
          ]
        },
        {
          heading: "7. 정책 변경",
          paragraphs: [
            "본 방침은 서비스 기능, 운영 방식, 법적 요구사항의 변화에 따라 수정될 수 있습니다. 중요한 변경이 있는 경우, LUCL은 합리적인 방법으로 이를 반영합니다."
          ]
        },
        {
          heading: "8. 문의처",
          paragraphs: [
            "개인정보 처리 또는 데이터 관련 문의는 아래로 연락해 주세요.",
            "이메일: support@lucl.kr"
          ]
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      lastUpdatedLabel: `Last Updated: ${LAST_UPDATED_DATE}`,
      introParagraphs: [
        "LUCL (“the Service”) values your privacy and strives to handle personal information responsibly and in accordance with applicable privacy principles and laws. This Privacy Policy explains what information LUCL may collect, why it is used, and how it may be stored, retained, or deleted."
      ],
      sections: [
        {
          heading: "1. Information We Collect",
          paragraphs: [
            "LUCL may collect or process the following categories of information in order to operate the Service:"
          ]
        },
        {
          heading: "1) Account Information",
          level: 3,
          bullets: ["Email address", "Authentication and sign-in related identifiers"]
        },
        {
          heading: "2) Profile Information",
          level: 3,
          bullets: [
            "Username",
            "Profile image",
            "Other profile-related information you choose to provide"
          ]
        },
        {
          heading: "3) School Verification Information",
          level: 3,
          bullets: [
            "School email address",
            "School verification status",
            "Verification history and related reference data"
          ]
        },
        {
          heading: "4) Community Activity Information",
          level: 3,
          bullets: [
            "Posts, comments, and replies",
            "Reports, moderation, and review-related data",
            "Likes, follows, and in-app notification reference data"
          ]
        },
        {
          heading: "5) Uploaded Content",
          level: 3,
          bullets: ["Images and other content you upload to the Service"]
        },
        {
          heading: "6) Service Operations Information",
          level: 3,
          bullets: [
            "Technical logs and reference data used for security, reliability, troubleshooting, and abuse prevention"
          ]
        },
        {
          heading: "2. How We Use Information",
          paragraphs: ["LUCL may use collected information to:"],
          bullets: [
            "Provide account access and core service functionality",
            "Display community content and support user interaction",
            "Manage school verification and account status",
            "Handle reports, moderation, safety, and abuse prevention",
            "Respond to support requests and improve the Service",
            "Maintain security, reliability, and compliance obligations"
          ]
        },
        {
          heading: "3. Third-Party Services",
          paragraphs: [
            "LUCL may use third-party infrastructure or service providers to operate the Service, including for authentication, data storage, file storage, email forwarding, and operational tooling. Information is processed only to the extent reasonably necessary to provide these functions."
          ]
        },
        {
          heading: "4. Data Retention and Deletion",
          paragraphs: [
            "LUCL may retain information for as long as reasonably necessary to operate the Service.",
            "If a user requests account deletion, related data may be deleted or anonymized. However, certain records may be retained where necessary for:"
          ],
          bullets: [
            "Legal compliance",
            "Security and abuse prevention",
            "Dispute handling",
            "Operational safety where immediate full deletion is not feasible"
          ]
        },
        {
          heading: "5. Your Rights",
          paragraphs: ["Users may request:"],
          bullets: [
            "Access to or correction of their information",
            "Account deletion or deletion support",
            "Answers to privacy-related inquiries"
          ]
        },
        {
          heading: "6. Account Deletion",
          paragraphs: [
            "Users may request account deletion through the in-app settings.",
            "If you cannot access the app, you may contact the support address below for deletion assistance.",
            "Contact: support@lucl.kr"
          ]
        },
        {
          heading: "7. Policy Changes",
          paragraphs: [
            "This Privacy Policy may be updated as the Service evolves or as legal and operational requirements change. Material changes will be reflected in an updated version of this page."
          ]
        },
        {
          heading: "8. Contact",
          paragraphs: [
            "For privacy or data-related requests, please contact:",
            "Email: support@lucl.kr"
          ]
        }
      ]
    }
  },
  terms: {
    ko: {
      title: "이용약관",
      lastUpdatedLabel: `최종 업데이트: ${LAST_UPDATED_DATE}`,
      introParagraphs: [
        "본 약관은 LUCL(이하 “서비스”)의 이용과 관련하여 서비스와 이용자 간의 기본적인 권리, 의무 및 책임사항을 정합니다."
      ],
      sections: [
        {
          heading: "1. 서비스 목적",
          paragraphs: [
            "LUCL은 이용자 간 커뮤니티 활동, 정보 공유, 게시글 작성, 상호작용, 학교 인증 기반 기능 등을 제공하기 위한 서비스입니다."
          ]
        },
        {
          heading: "2. 계정",
          paragraphs: [
            "이용자는 정확한 정보로 계정을 생성하고 관리해야 하며, 본인 계정의 활동에 대한 책임을 집니다. 계정 정보 및 접근 수단을 타인과 공유해서는 안 됩니다."
          ]
        },
        {
          heading: "3. 금지 행위",
          paragraphs: ["이용자는 서비스 내에서 다음 행위를 해서는 안 됩니다."],
          bullets: [
            "타인을 괴롭히거나 위협하거나 혐오를 조장하는 행위",
            "스팸, 사기, 사칭, 허위 정보 유포",
            "타인의 권리 또는 법령을 위반하는 콘텐츠 게시",
            "서비스의 정상적 운영을 방해하는 행위",
            "무단 접근, 자동화 악용, 보안 우회 시도",
            "운영 정책을 회피하거나 악용하는 행위"
          ]
        },
        {
          heading: "4. 사용자 콘텐츠",
          paragraphs: [
            "이용자는 자신이 작성하거나 업로드한 콘텐츠에 대한 책임을 집니다.",
            "LUCL은 서비스 운영, 안전 확보, 정책 집행을 위해 게시물 또는 계정에 대해 제한, 검토, 숨김, 삭제 또는 기타 조치를 취할 수 있습니다."
          ]
        },
        {
          heading: "5. 신고 및 운영 조치",
          paragraphs: [
            "LUCL은 신고 접수, 정책 위반 의심, 안전 문제, 법적 요청 등에 따라 콘텐츠 또는 계정을 검토할 수 있습니다.",
            "필요한 경우 콘텐츠 제한, 삭제, 계정 제한 또는 접근 제한 조치가 적용될 수 있습니다."
          ]
        },
        {
          heading: "6. 학교 인증 및 기타 기능",
          paragraphs: [
            "학교 인증 및 기타 특정 기능은 서비스 운영 상황에 따라 제공 방식이 변경되거나 추후 확장될 수 있습니다.",
            "LUCL은 아직 제공되지 않은 기능을 보장하지 않으며, 기능 제공 범위는 변경될 수 있습니다."
          ]
        },
        {
          heading: "7. 서비스 변경 및 중단",
          paragraphs: [
            "LUCL은 서비스 품질 개선, 운영상 필요, 보안, 법적 의무 등의 사유로 서비스의 일부 또는 전부를 변경, 중단, 종료할 수 있습니다."
          ]
        },
        {
          heading: "8. 책임 제한",
          paragraphs: [
            "LUCL은 이용자 콘텐츠의 정확성, 적법성 또는 신뢰성을 보증하지 않습니다.",
            "서비스는 가능한 범위에서 제공되며, 법령상 허용되는 범위에서 간접적 또는 특별한 손해에 대한 책임은 제한될 수 있습니다."
          ]
        },
        {
          heading: "9. 문의",
          paragraphs: [
            "약관 또는 서비스 운영에 관한 문의는 아래로 연락해 주세요.",
            "이메일: support@lucl.kr"
          ]
        }
      ]
    },
    en: {
      title: "Terms of Service",
      lastUpdatedLabel: `Last Updated: ${LAST_UPDATED_DATE}`,
      introParagraphs: [
        "These Terms of Service govern the basic rights, responsibilities, and rules applicable to your use of LUCL (“the Service”)."
      ],
      sections: [
        {
          heading: "1. Purpose of the Service",
          paragraphs: [
            "LUCL is a community-oriented service designed to support user interaction, information sharing, posting, and school-verification-related features."
          ]
        },
        {
          heading: "2. Accounts",
          paragraphs: [
            "You are responsible for maintaining accurate account information and for activities conducted through your account. You must not share access credentials or use another person’s account without authorization."
          ]
        },
        {
          heading: "3. Prohibited Conduct",
          paragraphs: ["You may not use the Service to:"],
          bullets: [
            "Harass, threaten, or promote hate against others",
            "Spam, defraud, impersonate, or mislead others",
            "Post content that violates law or the rights of others",
            "Interfere with normal service operations",
            "Attempt unauthorized access, abuse automation, or bypass security",
            "Evade or abuse moderation and service rules"
          ]
        },
        {
          heading: "4. User Content",
          paragraphs: [
            "You are responsible for the content you submit or upload.",
            "LUCL may review, limit, hide, remove, or otherwise act on content or accounts where reasonably necessary for safety, operations, or policy enforcement."
          ]
        },
        {
          heading: "5. Reports and Moderation",
          paragraphs: [
            "LUCL may review content or accounts in response to user reports, policy concerns, safety issues, or legal requests.",
            "Where appropriate, moderation actions may include content limitation, removal, account restrictions, or access limitations."
          ]
        },
        {
          heading: "6. School Verification and Feature Availability",
          paragraphs: [
            "School verification and certain other features may change as the Service evolves.",
            "LUCL does not guarantee the availability of features that are not yet fully deployed or that may be revised over time."
          ]
        },
        {
          heading: "7. Service Changes and Suspension",
          paragraphs: [
            "LUCL may modify, suspend, or discontinue part or all of the Service where necessary for product improvement, operational needs, security, or legal compliance."
          ]
        },
        {
          heading: "8. Limitation of Liability",
          paragraphs: [
            "LUCL does not guarantee the accuracy, legality, or reliability of user-generated content.",
            "To the extent permitted by law, LUCL may limit liability for indirect, incidental, or special damages arising from use of the Service."
          ]
        },
        {
          heading: "9. Contact",
          paragraphs: [
            "For questions about these Terms or the Service, please contact:",
            "Email: support@lucl.kr"
          ]
        }
      ]
    }
  },
  support: {
    ko: {
      title: "문의하기",
      lastUpdatedLabel: `최종 업데이트: ${LAST_UPDATED_DATE}`,
      introParagraphs: ["LUCL 이용 중 도움이 필요하신가요? 아래와 같은 문의를 받습니다."],
      sections: [
        {
          heading: "문의 가능한 항목",
          bullets: [
            "계정 접속 문제",
            "버그 신고",
            "기능 제안 및 피드백",
            "학교 인증 관련 문의",
            "안전 문제 및 유해 콘텐츠 신고",
            "개인정보 또는 계정 삭제 관련 요청"
          ]
        },
        {
          heading: "문의 방법",
          paragraphs: ["아래 이메일로 문의해 주세요.", "이메일: support@lucl.kr"]
        },
        {
          heading: "문의 시 함께 보내주시면 좋은 정보",
          bullets: [
            "사용 중인 기기 및 운영체제",
            "앱 버전",
            "발생한 문제 설명",
            "스크린샷 또는 화면 녹화",
            "관련 계정 이메일(필요한 경우)"
          ]
        },
        {
          heading: "안내",
          paragraphs: [
            "LUCL은 가능한 범위에서 합리적인 기간 내에 문의를 검토하고 답변하기 위해 노력합니다."
          ]
        }
      ]
    },
    en: {
      title: "Support",
      lastUpdatedLabel: `Last Updated: ${LAST_UPDATED_DATE}`,
      introParagraphs: ["Need help using LUCL? You may contact us regarding the following:"],
      sections: [
        {
          heading: "Topics You Can Contact Us About",
          bullets: [
            "Account access issues",
            "Bug reports",
            "Feature suggestions and feedback",
            "School verification inquiries",
            "Safety concerns and harmful content reports",
            "Privacy or account deletion requests"
          ]
        },
        {
          heading: "Contact Method",
          paragraphs: ["Please contact us at:", "Email: support@lucl.kr"]
        },
        {
          heading: "Helpful Information to Include",
          bullets: [
            "Device and operating system",
            "App version",
            "Description of the issue",
            "Screenshots or screen recordings",
            "Relevant account email address, if necessary"
          ]
        },
        {
          heading: "Note",
          paragraphs: [
            "LUCL will make reasonable efforts to review and respond within a reasonable time frame."
          ]
        }
      ]
    }
  },
  deleteAccount: {
    ko: {
      title: "계정 삭제 안내",
      lastUpdatedLabel: `최종 업데이트: ${LAST_UPDATED_DATE}`,
      introParagraphs: ["LUCL 이용자는 앱 내 설정에서 계정 삭제를 요청할 수 있습니다."],
      sections: [
        {
          heading: "1. 앱에서 삭제 요청",
          paragraphs: [
            "앱 설정 화면에서 계정 삭제하기를 통해 계정 삭제 또는 비활성화 절차를 시작할 수 있습니다."
          ]
        },
        {
          heading: "2. 앱에 접근할 수 없는 경우",
          paragraphs: [
            "앱에 로그인할 수 없거나 앱에 접근할 수 없는 경우, 아래 이메일로 계정 삭제 지원을 요청할 수 있습니다.",
            "이메일: support@lucl.kr"
          ]
        },
        {
          heading: "3. 삭제 시 처리될 수 있는 정보",
          paragraphs: [
            "계정 삭제 요청 시, 다음 정보는 삭제 또는 비식별화될 수 있습니다."
          ],
          bullets: [
            "프로필 정보",
            "계정 상태 정보",
            "일부 사용자 생성 정보",
            "학교 인증 상태 및 관련 참조 정보"
          ]
        },
        {
          heading: "보관될 수 있는 정보",
          bullets: [
            "법적 의무 이행에 필요한 정보",
            "보안, 악용 방지, 분쟁 대응을 위한 정보",
            "즉시 완전 삭제가 운영상 안전하지 않은 일부 기록"
          ]
        },
        {
          heading: "4. 유의사항",
          paragraphs: [
            "계정 삭제 절차는 시스템 구조 및 운영 정책의 개선에 따라 변경될 수 있습니다.",
            "LUCL은 합리적인 범위에서 삭제 또는 비식별화 조치를 수행합니다."
          ]
        }
      ]
    },
    en: {
      title: "Delete Account",
      lastUpdatedLabel: `Last Updated: ${LAST_UPDATED_DATE}`,
      introParagraphs: ["Users of LUCL may request account deletion through the in-app settings."],
      sections: [
        {
          heading: "1. Request Deletion in the App",
          paragraphs: [
            "You may start the account deletion or deactivation process through Delete Account in the app settings."
          ]
        },
        {
          heading: "2. If You Cannot Access the App",
          paragraphs: [
            "If you cannot log in to or access the app, you may request deletion assistance by contacting:",
            "Email: support@lucl.kr"
          ]
        },
        {
          heading: "3. Data That May Be Deleted or Anonymized",
          paragraphs: [
            "When an account deletion request is processed, the following categories of information may be deleted or anonymized:"
          ],
          bullets: [
            "Profile information",
            "Account status information",
            "Certain user-generated data",
            "School verification status and related reference data"
          ]
        },
        {
          heading: "Records That May Be Retained",
          paragraphs: ["However, certain records may be retained where necessary for:"],
          bullets: [
            "Legal compliance",
            "Security and abuse prevention",
            "Dispute handling",
            "Operational safety where immediate full deletion is not feasible"
          ]
        },
        {
          heading: "4. Important Note",
          paragraphs: [
            "The account deletion process may evolve as LUCL’s backend systems and operational policies improve.",
            "LUCL will take reasonable steps to delete or anonymize data where appropriate."
          ]
        }
      ]
    }
  }
};
