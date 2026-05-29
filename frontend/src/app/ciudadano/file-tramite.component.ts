import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TramitesService } from '../shared/services/tramites.service';

@Component({
  selector: 'app-file-tramite',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title mb-4">Radicar Nuevo Trámite</h2>
              <form [formGroup]="filingForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="catalogo_id" class="form-label">Tipo de Trámite</label>
                  <select class="form-control" id="catalogo_id" formControlName="catalogo_id" required>
                    <option value="">Selecciona un tipo</option>
                    <option *ngFor="let tipo of catalogo" [value]="tipo.id">{{ tipo.nombre }}</option>
                  </select>
                  <div class="text-danger small mt-1" *ngIf="filingForm.get('catalogo_id')?.invalid && filingForm.get('catalogo_id')?.touched">Requerido</div>
                </div>
                <div class="mb-3">
                  <label for="descripcion" class="form-label">Descripción (Opcional)</label>
                  <textarea class="form-control" id="descripcion" formControlName="descripcion" rows="4"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  {{ loading ? 'Radicando...' : 'Radicar Trámite' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
            </div>
          </div>
          <div class="alert alert-success mt-4" *ngIf="radicado">
            <h4>¡Trámite radicado exitosamente!</h4>
            <p>Tu número de radicado es: <strong>{{ radicado }}</strong></p>
            <p>Guarda este número para hacer seguimiento a tu trámite.</p>
            <button class="btn btn-primary" (click)="resetForm()">Radicar otro trámite</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class FileTramiteComponent implements OnInit {
  filingForm!: FormGroup;
  catalogo: any[] = [];
  loading = false;
  error = '';
  radicado = '';

  constructor(private fb: FormBuilder, private tramitesService: TramitesService) {}

  ngOnInit() {
    this.filingForm = this.fb.group({
      catalogo_id: ['', Validators.required],
      descripcion: ['']
    });
    this.loadCatalogo();
  }

  loadCatalogo() {
    this.tramitesService.getCatalogo().subscribe(
      (res: any) => {
        this.catalogo = res.tipos || [];
      },
      (err: any) => {
        this.error = 'Error al cargar los tipos de trámite';
      }
    );
  }

  onSubmit() {
    if (!this.filingForm.valid) return;
    this.loading = true;
    this.error = '';
    const { catalogo_id, descripcion } = this.filingForm.value;

    this.tramitesService.radicar(catalogo_id, descripcion).subscribe(
      (res: any) => {
        this.radicado = res.numero_radicado;
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al radicar el trámite';
        this.loading = false;
      }
    );
  }

  resetForm() {
    this.filingForm.reset();
    this.radicado = '';
    this.error = '';
  }
}
