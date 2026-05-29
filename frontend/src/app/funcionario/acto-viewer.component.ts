import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFService } from '../shared/services/pdf.service';

@Component({
  selector: 'app-acto-viewer',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title mb-4">Generar Acto Administrativo</h2>
              <form [formGroup]="actoForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="radicado" class="form-label">Número de Radicado</label>
                  <input type="text" class="form-control" id="radicado" formControlName="radicado" placeholder="ALC-2026-000001" required>
                  <div class="text-danger small mt-1" *ngIf="actoForm.get('radicado')?.invalid && actoForm.get('radicado')?.touched">Requerido</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Decisión</label>
                  <div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" id="aprobado" value="Aprobado" formControlName="decision" required>
                      <label class="form-check-label" for="aprobado">Aprobado</label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" id="negado" value="Negado" formControlName="decision">
                      <label class="form-check-label" for="negado">Negado</label>
                    </div>
                  </div>
                </div>
                <div class="mb-3">
                  <label for="justificacion" class="form-label">Justificación</label>
                  <textarea class="form-control" id="justificacion" formControlName="justificacion" rows="6" required></textarea>
                  <div class="text-danger small mt-1" *ngIf="actoForm.get('justificacion')?.invalid && actoForm.get('justificacion')?.touched">Requerido</div>
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  {{ loading ? 'Generando...' : 'Generar PDF' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
            </div>
          </div>
          <div *ngIf="pdfUrl" class="card mt-4">
            <div class="card-body">
              <iframe [src]="pdfUrl" width="100%" height="600px" style="border:none;border-radius:0.5rem"></iframe>
              <div class="mt-3">
                <a [href]="pdfUrl" download="acto-administrativo.pdf" class="btn btn-primary">
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
export class ActoViewerComponent implements OnInit {
  actoForm!: FormGroup;
  pdfUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private pdfService: PDFService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.actoForm = this.fb.group({
      radicado: ['', Validators.required],
      decision: ['Aprobado', Validators.required],
      justificacion: ['', Validators.required]
    });
  }

  onSubmit() {
    if (!this.actoForm.valid) return;
    this.loading = true;
    this.error = '';
    const { radicado, decision, justificacion } = this.actoForm.value;

    this.pdfService.getActoAdministrativo(radicado, decision, justificacion).subscribe(
      (blob: any) => {
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al generar el acto administrativo';
        this.loading = false;
      }
    );
  }
}
