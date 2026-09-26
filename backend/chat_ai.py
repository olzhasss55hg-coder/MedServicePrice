"""AI Chat Assistant and Medical Symptom Checker module.

Provides bilingual (Kazakh/Russian) natural language understanding,
medical symptom triage, clinic recommendations, and Gemini integration.
"""

import os
import re
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import models
import meilisearch
from logger import ai_logger

MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "")
meili_client = meilisearch.Client(MEILI_URL, MEILI_MASTER_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def detect_language(text: str) -> str:
    """Detect whether user text is in Kazakh (kz) or Russian (ru)."""
    text = text.lower().strip()
    kz_chars = set("әіңғүұқөһ")
    ru_chars = set("абвгдеёжзийклмнопрстуфхцчшщъыьэюя")
    if any(c in kz_chars for c in text):
        return "kz"
    ru_count = sum(1 for c in text if c in ru_chars)
    kz_words = ["сәлем", "дәрігер", "қанша", "бағасы", "қайда", "басым", "ішім", "жүрегім", "рахмет", "жазылу", "емхана"]
    if any(w in text for w in kz_words):
        return "kz"
    return "kz" if ru_count == 0 and any(c.isalpha() for c in text) else "ru"


def system_prompt_for(language: str) -> str:
    """Generate system prompt enforcing fluent medical guidance in chosen language."""
    if language == "kz":
        return """Сен — MedServicePrice.kz медициналық платформасының кәсіби және мейірімді AI-көмекшісісің.
Қазақ тілінде таза, сауатты әрі түсінікті жауап бер.

Ережелер:
1. Пайдаланушыға берілген дерекқордағы нақты клиникалар, бағалар және дәрігерлер бойынша көмектес. Жалған баға немесе мекенжай ойлап таппа.
2. Белгілер мен симптомдар сипатталғанда, болжамды себептерді, сәйкес дәрігер мамандығын және алғашқы диагностикалық талдауларды ұсын.
3. Әрқашан мына ескертуді қосып жаз: «⚠️ Бұл ресми диагноз емес. Жағдай нашарласа, дәрігерге немесе 103 жедел жәрдеміне жүгініңіз».
4. Емдеу курсы мен дәрі-дәрмек тағайындама.
5. Қысқа, нақты әрі нөмірленген тізіммен жауап қайтар.
"""
    return """Ты — профессиональный медицинский AI-ассистент платформы MedServicePrice.kz.
Отвечай грамотно, вежливо и понятно на русском языке.

Правила:
1. Помогай находить реальные клиники, услуги и врачей из базы данных платформы. Не выдумывай цены и адреса.
2. При описании симптомов указывай вероятные ориентиры, рекомендуемую специальность врача и базовые обследования.
3. Всегда добавляй предупреждение: «⚠️ Не является официальным диагнозом. При ухудшении состояния обратитесь к врачу или в экстренную службу 103».
4. Не назначай рецептурные препараты и схему лечения.
5. Пиши емко, структурированно, пунктами, без лишних общих фраз.
"""


SYMPTOM_RULES = [
    {
        "keywords": ["грудь", "сердце", "жүрек", "кеуде", "одышка", "ентігу", "пульс", "давление", "қысым", "тахикардия", "стенокардия"],
        "specialty": "Кардиолог",
        "causes_ru": ["Артериальная гипертензия / скачки давления", "Ишемические проявления или спазм сосудов", "Синусовая тахикардия или вегетативная дисфункция"],
        "causes_kz": ["Артериялық гипертензия / қан қысымының өзгеруі", "Жүрек-қантамыр спазмы", "Синусты тахикардия немесе вегетативті дисфункция"],
        "tests_ru": ["ЭКГ (электрокардиограмма) с расшифровкой", "ЭхоКГ (УЗИ сердца)", "Суточное мониторирование ЭКГ (Холтер)", "Липидограмма и биохимия крови"],
        "tests_kz": ["ЭКГ (электрокардиограмма)", "ЭхоКГ (Жүрек УДЗ)", "Холтерлік тәуліктік мониторинг", "Липидограмма және қан биохимиясы"],
    },
    {
        "keywords": ["голов", "басым", "мигрень", "бас ауыру", "бас айналу", "головокружение", "шум в ушах", "құлақ шуыл", "бессонница", "ұйқысыздық"],
        "specialty": "Невропатолог",
        "causes_ru": ["Головная боль напряжения или цервикокраниалгия", "Мигрень с аурой или без", "Цереброваскулярные изменения / колебания АД", "Остеохондроз шейного отдела"],
        "causes_kz": ["Кернеулі бас ауруы", "Мигрень", "Ми қантамырларының қысылуы", "Мойын омыртқасының остеохондрозы"],
        "tests_ru": ["МРТ головного мозга или сосудов шеи", "УЗДГ сосудов шеи и головы", "ЭЭГ (электроэнцефалография)", "Осмотр глазного дна"],
        "tests_kz": ["Бас миының МРТ диагностикасы", "Мойын мен бас қантамырларының УЗДГ", "ЭЭГ (электроэнцефалография)", "Көз түбін тексеру"],
    },
    {
        "keywords": ["живот", "ішім", "іш ау", "тошнот", "жүрек айну", "асқазан", "желудок", "изжога", "қыжыл", "гастрит", "диарея", "іш өту", "запор"],
        "specialty": "Гастроэнтеролог",
        "causes_ru": ["Гастрит или гастродуоденит", "Гастроэзофагеальная рефлюксная болезнь (ГЭРБ)", "Дискинезия желчевыводящих путей или холецистит", "Синдром раздраженного кишечника"],
        "causes_kz": ["Гастрит немесе гастродуоденит", "Гастроэзофагеалды рефлюкс (қыжыл)", "Өт қабының қабынуы немесе дискинезиясы", "Тітіркенген ішек синдромы"],
        "tests_ru": ["УЗИ органов брюшной полости", "ФГДС (гастроскопия)", "Биохимия крови (АЛТ, АСТ, билирубин, амилаза)", "Анализ кала на скрытую кровь"],
        "tests_kz": ["Іш қуысы ағзаларының УДЗ", "ФГДС (гастроскопия)", "Қан биохимиясы (АЛТ, АСТ, билирубин)", "Нәжіс талдауы"],
    },
    {
        "keywords": ["горло", "нос", "ухо", "тамақ", "мұрын", "құлақ", "гайморит", "ангина", "тонзиллит", "отит", "насморк", "мұрын бітелу"],
        "specialty": "Отоларинголог (ЛОР)",
        "causes_ru": ["Острый фарингит / тонзиллит", "Острый риносинусит или гайморит", "Отит наружного или среднего уха", "Аллергический ринит"],
        "causes_kz": ["Жіті фарингит немесе тонзиллит", "Риносинусит / гайморит", "Отит (құлақ қабынуы)", "Аллергиялық ринит"],
        "tests_ru": ["Осмотр ЛОР-органов (видеоэндоскопия)", "Рентген / КТ придаточных пазух носа", "Общий анализ крови (ОАК) с лейкоформулой", "Мазок из зева на флору"],
        "tests_kz": ["ЛОР мүшелерін эндоскопиялық қарау", "Мұрын қойнауларының рентгені/КТ", "Жалпы қан талдауы (ОАК)", "Тамақтан бактериологиялық жағынды"],
    },
    {
        "keywords": ["кашель", "жөтел", "өкпе", "легкие", "бронхит", "пневмония", "хрип", "сырыл", "тыныс", "мокрота", "қақырық"],
        "specialty": "Пульмонолог",
        "causes_ru": ["Острый или обструктивный бронхит", "Пневмония легких", "Бронхиальная астма или аллергический трахеит", "Постинфекционный кашлевой синдром"],
        "causes_kz": ["Жіті немесе обструктивті бронхит", "Өкпе қабынуы (пневмония)", "Бронх демікпесі", "Жұқпадан кейінгі созылмалы жөтел"],
        "tests_ru": ["КТ органов грудной клетки (легкие)", "Спирометрия (функция внешнего дыхания)", "Общий анализ крови + С-реактивный белок (СРБ)", "Микроскопия мокроты"],
        "tests_kz": ["Кеуде қуысының КТ диагностикасы", "Спирометрия (тыныс алу қызметі)", "Жалпы қан талдауы және С-реактивті ақуыз (СРБ)", "Қақырық талдауы"],
    },
    {
        "keywords": ["сыпь", "бөртпе", "қышыма", "зуд", "тері", "кожа", "пятна", "дерматит", "экзема", "акне", "угри", "аллергия"],
        "specialty": "Дерматолог",
        "causes_ru": ["Аллергический контактный дерматит", "Экзема или псориаз", "Атопический дерматит", "Акне и угревая сыпь"],
        "causes_kz": ["Аллергиялық байланыс дерматиті", "Экзема немесе псориаз", "Атопиялық дерматит", "Акне және безеу"],
        "tests_ru": ["Дерматоскопия новообразований и сыпи", "Аллергопанель (IgE общий и специфический)", "Соскоб кожи на грибы и флору", "Общий анализ крови"],
        "tests_kz": ["Дерматоскопиялық тексеру", "Аллергопанель (жалпы және арнайы IgE)", "Тері қырындысын микроскопиялау", "Жалпы қан талдауы"],
    },
    {
        "keywords": ["сустав", "буын", "тізе", "колено", "бел", "спина", "поясница", "плечо", "иық", "артроз", "артрит", "остеохондроз", "травма"],
        "specialty": "Травматолог-ортопед",
        "causes_ru": ["Деформирующий остеоартроз суставов", "Артрит или воспаление околосуставных тканей", "Дегенеративные изменения позвоночника (протрузии/грыжи)", "Посттравматическое повреждение связок"],
        "causes_kz": ["Буын остеоартрозы", "Артрит немесе сіңір қабынуы", "Омыртқа жарығы / остеохондроз", "Байламдардың жарақаттануы"],
        "tests_ru": ["МРТ или Рентген пораженного сустава / отдела позвоночника", "УЗИ суставов", "Ревмопробы (СРБ, РФ, мочевая кислота)", "Общий анализ крови"],
        "tests_kz": ["Зақымдалған буын немесе омыртқаның МРТ/Рентгені", "Буын УДЗ", "Ревмосынамалар (СРБ, ревматоидты фактор, несеп қышқылы)", "Жалпы қан талдауы"],
    },
    {
        "keywords": ["слабость", "әлсіздік", "шаршау", "щитовидка", "қалқанша", "қант", "сахар", "жажда", "сусау", "гормон", "похудение", "салмақ"],
        "specialty": "Эндокринолог",
        "causes_ru": ["Нарушение функции щитовидной железы (гипотиреоз / тиреотоксикоз)", "Нарушение толерантности к глюкозе / Сахарный диабет", "Дефицит витамина D или ферритина (анемия)"],
        "causes_kz": ["Қалқанша безінің қызметінің бұзылуы (гипотиреоз)", "Глюкозаға төзімділіктің төмендеуі / Қант диабеті", "D дәрумені немесе ферритин жетіспеушілігі (анемия)"],
        "tests_ru": ["УЗИ щитовидной железы", "Анализ на ТТГ, Т3 св., Т4 св., Анти-ТПО", "Глюкоза крови и гликированный гемоглобин (HbA1c)", "Ферритин и Витамин D (25-OH)"],
        "tests_kz": ["Қалқанша безінің УДЗ", "ТТГ, еркін Т4, Анти-ТПО гормондары", "Қандағы глюкоза және гликирленген гемоглобин", "Ферритин және D дәрумені"],
    },
    {
        "keywords": ["почки", "бүйрек", "цистит", "несеп", "моча", "простата", "мочеиспускание", "қуық"],
        "specialty": "Уролог",
        "causes_ru": ["Острый или хронический цистит", "Пиелонефрит или нефролитиаз (камни в почках)", "Простатит или гиперплазия предстательной железы"],
        "causes_kz": ["Цистит (қуық қабынуы)", "Пиелонефрит немесе бүйрек тастары", "Простатит"],
        "tests_ru": ["УЗИ почек, надпочечников и мочевого пузыря", "ТРУЗИ предстательной железы (для мужчин)", "Общий анализ мочи (ОАМ) + Нечипоренко", "Креатинин и мочевина крови"],
        "tests_kz": ["Бүйрек пен қуықтың УДЗ", "Қуық асты безінің ТРУДЗ", "Жалпы зәр талдауы (ОАМ)", "Қан креатинині мен мочевинасы"],
    },
    {
        "keywords": ["әйел", "гинеколог", "менструация", "етеккір", "беременность", "жүктілік", "яичник", "матка"],
        "specialty": "Гинеколог",
        "causes_ru": ["Дисфункция яичников или нарушение цикла", "Воспалительные заболевания органов малого таза", "Эндометриоз или миома"],
        "causes_kz": ["Аналық без қызметінің бұзылуы", "Кіші жамбас ағзаларының қабынуы", "Эндометриоз немесе миома"],
        "tests_ru": ["УЗИ органов малого таза", "Осмотр гинеколога + мазок на онкоцитологию (Пап-тест)", "Гормональный профиль (ФСГ, ЛГ, Эстрадиол, Пролактин)"],
        "tests_kz": ["Кіші жамбас ағзаларының УДЗ", "Гинеколог тексеруі және онкоцитологиялық жағынды", "Гормондар талдауы"],
    },
    {
        "keywords": ["бала", "баланың", "сәби", "ребенок", "детский", "малыш", "педиатр"],
        "specialty": "Педиатр",
        "causes_ru": ["Острая респираторная вирусная инфекция (ОРВИ)", "Функциональные расстройства детского возраста", "Аллергическая реакция детского возраста"],
        "causes_kz": ["Жіті респираторлы вирустық инфекция (ЖРВИ)", "Балалардың функционалдық бейімделуі", "Балалар аллергиялық реакциясы"],
        "tests_ru": ["Осмотр педиатра", "Общий анализ крови (ОАК) с микроскопией", "Общий анализ мочи (ОАМ)"],
        "tests_kz": ["Педиатр қарауы", "Жалпы қан талдауы (ОАК)", "Жалпы зәр талдауы (ОАМ)"],
    }
]


def analyze_symptoms(message: str, language: str = "ru") -> Optional[Dict[str, Any]]:
    """Analyze symptoms string and return triage dictionary."""
    normalized = message.lower()
    rule = next((item for item in SYMPTOM_RULES if any(keyword in normalized for keyword in item["keywords"])), None)
    if not rule:
        # Fallback to general practitioner / терапевт
        is_kz = language == "kz"
        return {
            "specialty": "Терапевт",
            "possible_causes": [
                "Жалпы шаршау немесе вирустық белгілер" if is_kz else "Общее переутомление или начальные проявления инфекции",
                "Иммунитет әлсіреуі" if is_kz else "Снижение иммунного статуса"
            ],
            "recommended_examinations": [
                "Жалпы қан талдауы (ОАК)" if is_kz else "Общий анализ крови (ОАК) с лейкоформулой",
                "Терапевт дәрігерінің алғашқы қарауы" if is_kz else "Первичная консультация врача-терапевта"
            ],
            "disclaimer": "Бұл ресми диагноз емес. Жағдай нашарласа, дәрігерге немесе жедел жәрдемге жүгініңіз." if is_kz else "Не является официальным диагнозом. При ухудшении состояния обратитесь к врачу или в экстренную службу.",
        }

    is_kz = language == "kz"
    return {
        "specialty": rule["specialty"],
        "possible_causes": rule["causes_kz" if is_kz else "causes_ru"],
        "recommended_examinations": rule["tests_kz" if is_kz else "tests_ru"],
        "disclaimer": "Бұл ресми диагноз емес. Жағдай нашарласа, дәрігерге немесе 103 жедел жәрдеміне жүгініңіз." if is_kz else "Не является официальным диагнозом. При ухудшении состояния обратитесь к врачу или в экстренную службу 103.",
    }


def analyze_symptoms_structured(symptoms_text: Optional[str], selected_symptoms: List[str], language: str = "ru", city: str = "Алматы", db: Optional[Session] = None) -> Dict[str, Any]:
    """Complete Symptom Checker processing for Module 11."""
    combined_text = f"{symptoms_text or ''} {' '.join(selected_symptoms)}".strip()
    triage = analyze_symptoms(combined_text, language=language) or {
        "specialty": "Терапевт",
        "possible_causes": ["Общее недомогание" if language != "kz" else "Жалпы әлсіздік"],
        "recommended_examinations": ["ОАК" if language != "kz" else "ЖҚТ"],
        "disclaimer": "Бұл ресми диагноз емес / Не является официальным диагнозом.",
    }

    doctors_list = []
    if db:
        recommended = recommend_doctors(triage["specialty"], city, db)
        for doc in recommended:
            doctors_list.append({
                "id": doc.id,
                "name": f"{doc.first_name} {doc.last_name}",
                "specialty": doc.specialty,
                "clinic_id": doc.clinic_id,
                "clinic_name": doc.clinic.name if doc.clinic else None,
                "price": float(doc.consultation_price or 0),
                "rating": doc.rating,
                "photo_url": doc.photo_url,
                "city": doc.clinic.city if doc.clinic else city,
            })

    is_kz = language == "kz"
    analysis_text = (
        f"Сіздің белгілеріңіз бойынша бастапқы ұсыныс: **{triage['specialty']}** қарауы қажет.\n\n"
        f"🔍 **Болжамды жағдайлар:** {', '.join(triage['possible_causes'])}\n"
        f"🧪 **Ұсынылатын талдаулар:** {', '.join(triage['recommended_examinations'])}\n\n"
        f"⚠️ {triage['disclaimer']}"
    ) if is_kz else (
        f"На основе указанных симптомов рекомендуется консультация специалиста: **{triage['specialty']}**.\n\n"
        f"🔍 **Возможные ориентиры:** {', '.join(triage['possible_causes'])}\n"
        f"🧪 **Рекомендуемые обследования:** {', '.join(triage['recommended_examinations'])}\n\n"
        f"⚠️ {triage['disclaimer']}"
    )

    return {
        "potential_conditions": triage["possible_causes"],
        "specialty": triage["specialty"],
        "recommended_examinations": triage["recommended_examinations"],
        "disclaimer": triage["disclaimer"],
        "recommended_doctors": doctors_list,
        "ai_analysis": analysis_text,
    }


def recommend_doctors(specialty: str, city: Optional[str], db: Session):
    """Find top verified active doctors matching specialty in selected city."""
    query = db.query(models.Doctor).join(models.Clinic).filter(models.Doctor.specialty.ilike(f"%{specialty}%"))
    if city:
        query = query.filter(models.Clinic.city.ilike(f"%{city}%"))
    return query.order_by(models.Doctor.rating.desc(), models.Doctor.reviews_count.desc()).limit(4).all()


def extract_city(text: str) -> Optional[str]:
    """Extract Kazakhstan city from natural text."""
    cities = [
        "Алматы", "Астана", "Шымкент", "Павлодар", "Актобе", "Караганда", "Қарағанды",
        "Атырау", "Тараз", "Усть-Каменогорск", "Өскемен", "Семей", "Кызылорда", "Қызылорда",
        "Орал", "Костанай", "Қостанай", "Петропавловск", "Петропавл", "Актау", "Ақтау", "Талдыкорган", "Түркістан", "Кокшетау"
    ]
    text_lower = text.lower()
    for city in cities:
        city_root = city.lower()[:-1] if len(city) > 5 else city.lower()
        if city_root in text_lower:
            return city
    return None


def extract_service_keyword(text: str, db: Session) -> Optional[str]:
    """Extract medical service keywords from query."""
    text_lower = text.lower()
    synonyms = {
        "мрт": ["мрт", "mrt", "томография"],
        "кт": ["кт", "kt", "компьютерная"],
        "узи": ["узи", "uzi", "ультразвук", "удз"],
        "оак": ["оак", "қан", "кровь", "анализ крови", "қан талдауы"],
        "терапевт": ["терапевт", "врач", "дәрігер", "прием терапевта"],
        "лор": ["лор", "оториноларинголог", "ухо", "горло", "нос", "құлақ", "мұрын"],
        "гинеколог": ["гинеколог", "әйелдер дәрігері"],
        "уролог": ["уролог", "ерлер дәрігері"],
        "кардиолог": ["кардиолог", "жүрек", "сердце", "давление"],
        "рентген": ["рентген", "снимок", "xray"],
        "экг": ["экг", "кардиограмма", "эхокг"],
        "фгдс": ["фгдс", "гастроскопия", "зонд"],
    }
    for key, syn_list in synonyms.items():
        for syn in syn_list:
            if re.search(r'\b' + re.escape(syn) + r'\w*', text_lower):
                return key
    return None


def get_best_clinic_for_service(service_name: str, city: Optional[str], db: Session):
    """Find best clinic offer for service by rating & price."""
    try:
        services = db.query(models.Service).filter(models.Service.name_norm.ilike(f"%{service_name}%")).all()
        if not services:
            services = db.query(models.Service).filter(models.Service.name_raw.ilike(f"%{service_name}%")).all()
        if not services:
            return None, None
        service = services[0]
        query = db.query(models.Price).filter(models.Price.service_id == service.id, models.Price.is_active.is_(True))
        if city:
            query = query.join(models.Clinic).filter(models.Clinic.city.ilike(f"%{city}%"))
        prices = query.all()
        if not prices:
            return service, None
        best_price = min(prices, key=lambda p: float(p.price_kzt or 999999))
        return service, best_price
    except Exception as exc:
        ai_logger.warning("Clinic recommendation error: %s", exc)
        return None, None


def get_top_clinics_in_city(city: str, db: Session):
    return db.query(models.Clinic).filter(models.Clinic.city.ilike(f"%{city}%")).order_by(models.Clinic.rating.desc()).limit(3).all()


def build_db_context(db: Session) -> str:
    """Serialize current DB snapshot into AI prompt context."""
    clinics = db.query(models.Clinic).limit(25).all()
    ctx = "БАЗА ДАННЫХ КЛИНИК И ВРАЧЕЙ (Казахстан):\n"
    for c in clinics:
        ctx += f"Клиника: [{c.name}](/clinics/{c.id}) (ID: {c.id}), Город: {c.city}, Адрес: {c.address}, Рейтинг: {c.rating}\n"
        if c.doctors:
            for d in c.doctors[:3]:
                ctx += f"  - Врач: {d.first_name} {d.last_name} ({d.specialty}), Стаж: {d.experience_years} лет, Прием: {d.consultation_price} ₸, Рейтинг: {d.rating}\n"
    return ctx


def ask_gemini(message: str, db: Session, language: str = "ru") -> str:
    """Query Gemini 2.0 with prompt and clinic context."""
    system_prompt = system_prompt_for(language)
    context = build_db_context(db)
    full_prompt = f"{system_prompt}\n\n{context}\n\nСұрақ/Вопрос: {message}"

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt,
        )
        return response.text
    except Exception as e:
        ai_logger.error("Gemini API Error: %s", e)
        return (
            "🤖 AI серверінде қате кетті. Кейінірек қайталап көріңіз."
            if language == "kz"
            else "🤖 Ошибка AI-сервера. Попробуйте ещё раз позже."
        )


def generate_ai_response(message: str, db: Session, language: Optional[str] = None) -> str:
    """Generate bilingual AI response with DB lookup and fallback."""
    message = message.strip()
    lang = language or detect_language(message)
    if not message or len(message) > 2000:
        return "Сұрауды 1-ден 2000 таңбаға дейін жазыңыз." if lang == "kz" else "Сформулируйте запрос длиной от 1 до 2000 символов."

    if GEMINI_API_KEY:
        return ask_gemini(message, db, language=lang)

    # Hybrid local lookup
    message_lower = message.lower()
    doctors = db.query(models.Doctor).all()
    found_doc = next((d for d in doctors if d.last_name.lower() in message_lower and len(d.last_name) > 3), None)

    if found_doc:
        clinic = db.query(models.Clinic).filter(models.Clinic.id == found_doc.clinic_id).first()
        clinic_name = clinic.name if clinic else "Клиника"
        clinic_addr = clinic.address if clinic else ""
        if lang == "kz":
            return (
                f"👨‍⚕️ **{found_doc.first_name} {found_doc.last_name}** ({found_doc.specialty}):\n"
                f"🏥 **[{clinic_name}](/clinics/{found_doc.clinic_id})**\n"
                f"📍 {clinic_addr}\n"
                f"💰 Қабылдау құны: **{found_doc.consultation_price} ₸**\n"
                f"⭐ Рейтинг: **{found_doc.rating}** ({found_doc.experience_years} жыл тәжірибе)"
            )
        return (
            f"👨‍⚕️ **{found_doc.first_name} {found_doc.last_name}** ({found_doc.specialty}):\n"
            f"🏥 **[{clinic_name}](/clinics/{found_doc.clinic_id})**\n"
            f"📍 {clinic_addr}\n"
            f"💰 Прием: **{found_doc.consultation_price} ₸**\n"
            f"⭐ Рейтинг: **{found_doc.rating}** (Стаж {found_doc.experience_years} лет)"
        )

    city = extract_city(message)
    service_keyword = extract_service_keyword(message, db)

    if service_keyword:
        service, best_price = get_best_clinic_for_service(service_keyword, city, db)
        if service and best_price and best_price.clinic:
            if lang == "kz":
                return (
                    f"**{service.name_raw}** үшін ең тиімді клиника:\n"
                    f"🏥 **[{best_price.clinic.name}](/clinics/{best_price.clinic.id})**\n"
                    f"📍 {best_price.clinic.address} ({best_price.clinic.city})\n"
                    f"💰 Бағасы: **{best_price.price_kzt} ₸**\n"
                    f"⭐ Клиника рейтингі: **{best_price.clinic.rating}/5.0**"
                )
            return (
                f"Лучшее предложение для услуги **{service.name_raw}**:\n"
                f"🏥 **[{best_price.clinic.name}](/clinics/{best_price.clinic.id})**\n"
                f"📍 {best_price.clinic.address} ({best_price.clinic.city})\n"
                f"💰 Цена: **{best_price.price_kzt} ₸**\n"
                f"⭐ Рейтинг клиники: **{best_price.clinic.rating}/5.0**"
            )

    if city:
        clinics = get_top_clinics_in_city(city, db)
        if clinics:
            header = f"**{city}** қаласындағы таңдаулы клиникалар:\n" if lang == "kz" else f"Популярные клиники в городе **{city}**:\n"
            for c in clinics:
                header += f"- 🏥 **[{c.name}](/clinics/{c.id})** — {c.address} (⭐ {c.rating}/5.0)\n"
            return header

    return (
        "Сұрағыңызды нақтылай түсіңіз. Мысалы: «Алматыда кардиолог», «Астанада МРТ бағасы» немесе өз белгілеріңізді жазыңыз."
        if lang == "kz"
        else "Уточните ваш запрос. Например: «Кардиолог в Алматы», «Цена на МРТ в Астане» или опишите ваши симптомы."
    )
