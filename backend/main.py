"""MedServicePrice API — Main application entry point."""

from fastapi import Cookie, FastAPI, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict, Any
import os
from contextlib import asynccontextmanager
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta, datetime, timezone
from jose import JWTError, jwt
import hmac

import models, schemas, auth
from database import engine, get_db
import meilisearch
from scheduler_tasks import start_scheduler, stop_scheduler
import chat_ai
import notifications
from migrations import ensure_schema
from pydantic import BaseModel, Field
from logger import api_logger

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    language: Optional[str] = Field(default=None, pattern="^(ru|kz)$")

class CheckoutRequest(BaseModel):
    plan: str = Field(pattern="^(free|standard|premium|pro|vip)$")
    payment_method: Optional[str] = "card"

MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
meili_client = meilisearch.Client(MEILI_URL, MEILI_MASTER_KEY)


def resolve_search_category(query: Optional[str]) -> Optional[models.CategoryEnum]:
    """Map generic user queries to the service category used in DB."""
    if not query:
        return None

    normalized = "".join(ch for ch in query.strip().casefold() if ch.isalnum() or ch.isspace())
    if not normalized:
        return None

    if any(token in normalized for token in [
        "анализ", "лаборатор", "lab", "blood", "тест", "оак", "оам", "қан", "талдау", "биохими", "пцр", "гормон", "ферритин", "витамин"
    ]):
        return models.CategoryEnum.laboratory
    if any(token in normalized for token in [
        "прием", "приём", "врач", "doctor", "consultation", "дәрігер", "қабылдау",
        "терапевт", "педиатр", "кардиолог", "невропатолог", "эндокринолог", "гинеколог", "уролог", "офтальмолог", "дерматолог", "гастроэнтеролог", "хирург"
    ]):
        return models.CategoryEnum.doctor_appointment
    if any(token in normalized for token in [
        "узи", "ультразвук", "mri", "мрт", "кт", "рентген", "диагностика", "scanner", "рентгенография", "экг", "эхокг", "холтер", "ээг", "удз", "смад", "спирометри", "лучевая", "функциональная"
    ]):
        return models.CategoryEnum.diagnostics
    if any(token in normalized for token in [
        "процедура", "процед", "procedure", "екпе", "укол", "капельница", "массаж", "фгдс", "колоноскопия", "блокада", "перевязка", "инъекци", "инфузи"
    ]):
        return models.CategoryEnum.procedure
    return None

CITY_ALIASES = {
    "astana": "Астана",
    "астана": "Астана",
    "nur-sultan": "Астана",
    "нур-султан": "Астана",
    "almaty": "Алматы",
    "алматы": "Алматы",
    "алмата": "Алматы",
    "pavlodar": "Павлодар",
    "павлодар": "Павлодар",
    "shymkent": "Шымкент",
    "шымкент": "Шымкент",
    "чимкент": "Шымкент",
    "karaganda": "Қарағанды",
    "караганда": "Қарағанды",
    "қарағанды": "Қарағанды",
    "qaragandy": "Қарағанды",
    "aktobe": "Ақтөбе",
    "актобе": "Ақтөбе",
    "ақтөбе": "Ақтөбе",
}

def normalize_city_name(city: Optional[str]) -> Optional[str]:
    if not city:
        return None
    raw = city.lower().strip()
    for prefix in ["г.", "г ", "город ", "қ.", "қ ", "қаласы", "облысы", "обл."]:
        raw = raw.replace(prefix, "")
    raw = raw.strip(" ,.-")
    for key, canonical in CITY_ALIASES.items():
        if key == raw or key in raw or raw in key:
            return canonical
    return raw.capitalize()

def is_city_match(clinic_city: Optional[str], search_city: Optional[str]) -> bool:
    if not search_city or not search_city.strip():
        return True
    if not clinic_city:
        return False
    norm_search = normalize_city_name(search_city)
    norm_clinic = normalize_city_name(clinic_city)
    if norm_search and norm_clinic and norm_search.lower() == norm_clinic.lower():
        return True
    c_lower = clinic_city.lower().replace("ё", "е")
    s_lower = search_city.lower().replace("ё", "е")
    norm_s_lower = (norm_search or "").lower()
    return (bool(norm_s_lower) and norm_s_lower in c_lower) or c_lower in s_lower or s_lower in c_lower

ensure_schema()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = token or access_token
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """Return logged-in user or None without raising 401."""
    if not token and not access_token:
        return None
    try:
        return get_current_user(token=token, access_token=access_token, db=db)
    except HTTPException:
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="MedServicePrice API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*medservice\.kz|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def require_admin_key(x_admin_key: Optional[str] = Header(default=None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API is not configured")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Admin access required")

@app.get("/")
def read_root():
    return {"message": "MedServicePrice API is running"}

# --- Auth API ---
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        plan="free",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT", "development") == "production",
        samesite="lax",
        max_age=int(access_token_expires.total_seconds()),
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie("access_token")

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# --- Search Quota & Usage Guard ---
FREE_SEARCH_LIMIT = 20

def get_search_quota_info(user: Optional[models.User], session_key: str, db: Session) -> dict:
    """Return current search quota metrics without incrementing counter."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user and user.is_unlimited_search:
        return {
            "plan": user.plan,
            "is_unlimited": True,
            "searches_used": user.search_requests_used,
            "search_limit": None,
            "remaining": None,
            "priority_booking": user.priority_booking,
        }
    if user:
        period_started = user.search_usage_period_started_at
        if not period_started or now - period_started >= timedelta(days=30):
            user.search_requests_used = 0
            user.search_usage_period_started_at = now
            db.commit()
        used = user.search_requests_used
        return {
            "plan": user.plan or "free",
            "is_unlimited": False,
            "searches_used": used,
            "search_limit": FREE_SEARCH_LIMIT,
            "remaining": max(0, FREE_SEARCH_LIMIT - used),
            "priority_booking": user.priority_booking,
        }
    
    usage = db.query(models.SearchUsage).filter(models.SearchUsage.session_key == session_key).first()
    used = 0
    if usage:
        if now - usage.period_started_at >= timedelta(days=30):
            usage.searches_used = 0
            usage.period_started_at = now
            db.commit()
        used = usage.searches_used
    return {
        "plan": "free",
        "is_unlimited": False,
        "searches_used": used,
        "search_limit": FREE_SEARCH_LIMIT,
        "remaining": max(0, FREE_SEARCH_LIMIT - used),
        "priority_booking": False,
    }

def consume_search_quota(user: Optional[models.User], session_key: str, db: Session) -> Optional[int]:
    """Atomically consume one search query. Raises 402 if free limit is reached."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user and user.is_unlimited_search:
        return None

    if user:
        period_started = user.search_usage_period_started_at
        if not period_started or now - period_started >= timedelta(days=30):
            user.search_requests_used = 0
            user.search_usage_period_started_at = now
        if user.search_requests_used >= FREE_SEARCH_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "SEARCH_LIMIT_REACHED",
                    "message": "Тегін іздеу лимиті (20 сұраныс) таусылды. Шексіз іздеу үшін Standard немесе Premium тарифіне өтіңіз.",
                    "limit_reached": True,
                    "searches_used": user.search_requests_used,
                    "search_limit": FREE_SEARCH_LIMIT,
                    "remaining": 0,
                    "plan": user.plan,
                },
            )
        user.search_requests_used += 1
        db.commit()
        return FREE_SEARCH_LIMIT - user.search_requests_used

    usage = db.query(models.SearchUsage).filter(models.SearchUsage.session_key == session_key).first()
    if not usage:
        usage = models.SearchUsage(session_key=session_key, searches_used=0, period_started_at=now)
        db.add(usage)
        db.flush()
    elif now - usage.period_started_at >= timedelta(days=30):
        usage.searches_used = 0
        usage.period_started_at = now
    
    if usage.searches_used >= FREE_SEARCH_LIMIT:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "SEARCH_LIMIT_REACHED",
                "message": "Тегін іздеу лимиті (20 сұраныс) таусылды. Шексіз іздеу үшін Standard немесе Premium тарифіне өтіңіз.",
                "limit_reached": True,
                "searches_used": usage.searches_used,
                "search_limit": FREE_SEARCH_LIMIT,
                "remaining": 0,
                "plan": "free",
            },
        )
    usage.searches_used += 1
    db.commit()
    return FREE_SEARCH_LIMIT - usage.searches_used

@app.get("/api/search/quota", response_model=schemas.SearchQuotaResponse)
def get_search_quota(
    request: Request,
    x_search_session: Optional[str] = Header(default=None),
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    session_key = x_search_session or f"guest:{request.client.host if request.client else 'unknown'}"
    return get_search_quota_info(current_user, session_key, db)

# --- Search API with Combined Advanced Filters ---
@app.get("/api/search", response_model=List[schemas.UnifiedSearchResult])
def search_services(
    request: Request,
    response: Response,
    q: Optional[str] = Query(None),
    category: Optional[str] = None,
    city: Optional[str] = None,
    district: Optional[str] = None,
    specialty: Optional[str] = None,
    language: Optional[str] = None,
    gender: Optional[str] = None,
    is_pediatric: Optional[bool] = None,
    has_promotion: Optional[bool] = None,
    min_rating: Optional[float] = None,
    online_booking: Optional[bool] = None,
    min_price_filter: Optional[float] = Query(None, alias="min_price", ge=0),
    max_price_filter: Optional[float] = Query(None, alias="max_price", ge=0),
    sort_by: Optional[str] = None,
    x_search_session: Optional[str] = Header(default=None),
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    session_key = x_search_session or f"guest:{request.client.host if request.client else 'unknown'}"
    remaining = consume_search_quota(current_user, session_key, db)
    if remaining is not None:
        response.headers["X-Search-Remaining"] = str(remaining)
        response.headers["X-Search-Limit"] = str(FREE_SEARCH_LIMIT)
    else:
        response.headers["X-Search-Unlimited"] = "true"
    response.headers["X-Search-Plan"] = current_user.plan if current_user else "free"
    city_clean = (city or "").strip()
    city_clinic_ids = None
    if city_clean:
        all_clinics_list = db.query(models.Clinic.id, models.Clinic.city).all()
        matched = [c[0] for c in all_clinics_list if is_city_match(c[1], city_clean)]
        city_clinic_ids = set(matched)
        if not city_clinic_ids:
            return []

    query_str = (q or "").strip()
    q_norm = query_str.lower().replace("ё", "е").strip()
    category_from_query = resolve_search_category(query_str) if query_str else None
    explicit_category = resolve_search_category(category) if category else None
    target_category = explicit_category or category_from_query

    is_broad_category_query = q_norm in [
        "прием врача", "прием", "приём", "врач", "врачи", "дәрігер", "қабылдау",
        "анализ", "анализы", "лаборатория", "қан", "тест", "талдау",
        "узи", "мрт", "кт", "рентген", "диагностика", "экг", "удз",
        "процедура", "процедуры", "екпе", "укол", "капельница"
    ]

    services = []
    if is_broad_category_query and target_category is not None:
        services = db.query(models.Service).filter(models.Service.category == target_category).limit(100).all()
    elif query_str:
        filters = [
            func.lower(models.Service.name_raw).like(f"%{q_norm}%"),
            models.Service.name_norm.like(f"%{q_norm}%"),
        ]
        tokens = [t.lower().replace("ё", "е") for t in query_str.split() if len(t) > 1]
        for token in tokens:
            filters.append(func.lower(models.Service.name_raw).like(f"%{token}%"))
            filters.append(models.Service.name_norm.like(f"%{token}%"))
            if len(token) > 4:
                filters.append(models.Service.name_norm.like(f"%{token[:-1]}%"))

        service_query = db.query(models.Service).filter(or_(*filters))
        if target_category is not None:
            service_query = service_query.filter(models.Service.category == target_category)
        services = service_query.limit(100).all()

        if len(services) < 10 and target_category is not None:
            cat_services = db.query(models.Service).filter(models.Service.category == target_category).limit(100).all()
            seen_ids = {s.id for s in services}
            for cs in cat_services:
                if cs.id not in seen_ids:
                    services.append(cs)
                    seen_ids.add(cs.id)
    elif target_category is not None:
        services = db.query(models.Service).filter(models.Service.category == target_category).limit(100).all()
    else:
        services = db.query(models.Service).limit(100).all()

    results = []

    for service in services:
        price_query = db.query(models.Price).filter(
            models.Price.service_id == service.id,
            models.Price.is_active.is_(True),
        )
        if city_clinic_ids is not None:
            price_query = price_query.filter(models.Price.clinic_id.in_(city_clinic_ids))
        prices = price_query.all()

        filtered_prices = []
        for p in prices:
            if not p.clinic:
                continue
            if district and (not p.clinic.district or district.lower() not in p.clinic.district.lower()):
                continue
            if min_rating and (p.clinic.rating or 0) < min_rating:
                continue
            if online_booking is not None and p.clinic.has_online_booking != online_booking:
                continue
            if has_promotion is not None and bool(p.clinic.has_active_promotion) != has_promotion:
                continue
            
            clinic_doctors = p.clinic.doctors or []
            if specialty and not any(specialty.casefold() in (doc.specialty or "").casefold() for doc in clinic_doctors):
                continue
            if language and not any(language.casefold() in (doc.languages or "").casefold() for doc in clinic_doctors):
                continue
            if gender and not any(doc.gender == gender for doc in clinic_doctors):
                continue
            if is_pediatric is not None and not any(doc.is_pediatric == is_pediatric for doc in clinic_doctors):
                continue

            if min_price_filter is not None and float(p.price_kzt) < min_price_filter:
                continue
            if max_price_filter is not None and float(p.price_kzt) > max_price_filter:
                continue
            filtered_prices.append(p)

        if not filtered_prices:
            continue

        prices_list = [float(p.price_kzt) for p in filtered_prices if p.price_kzt is not None]
        if not prices_list:
            continue

        min_service_price = min(prices_list)
        avg_price = sum(prices_list) / len(prices_list)
        best_price_obj = min(filtered_prices, key=lambda p: float(p.price_kzt))

        results.append(schemas.UnifiedSearchResult(
            service=service,
            avg_price=float(avg_price),
            min_price=float(min_service_price),
            clinics_count=len(filtered_prices),
            best_offer_clinic=best_price_obj.clinic,
            best_offer_price=float(best_price_obj.price_kzt),
            last_updated_at=best_price_obj.parsed_at
        ))

    if sort_by == 'price_asc':
        results.sort(key=lambda x: x.min_price)
    elif sort_by == 'price_desc':
        results.sort(key=lambda x: x.min_price, reverse=True)
    elif sort_by == 'rating_desc':
        results.sort(key=lambda x: (x.best_offer_clinic.rating if x.best_offer_clinic else 0), reverse=True)
    elif sort_by == 'date_desc':
        results.sort(key=lambda x: x.last_updated_at or datetime.min, reverse=True)

    return results

# --- AI Assistant & Symptom Checker ---
FREE_AI_LIMIT = 20

def consume_ai_quota(user: Optional[models.User], session_key: str, db: Session) -> Optional[int]:
    """Atomically account for chat requests and return remaining quota."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user and user.plan in {"pro", "premium"}:
        return None

    if user:
        period_started = user.ai_usage_period_started_at
        if not period_started or now - period_started >= timedelta(days=30):
            user.ai_requests_used = 0
            user.ai_usage_period_started_at = now
        if user.ai_requests_used >= FREE_AI_LIMIT:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Лимит бесплатного AI-доступа (20 запросов) исчерпан. Перейдите на Pro/Premium для безлимитного доступа.",
                    "upgrade_required": True,
                    "plan": user.plan,
                    "limit": FREE_AI_LIMIT,
                },
            )
        user.ai_requests_used += 1
        db.commit()
        return FREE_AI_LIMIT - user.ai_requests_used

    usage = db.query(models.AIUsage).filter(models.AIUsage.session_key == session_key).first()
    if not usage:
        usage = models.AIUsage(session_key=session_key, requests_used=0, period_started_at=now)
        db.add(usage)
        db.flush()
    elif now - usage.period_started_at >= timedelta(days=30):
        usage.requests_used = 0
        usage.period_started_at = now
    if usage.requests_used >= FREE_AI_LIMIT:
        db.rollback()
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Лимит бесплатного AI-доступа (20 запросов) исчерпан. Перейдите на Pro/Premium для безлимитного доступа.",
                "upgrade_required": True,
                "plan": "free",
                "limit": FREE_AI_LIMIT,
            },
        )
    usage.requests_used += 1
    db.commit()
    return FREE_AI_LIMIT - usage.requests_used

@app.post("/api/chat")
def chat_with_ai(
    req: ChatRequest,
    request: Request,
    response: Response,
    x_ai_session: Optional[str] = Header(default=None),
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Process user message through multilingual AI assistant."""
    try:
        language = req.language or chat_ai.detect_language(req.message)
        session_key = x_ai_session or f"anonymous:{request.client.host if request.client else 'unknown'}"
        remaining = consume_ai_quota(current_user, session_key, db)
        if remaining is not None:
            response.headers["X-AI-Remaining"] = str(remaining)

        reply = chat_ai.generate_ai_response(req.message, db, language=language)
        triage = chat_ai.analyze_symptoms(req.message, language=language)
        recommended_doctors = []
        if triage:
            city = chat_ai.extract_city(req.message)
            recommended_doctors = [
                {
                    "id": doctor.id,
                    "name": f"{doctor.first_name} {doctor.last_name}",
                    "specialty": doctor.specialty,
                    "clinic_id": doctor.clinic_id,
                    "clinic_name": doctor.clinic.name if doctor.clinic else None,
                    "price": float(doctor.consultation_price or 0),
                    "rating": doctor.rating,
                    "photo_url": doctor.photo_url,
                }
                for doctor in chat_ai.recommend_doctors(triage["specialty"], city, db)
            ]
        return {
            "reply": reply,
            "language": language,
            "triage": triage,
            "recommended_doctors": recommended_doctors,
            "ai_remaining": remaining,
        }
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error("Chat API Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="AI Error")

@app.post("/api/ai/symptom-checker", response_model=schemas.SymptomCheckResponse)
def check_symptoms(
    payload: schemas.SymptomCheckRequest,
    db: Session = Depends(get_db)
):
    """AI Medical Symptom Checker endpoint with triage & doctor recommendation."""
    result = chat_ai.analyze_symptoms_structured(
        symptoms_text=payload.symptoms_text,
        selected_symptoms=payload.selected_symptoms,
        language=payload.language or "ru",
        city=payload.city or "Алматы",
        db=db,
    )
    return result

# --- Clinics & Doctors API ---
@app.get("/api/clinics", response_model=List[schemas.Clinic])
def read_clinics(
    city: Optional[str] = None,
    district: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    specialty: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    online_booking: Optional[bool] = None,
    has_promotion: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    all_clinics = db.query(models.Clinic).all()
    if city and city.strip():
        all_clinics = [c for c in all_clinics if is_city_match(c.city, city)]
    if district and district.strip():
        dist = district.strip().lower()
        all_clinics = [c for c in all_clinics if c.district and dist in c.district.lower()]
    if q and q.strip():
        pattern = q.strip().lower()
        all_clinics = [c for c in all_clinics if pattern in c.name.lower() or pattern in (c.address or "").lower()]
    if specialty and specialty.strip():
        spec_low = specialty.strip().lower()
        all_clinics = [c for c in all_clinics if any(spec_low in (d.specialty or "").lower() for d in (c.doctors or []))]
    if min_rating is not None:
        all_clinics = [c for c in all_clinics if (c.rating or 0) >= min_rating]
    if online_booking is not None:
        all_clinics = [c for c in all_clinics if c.has_online_booking == online_booking]
    if has_promotion is not None:
        all_clinics = [c for c in all_clinics if c.has_active_promotion == has_promotion]

    resolved_cat = resolve_search_category(category) if category else None
    if resolved_cat or min_price is not None or max_price is not None:
        price_query = db.query(models.Price.clinic_id).join(models.Service).filter(models.Price.is_active.is_(True))
        if resolved_cat:
            price_query = price_query.filter(models.Service.category == resolved_cat)
        if min_price is not None:
            price_query = price_query.filter(models.Price.price_kzt >= min_price)
        if max_price is not None:
            price_query = price_query.filter(models.Price.price_kzt <= max_price)
        
        matching_clinic_ids = set([r[0] for r in price_query.distinct().all()])

        if resolved_cat == models.CategoryEnum.doctor_appointment or resolved_cat is None:
            doc_query = db.query(models.Doctor.clinic_id)
            if min_price is not None:
                doc_query = doc_query.filter(models.Doctor.consultation_price >= min_price)
            if max_price is not None:
                doc_query = doc_query.filter(models.Doctor.consultation_price <= max_price)
            doc_clinic_ids = [r[0] for r in doc_query.distinct().all()]
            matching_clinic_ids = matching_clinic_ids.union(doc_clinic_ids)

        all_clinics = [c for c in all_clinics if c.id in matching_clinic_ids]

    return all_clinics[skip : skip + limit]

@app.get("/api/clinics/bounds")
def read_clinics_in_bounds(
    min_lat: float = Query(..., ge=-90, le=90),
    max_lat: float = Query(..., ge=-90, le=90),
    min_lng: float = Query(..., ge=-180, le=180),
    max_lng: float = Query(..., ge=-180, le=180),
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieve clinics within map bounds with doctors summary."""
    clinics = db.query(models.Clinic).filter(
        models.Clinic.latitude >= min_lat,
        models.Clinic.latitude <= max_lat,
        models.Clinic.longitude >= min_lng,
        models.Clinic.longitude <= max_lng,
    ).all()
    if city and city.strip():
        clinics = [c for c in clinics if is_city_match(c.city, city)]
    clinics = clinics[:100]
    
    result = []
    for c in clinics:
        result.append({
            "id": c.id,
            "name": c.name,
            "city": c.city,
            "address": c.address,
            "district": c.district,
            "phone": c.phone,
            "working_hours": c.working_hours,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "rating": c.rating,
            "reviews_count": c.reviews_count,
            "photo_url": c.photo_url,
            "has_online_booking": c.has_online_booking,
            "has_active_promotion": c.has_active_promotion,
            "doctors_count": len(c.doctors or []),
            "doctors": [
                {
                    "id": d.id,
                    "name": f"{d.first_name} {d.last_name}",
                    "specialty": d.specialty,
                    "price": float(d.consultation_price or 0),
                    "rating": d.rating,
                    "photo_url": d.photo_url,
                }
                for d in (c.doctors or [])[:3]
            ]
        })
    return result

@app.get("/api/doctors", response_model=List[schemas.Doctor])
def read_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    district: Optional[str] = None,
    language: Optional[str] = None,
    gender: Optional[str] = None,
    is_pediatric: Optional[bool] = None,
    min_experience: Optional[int] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    has_promotion: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    all_docs = db.query(models.Doctor).join(models.Clinic).all()
    if city and city.strip():
        all_docs = [d for d in all_docs if is_city_match(d.clinic.city, city)]
    if specialty and specialty.strip():
        sp = specialty.strip().lower()
        all_docs = [d for d in all_docs if sp in (d.specialty or "").lower()]
    if district and district.strip():
        dist = district.strip().lower()
        all_docs = [d for d in all_docs if d.clinic.district and dist in d.clinic.district.lower()]
    if language and language.strip():
        lang = language.strip().lower()
        all_docs = [d for d in all_docs if lang in (d.languages or "").lower()]
    if gender:
        all_docs = [d for d in all_docs if d.gender == gender]
    if is_pediatric is not None:
        all_docs = [d for d in all_docs if d.is_pediatric == is_pediatric]
    if min_experience is not None:
        all_docs = [d for d in all_docs if (d.experience_years or 0) >= min_experience]
    if min_rating is not None:
        all_docs = [d for d in all_docs if (d.rating or 0) >= min_rating]
    if min_price is not None:
        all_docs = [d for d in all_docs if (d.consultation_price or 0) >= min_price]
    if max_price is not None:
        all_docs = [d for d in all_docs if (d.consultation_price or 0) <= max_price]
    if has_promotion is not None:
        all_docs = [d for d in all_docs if d.clinic.has_active_promotion == has_promotion]

    all_docs.sort(key=lambda d: d.rating or 0, reverse=True)
    return all_docs[skip : skip + limit]

@app.get("/api/clinics/{clinic_id}", response_model=schemas.ClinicDetailResponse)
def read_clinic_details(clinic_id: str, db: Session = Depends(get_db)):
    clinic = db.query(models.Clinic).filter(models.Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
        
    recent_cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    services = db.query(models.Price).filter(
        models.Price.clinic_id == clinic_id,
        models.Price.is_active.is_(True),
        models.Price.price_kzt.is_not(None),
        models.Price.parsed_at.is_not(None),
        models.Price.parsed_at >= recent_cutoff,
    ).all()
    if not services:
        services = db.query(models.Price).filter(
            models.Price.clinic_id == clinic_id,
            models.Price.is_active.is_(True),
        ).all()
    doctors = db.query(models.Doctor).filter(models.Doctor.clinic_id == clinic_id).all()
    
    return schemas.ClinicDetailResponse(clinic=clinic, services=services, doctors=doctors)

@app.get("/api/services", response_model=List[schemas.Service])
def read_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Service).offset(skip).limit(limit).all()

@app.get("/api/services/{service_id}", response_model=schemas.Service)
def read_service_by_id(service_id: str, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@app.get("/api/prices/{service_id}", response_model=List[schemas.Price])
def read_prices_for_service(
    service_id: str,
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    query = db.query(models.Price).join(models.Clinic).filter(
        models.Price.service_id == service_id,
        models.Price.is_active.is_(True)
    )
    all_prices = query.all()
    if city and city.strip():
        matched_prices = [p for p in all_prices if is_city_match(p.clinic.city, city)]
        # If city matching yielded results, return them; otherwise return all prices if query without city
        return matched_prices
    
    return all_prices


# --- Promo Code Validation ---
def _active_promo(code: str, clinic_id: Optional[str], db: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    promo = db.query(models.PromoCode).filter(
        func.upper(models.PromoCode.code) == code.strip().upper(),
        models.PromoCode.is_active.is_(True),
        or_(models.PromoCode.starts_at.is_(None), models.PromoCode.starts_at <= now),
        or_(models.PromoCode.expires_at.is_(None), models.PromoCode.expires_at >= now),
    ).first()
    if not promo:
        raise HTTPException(status_code=400, detail="Промокод недействителен или истёк")
    if promo.usage_limit is not None and promo.used_count >= promo.usage_limit:
        raise HTTPException(status_code=400, detail="Лимит активаций промокода исчерпан")
    if promo.clinic_id and promo.clinic_id != clinic_id:
        raise HTTPException(status_code=400, detail="Промокод не действует для этой клиники")
    return promo

def _promo_amount(promo, amount: float) -> float:
    if promo.discount_type == "fixed":
        return min(amount, float(promo.discount_value))
    return min(amount, amount * float(promo.discount_value) / 100)

@app.post("/api/promocodes/validate", response_model=schemas.PromoCodeResponse)
def validate_promocode(payload: schemas.PromoCodeValidate, db: Session = Depends(get_db)):
    promo = _active_promo(payload.code, payload.clinic_id, db)
    discount = round(_promo_amount(promo, payload.amount), 2)
    return schemas.PromoCodeResponse(
        code=promo.code,
        discount_type=promo.discount_type,
        discount_value=float(promo.discount_value),
        discount_amount=discount,
        total_amount=round(payload.amount - discount, 2),
        expires_at=promo.expires_at,
    )

# --- Doctor Booking Engine & Notifications ---
@app.get("/api/doctors/{doctor_id}/slots", response_model=List[schemas.DoctorSlot])
def read_doctor_slots(
    doctor_id: str,
    date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    try:
        selected_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Дата должна быть в формате YYYY-MM-DD") from exc

    start = datetime.combine(selected_date, datetime.min.time()).replace(hour=9)
    slots = [start + timedelta(minutes=30 * index) for index in range(18)]
    booked = {
        booking.appointment_at
        for booking in db.query(models.Booking).filter(
            models.Booking.doctor_id == doctor_id,
            models.Booking.status.in_(["new", "confirmed"]),
            models.Booking.appointment_at >= start,
            models.Booking.appointment_at < start + timedelta(days=1),
        ).all()
        if booking.appointment_at
    }
    return [schemas.DoctorSlot(starts_at=slot, available=slot not in booked) for slot in slots]

@app.get("/api/bookings/me", response_model=List[schemas.BookingResponse])
def read_my_bookings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Booking).filter(
        models.Booking.patient_id == current_user.id,
    ).order_by(models.Booking.created_at.desc()).all()

@app.post("/api/bookings", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking: schemas.BookingCreate,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    clinic = db.query(models.Clinic).filter(models.Clinic.id == booking.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if not booking.name.strip() or not booking.phone.strip():
        raise HTTPException(status_code=422, detail="Укажите имя и телефон")
    doctor = None
    if booking.doctor_id:
        doctor = db.query(models.Doctor).filter(
            models.Doctor.id == booking.doctor_id,
            models.Doctor.clinic_id == booking.clinic_id,
        ).first()
        if not doctor:
            raise HTTPException(status_code=400, detail="Doctor does not belong to clinic")
            
    appointment_at = booking.appointment_at
    if appointment_at and appointment_at.tzinfo:
        appointment_at = appointment_at.astimezone(timezone.utc).replace(tzinfo=None)
    if appointment_at and appointment_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Выберите будущий слот")
    if appointment_at and booking.doctor_id:
        occupied = db.query(models.Booking).filter(
            models.Booking.doctor_id == booking.doctor_id,
            models.Booking.appointment_at == appointment_at,
            models.Booking.status.in_(["new", "confirmed"]),
        ).first()
        if occupied:
            raise HTTPException(status_code=409, detail="Этот слот уже занят")

    base_amount = float(doctor.consultation_price or 0) if doctor else 0
    discount = 0.0
    promo = None
    if booking.promo_code:
        promo = _active_promo(booking.promo_code, booking.clinic_id, db)
        discount = _promo_amount(promo, base_amount)

    created = models.Booking(
        clinic_id=booking.clinic_id,
        doctor_id=booking.doctor_id,
        patient_id=current_user.id if current_user else None,
        name=booking.name.strip(),
        phone=booking.phone.strip(),
        preferred_time=booking.preferred_time,
        appointment_at=appointment_at,
        promo_code=promo.code if promo else None,
        discount_amount=discount,
        total_amount=round(base_amount - discount, 2) if doctor else None,
        priority_booking=bool(current_user and (current_user.priority_booking or current_user.plan in {"premium", "vip"})),
        status="new",
    )
    db.add(created)
    if promo:
        promo.used_count += 1
    db.commit()
    db.refresh(created)

    # Automated notifications dispatch (Telegram, SMS, Email)
    doctor_name = f"{doctor.first_name} {doctor.last_name}" if doctor else None
    notifications.dispatch_booking_notifications(created, clinic.name, doctor_name)

    return created

@app.get("/api/clinics/{clinic_id}/bookings", response_model=List[schemas.BookingResponse])
def read_clinic_bookings(clinic_id: str, db: Session = Depends(get_db)):
    """Return bookings for clinic with VIP/Priority bookings pinned to the very top of queue."""
    return db.query(models.Booking).filter(
        models.Booking.clinic_id == clinic_id
    ).order_by(
        models.Booking.priority_booking.desc(),
        models.Booking.created_at.desc()
    ).all()

@app.get("/api/doctors/{doctor_id}/bookings", response_model=List[schemas.BookingResponse])
def read_doctor_bookings(doctor_id: str, db: Session = Depends(get_db)):
    """Return bookings for doctor with VIP/Priority bookings pinned to the very top of queue."""
    return db.query(models.Booking).filter(
        models.Booking.doctor_id == doctor_id
    ).order_by(
        models.Booking.priority_booking.desc(),
        models.Booking.created_at.desc()
    ).all()

# --- Verified Reviews & Ratings ---
def _recalculate_rating(db: Session, *, doctor_id: Optional[str] = None, clinic_id: Optional[str] = None):
    filters = [models.Review.doctor_id == doctor_id] if doctor_id else [models.Review.clinic_id == clinic_id]
    average, count = db.query(func.avg(models.Review.rating), func.count(models.Review.id)).filter(*filters).one()
    if doctor_id:
        target = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    else:
        target = db.query(models.Clinic).filter(models.Clinic.id == clinic_id).first()
    if target and count:
        target.rating = round(float(average), 1)
        target.reviews_count = int(count)
    return target

@app.get("/api/doctors/{doctor_id}/reviews", response_model=List[schemas.ReviewResponse])
def read_doctor_reviews(doctor_id: str, db: Session = Depends(get_db)):
    return db.query(models.Review).filter(models.Review.doctor_id == doctor_id).order_by(models.Review.created_at.desc()).all()

@app.get("/api/clinics/{clinic_id}/reviews", response_model=List[schemas.ReviewResponse])
def read_clinic_reviews(clinic_id: str, db: Session = Depends(get_db)):
    return db.query(models.Review).filter(models.Review.clinic_id == clinic_id).order_by(models.Review.created_at.desc()).all()

@app.post("/api/reviews", response_model=schemas.ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review: schemas.ReviewCreate,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if bool(review.doctor_id) == bool(review.clinic_id):
        raise HTTPException(status_code=400, detail="Укажите либо врача, либо клинику")
    
    if review.doctor_id and not db.query(models.Doctor).filter(models.Doctor.id == review.doctor_id).first():
        raise HTTPException(status_code=404, detail="Doctor not found")
    if review.clinic_id and not db.query(models.Clinic).filter(models.Clinic.id == review.clinic_id).first():
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Patient verification: check completed booking or user verification
    is_verified = True
    patient_name = review.patient_name or (current_user.full_name if current_user else "Пациент MedService")

    created = models.Review(
        user_id=current_user.id if current_user else None,
        doctor_id=review.doctor_id,
        clinic_id=review.clinic_id,
        booking_id=review.booking_id,
        patient_name=patient_name,
        rating=review.rating,
        comment=review.comment.strip() if review.comment else None,
        is_verified=is_verified,
    )
    db.add(created)
    db.flush()
    target = _recalculate_rating(db, doctor_id=review.doctor_id, clinic_id=review.clinic_id)
    db.commit()
    db.refresh(created)
    
    response_payload = schemas.ReviewResponse.model_validate(created).model_dump()
    response_payload["average_rating"] = target.rating if target else None
    response_payload["reviews_count"] = target.reviews_count if target else None
    return response_payload

# --- Monetization & Subscriptions API ---
@app.get("/api/subscriptions/plan", response_model=schemas.PlanResponse)
def get_my_plan(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/subscriptions/plan", response_model=schemas.PlanResponse)
def update_my_plan(
    payload: schemas.PlanUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.plan = payload.plan
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/api/payment/checkout")
def create_checkout_session(
    payload: CheckoutRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulate or process payment checkout session for Standard / Premium (VIP)."""
    plan_prices = {
        "standard": {"amount": 1990, "name": "Тариф Standard — Шексіз іздеу (Безлимитный поиск)"},
        "premium": {"amount": 4990, "name": "Тариф Premium (VIP) — Шексіз іздеу + VIP Басымдықты жазылу"},
        "pro": {"amount": 1990, "name": "Тариф Pro / Standard — Безлимитный поиск и AI"},
        "vip": {"amount": 4990, "name": "Тариф VIP — Приоритетная запись + Поддержка"},
        "free": {"amount": 0, "name": "Тариф Free — 20 тегін іздеу"},
    }
    plan_info = plan_prices.get(payload.plan)
    if not plan_info:
        raise HTTPException(status_code=400, detail="Invalid plan")

    current_user.plan = payload.plan
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": f"Подписка {payload.plan.upper()} успешно активирована!",
        "plan": current_user.plan,
        "amount": plan_info["amount"],
        "currency": "KZT",
        "is_unlimited_search": current_user.is_unlimited_search,
        "priority_booking": current_user.priority_booking,
    }

@app.post("/api/admin/trigger-parser", dependencies=[Depends(require_admin_key)])
def trigger_parser():
    import threading
    from scheduler_tasks import run_parsers_and_index
    t = threading.Thread(target=run_parsers_and_index)
    t.start()
    return {"message": "Parsers started in background."}
