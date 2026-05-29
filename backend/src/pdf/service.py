"""Generación de PDFs en memoria con ReportLab. No guarda nada en disco."""
import io
import re
import hashlib
from datetime import datetime, timezone

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from src.core.sanitize import sanitize_text

ALCALDIA_NOMBRE = "Alcaldía Digital de Municipio X"


def _build_pdf(elements: list, title: str, author: str = ALCALDIA_NOMBRE) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        title=title,
        author=author,
        creator=ALCALDIA_NOMBRE,
        subject="Documento Oficial — Alcaldía Digital",
    )
    doc.build(elements)
    raw = buf.getvalue()
    # Oculta versión de ReportLab en metadatos del PDF (OWASP — no exponer librerías)
    clean = re.sub(rb"/Producer \([^)]+\)", b"/Producer (Alcaldia Digital)", raw)
    return clean


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("Header", parent=ss["Title"], fontSize=16, spaceAfter=12))
    ss.add(ParagraphStyle("Sub", parent=ss["Heading2"], fontSize=12, spaceAfter=8))
    return ss


def generar_certificado_tramite(tramite: dict, ciudadano: dict) -> bytes:
    """C09 — Certificado de trámite para el ciudadano."""
    styles = _styles()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    content_str = f"{tramite['numero_radicado']}{ciudadano['nombre']}{now}"
    codigo_verificacion = hashlib.sha256(content_str.encode()).hexdigest()[:16].upper()

    elems = [
        Paragraph(sanitize_text(ALCALDIA_NOMBRE), styles["Header"]),
        Paragraph("Certificado de Trámite", styles["Sub"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Radicado:</b> {sanitize_text(tramite['numero_radicado'])}", styles["Normal"]),
        Paragraph(f"<b>Tipo:</b> {sanitize_text(tramite.get('tipo', ''))}", styles["Normal"]),
        Paragraph(f"<b>Estado actual:</b> {sanitize_text(tramite.get('estado', ''))}", styles["Normal"]),
        Paragraph(f"<b>Fecha de radicación:</b> {tramite.get('created_at', '')}", styles["Normal"]),
        Spacer(1, 0.3 * cm),
        Paragraph(f"<b>Ciudadano:</b> {sanitize_text(ciudadano.get('nombre', ''))}", styles["Normal"]),
        Paragraph(f"<b>Documento:</b> {sanitize_text(ciudadano.get('tipo_documento', 'CC'))} {sanitize_text(ciudadano.get('cedula', ''))}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Fecha de expedición:</b> {now}", styles["Normal"]),
        Paragraph(f"<b>Código de verificación:</b> {codigo_verificacion}", styles["Normal"]),
        Spacer(1, 1 * cm),
        Paragraph("<i>Este documento fue generado electrónicamente.</i>", styles["Normal"]),
    ]
    return _build_pdf(elems, f"Certificado {tramite['numero_radicado']}")


def generar_acto_administrativo(tramite: dict, ciudadano: dict, funcionario: dict, decision: str, justificacion: str) -> bytes:
    """C10 — Acto administrativo generado por el funcionario."""
    styles = _styles()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    elems = [
        Paragraph(sanitize_text(ALCALDIA_NOMBRE), styles["Header"]),
        Paragraph("Acto Administrativo", styles["Sub"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Radicado:</b> {sanitize_text(tramite['numero_radicado'])}", styles["Normal"]),
        Paragraph(f"<b>Tipo de trámite:</b> {sanitize_text(tramite.get('tipo', ''))}", styles["Normal"]),
        Spacer(1, 0.3 * cm),
        Paragraph(f"<b>Ciudadano:</b> {sanitize_text(ciudadano.get('nombre', ''))}", styles["Normal"]),
        Paragraph(f"<b>Documento:</b> {sanitize_text(ciudadano.get('tipo_documento', 'CC'))} {sanitize_text(ciudadano.get('cedula', ''))}", styles["Normal"]),
        Spacer(1, 0.3 * cm),
        Paragraph(f"<b>Decisión:</b> {sanitize_text(decision)}", styles["Normal"]),
        Paragraph(f"<b>Justificación:</b> {sanitize_text(justificacion)}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Fecha de resolución:</b> {now}", styles["Normal"]),
        Paragraph(f"<b>Funcionario:</b> {sanitize_text(funcionario.get('nombre', ''))}", styles["Normal"]),
        Paragraph(f"<b>Cargo:</b> {sanitize_text(funcionario.get('cargo', ''))}", styles["Normal"]),
        Spacer(1, 1 * cm),
        Paragraph("<i>Este acto administrativo fue generado electrónicamente.</i>", styles["Normal"]),
    ]
    return _build_pdf(
        elems,
        title=f"Acto Administrativo {tramite['numero_radicado']}",
        author=funcionario.get("nombre", ALCALDIA_NOMBRE),
    )


def generar_reporte_auditoria(registros: list[dict], fecha_inicio: str, fecha_fin: str, generado_por: str) -> bytes:
    """C11 — Reporte de auditoría de trámites en PDF."""
    styles = _styles()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    elems = [
        Paragraph(sanitize_text(ALCALDIA_NOMBRE), styles["Header"]),
        Paragraph("Reporte de Auditoría de Trámites", styles["Sub"]),
        Spacer(1, 0.3 * cm),
        Paragraph(f"<b>Rango:</b> {sanitize_text(fecha_inicio)} — {sanitize_text(fecha_fin)}", styles["Normal"]),
        Paragraph(f"<b>Generado:</b> {now}", styles["Normal"]),
        Paragraph(f"<b>Generado por:</b> {sanitize_text(generado_por)}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
    ]

    if registros:
        header = ["Radicado", "Tipo", "Estado", "Fecha", "Dependencia", "Funcionario"]
        data = [header]
        for r in registros:
            data.append([
                sanitize_text(str(r.get("radicado", ""))),
                sanitize_text(str(r.get("tipo", ""))),
                sanitize_text(str(r.get("estado", ""))),
                str(r.get("fecha", "")),
                sanitize_text(str(r.get("dependencia", ""))),
                sanitize_text(str(r.get("funcionario", ""))),
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ecf0f1")]),
        ]))
        elems.append(table)
    else:
        elems.append(Paragraph("No se encontraron trámites en el rango especificado.", styles["Normal"]))

    return _build_pdf(elems, "Reporte de Auditoría")
