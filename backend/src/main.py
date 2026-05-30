from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.auth.router import router as auth_router
from src.tramites.router import router as tramite_router
from src.mfa.router import router as mfa_router
from src.pdf.router import router as pdf_router
from src.contratos.router import router as contratos_router

app = FastAPI(title="Alcaldía Digital API — Caso C", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://amarillo.si-umng.com", "http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(tramite_router, prefix="/api", tags=["tramites"])
app.include_router(mfa_router, prefix="/api", tags=["mfa"])
app.include_router(pdf_router, prefix="/api", tags=["pdf"])
app.include_router(contratos_router, prefix="/api", tags=["contratos"])
