from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_conn
from app.routers import ingest, transactions, insights, categories, settings

app = FastAPI(title="SpendWisely API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router,       prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(insights.router,     prefix="/api/v1")
app.include_router(categories.router,   prefix="/api/v1")
app.include_router(settings.router,     prefix="/api/v1")


@app.on_event("startup")
def startup():
    get_conn()  # initialise DB and run schema migrations


@app.get("/health")
def health():
    return {"status": "ok"}
