import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFService } from '../shared/services/pdf.service';

@Component({
  selector: 'app-audit-report-viewer',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title mb-4">Reporte de Auditoría</h2>
              <form [formGroup]="reportForm" (ngSubmit)="onSubmit()">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="fecha_inicio" class="form-label">Fecha Inicio</label>
                    <input type="date" class="form-control" id="fecha_inicio" formControlName="fecha_inicio" required>
                    <div class="text-danger small mt-1" *ngIf="reportForm.get('fecha_inicio')?.invalid && reportForm.get('fecha_inicio')?.touched">Requerido</div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="fecha_fin" class="form-label">Fecha Fin</label>
                    <input type="date" class="form-control" id="fecha_fin" formControlName="fecha_fin" required>
                    <div class="text-danger small mt-1" *ngIf="reportForm.get('fecha_fin')?.invalid && reportForm.get('fecha_fin')?.touched">Requerido</div>
                  </div>
                </div>
                <div class="alert alert-info small">
                  <i class="bi bi-info-circle me-1"></i> Máximo 180 días entre las fechas
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  {{ loading ? 'Generando...' : 'Generar Reporte' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
            </div>
          </div>
          <div *ngIf="pdfUrl" class="card mt-4">
            <div class="card-body">
              <iframe [src]="pdfUrl" width="100%" height="600px" style="border:none;border-radius:0.5rem"></iframe>
              <div class="mt-3">
                <a [href]="pdfUrl" download="reporte-auditoria.pdf" class="btn btn-primary">
                  <i class="bi bi-download me-1"></i> Descargar PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AuditReportViewerComponent implements OnInit {
  reportForm!: FormGroup;
  pdfUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';

  constructor(private fb: FormBuilder, private pdfService: PDFService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.reportForm = this.fb.group({
      fecha_inicio: ['', Validators.required],
      fecha_fin: ['', Validators.required]
    });
  }

  onSubmit() {
    if (!this.reportForm.valid) return;

    const fechaInicio = new Date(this.reportForm.value.fecha_inicio);
    const fechaFin = new Date(this.reportForm.value.fecha_fin);

    if (fechaFin < fechaInicio) {
      this.error = 'La fecha fin debe ser mayor o igual a la fecha inicio';
      return;
    }

    const dias = (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
    if (dias > 180) {
      this.error = 'El rango de fechas no puede exceder 180 días';
      return;
    }

    this.loading = true;
    this.error = '';

    this.pdfService.getAuditReport(
      this.reportForm.value.fecha_inicio,
      this.reportForm.value.fecha_fin
    ).subscribe(
      (blob: any) => {
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al generar el reporte';
        this.loading = false;
      }
    );
  }
}
