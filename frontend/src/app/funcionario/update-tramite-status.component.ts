import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TramitesService } from '../shared/services/tramites.service';

@Component({
  selector: 'app-update-tramite-status',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title mb-4">Actualizar Estado de Trámite</h2>
              <div class="alert alert-info" *ngIf="tramite">
                <p><strong>Radicado:</strong> {{ tramite.numero_radicado }}</p>
                <p><strong>Tipo:</strong> {{ tramite.tipo }}</p>
                <p><strong>Estado Actual:</strong> {{ tramite.estado }}</p>
              </div>
              <form [formGroup]="statusForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="estado" class="form-label">Nuevo Estado</label>
                  <select class="form-control" id="estado" formControlName="estado" required>
                    <option value="">Selecciona un estado</option>
                    <option value="Radicado">Radicado</option>
                    <option value="En revisión">En revisión</option>
                    <option value="Requerimiento de información">Requerimiento de información</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Negado">Negado</option>
                    <option value="Archivado">Archivado</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label for="observaciones" class="form-label">Observaciones</label>
                  <textarea class="form-control" id="observaciones" formControlName="observaciones" rows="4"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  {{ loading ? 'Actualizando...' : 'Actualizar Estado' }}
                </button>
                <button type="button" class="btn btn-secondary ms-2" (click)="goBack()">Cancelar</button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
                <div class="text-success mt-2" *ngIf="success">{{ success }}</div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class UpdateTramiteStatusComponent implements OnInit {
  statusForm!: FormGroup;
  tramite: any = null;
  loading = false;
  error = '';
  success = '';
  radicado = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private tramitesService: TramitesService
  ) {}

  ngOnInit() {
    this.statusForm = this.fb.group({
      estado: ['', Validators.required],
      observaciones: ['']
    });

    this.route.params.subscribe((params: any) => {
      this.radicado = params['radicado'];
      this.loadTramite();
    });
  }

  loadTramite() {
    this.tramitesService.getFuncionarioTramite(this.radicado).subscribe(
      (res: any) => {
        this.tramite = res;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al cargar el trámite';
      }
    );
  }

  onSubmit() {
    if (!this.statusForm.valid) return;
    this.loading = true;
    this.error = '';
    const { estado, observaciones } = this.statusForm.value;

    this.tramitesService.updateStatus(this.radicado, estado, observaciones).subscribe(
      (res: any) => {
        this.success = 'Estado actualizado correctamente';
        this.loading = false;
        setTimeout(() => this.goBack(), 1500);
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al actualizar el estado';
        this.loading = false;
      }
    );
  }

  goBack() {
    this.router.navigate(['/funcionario/acto']);
  }
}
