import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContratosService } from '../shared/services/contratos.service';

@Component({
  selector: 'app-contratista-contratos',
  template: `
    <div class="container mt-5">
      <h1 class="mb-4">Mis Contratos</h1>

      <div class="alert alert-warning" *ngIf="contratos.length === 0 && !loading">
        No tiene contratos asignados.
      </div>

      <div *ngFor="let contrato of contratos" class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><strong>{{ contrato.numero_contrato }}</strong> — {{ contrato.objeto }}</span>
          <span class="badge bg-success">{{ contrato.estado }}</span>
        </div>
        <div class="card-body">
          <p class="text-muted mb-2">
            Valor: $ {{ contrato.valor | number:'1.0-0' }} &nbsp;|&nbsp;
            Documentos radicados: <strong>{{ contrato.documentos_radicados }}</strong>
          </p>

          <button class="btn btn-sm btn-outline-secondary mb-3"
            (click)="toggleDocs(contrato)">
            {{ contrato.showDocs ? 'Ocultar documentos' : 'Ver documentos radicados' }}
          </button>

          <div *ngIf="contrato.showDocs">
            <div *ngIf="contrato.documentos?.length === 0" class="text-muted small mb-2">
              Sin documentos radicados aún.
            </div>
            <table class="table table-sm" *ngIf="contrato.documentos?.length > 0">
              <thead><tr><th>Radicado</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                <tr *ngFor="let doc of contrato.documentos">
                  <td>{{ doc.numero_radicado }}</td>
                  <td>{{ doc.tipo }}</td>
                  <td><span class="badge bg-info">{{ doc.estado }}</span></td>
                  <td>{{ doc.created_at | date:'short' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr>
          <h6>Radicar Documento</h6>
          <form [formGroup]="getForms(contrato.id)" (ngSubmit)="radicar(contrato)">
            <div class="row g-2">
              <div class="col-md-4">
                <select class="form-control form-control-sm" formControlName="tipo" required>
                  <option value="">Seleccione tipo...</option>
                  <option>Informe de avance</option>
                  <option>Factura</option>
                  <option>Acta de inicio</option>
                  <option>Acta parcial</option>
                  <option>Acta de liquidación</option>
                  <option>Otro</option>
                </select>
              </div>
              <div class="col-md-6">
                <input type="text" class="form-control form-control-sm"
                  formControlName="descripcion" placeholder="Descripción (opcional)">
              </div>
              <div class="col-md-2">
                <button type="submit" class="btn btn-primary btn-sm w-100"
                  [disabled]="getForms(contrato.id).invalid || contrato.loading">
                  {{ contrato.loading ? '...' : 'Radicar' }}
                </button>
              </div>
            </div>
            <div class="text-danger small mt-1" *ngIf="contrato.error">{{ contrato.error }}</div>
            <div class="text-success small mt-1" *ngIf="contrato.success">{{ contrato.success }}</div>
          </form>
        </div>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    </div>
  `,
  styles: []
})
export class ContratistaContratosComponent implements OnInit {
  contratos: any[] = [];
  loading = false;
  error = '';
  private forms: Map<number, FormGroup> = new Map();

  constructor(private contratosService: ContratosService, private fb: FormBuilder) {}

  ngOnInit() {
    this.loadContratos();
  }

  loadContratos() {
    this.loading = true;
    this.contratosService.getMisContratos().subscribe(
      (res: any) => {
        this.contratos = (res.contratos || []).map((c: any) => ({
          ...c, showDocs: false, documentos: [], loading: false, error: '', success: ''
        }));
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al cargar los contratos';
        this.loading = false;
      }
    );
  }

  getForms(id: number): FormGroup {
    if (!this.forms.has(id)) {
      this.forms.set(id, this.fb.group({ tipo: ['', Validators.required], descripcion: [''] }));
    }
    return this.forms.get(id)!;
  }

  toggleDocs(contrato: any) {
    contrato.showDocs = !contrato.showDocs;
    if (contrato.showDocs && contrato.documentos.length === 0) {
      this.contratosService.getDocumentos(contrato.id).subscribe(
        (res: any) => { contrato.documentos = res.documentos || []; },
        () => {}
      );
    }
  }

  radicar(contrato: any) {
    const form = this.getForms(contrato.id);
    if (form.invalid) return;
    contrato.loading = true;
    contrato.error = '';
    contrato.success = '';
    const { tipo, descripcion } = form.value;

    this.contratosService.radicarDocumento(contrato.id, tipo, descripcion).subscribe(
      (res: any) => {
        contrato.success = `Radicado: ${res.numero_radicado}`;
        contrato.documentos_radicados++;
        contrato.loading = false;
        form.reset({ tipo: '', descripcion: '' });
        if (contrato.showDocs) {
          contrato.documentos.unshift({
            numero_radicado: res.numero_radicado, tipo, estado: 'Radicado', created_at: new Date()
          });
        }
      },
      (err: any) => {
        contrato.error = err.error?.detail || 'Error al radicar el documento';
        contrato.loading = false;
      }
    );
  }
}
