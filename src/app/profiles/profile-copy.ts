export const profileEnglish = {
  "profileTitle": "Your profile & privacy",
  "astrologyTitle": "Optional astrology & consent",
  "save": "Save changes",
  "reload": "Reload",
  "withdraw": "Withdraw astrology consent",
  "name": "Display name",
  "bio": "Bio",
  "birthDate": "Date of birth",
  "birthPlace": "Birthplace (optional)",
  "timezone": "IANA timezone (optional; e.g. Asia/Kolkata)",
  "unknown": "Unknown birth time remains unknown. No KP calculation is performed."
} as const;
export const profileTranslations = {bn:{save:"পরিবর্তন সংরক্ষণ করুন",reload:"আবার লোড করুন"},hi:{save:"बदलाव सहेजें",reload:"फिर लोड करें"}};

export function profileCopy(language:'en'|'bn'|'hi',key:keyof typeof profileEnglish):string {
 const additional={bn:{profileTitle:'আপনার প্রোফাইল ও গোপনীয়তা',astrologyTitle:'ঐচ্ছিক জ্যোতিষ ও সম্মতি',name:'প্রদর্শিত নাম',bio:'পরিচিতি',withdraw:'জ্যোতিষের সম্মতি প্রত্যাহার',birthDate:'জন্মতারিখ'},hi:{profileTitle:'आपकी प्रोफ़ाइल और गोपनीयता',astrologyTitle:'वैकल्पिक ज्योतिष और सहमति',name:'दिखने वाला नाम',bio:'परिचय',withdraw:'ज्योतिष की सहमति वापस लें',birthDate:'जन्म तिथि'}};
 if(language==='en')return profileEnglish[key];
 const table:Partial<Record<keyof typeof profileEnglish,string>>={...profileTranslations[language],...additional[language]};return table[key]??profileEnglish[key];
}
