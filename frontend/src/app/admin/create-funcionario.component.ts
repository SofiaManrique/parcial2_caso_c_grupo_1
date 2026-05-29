import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FuncionariosService } from '../shared/services/funcionarios.service';

@Component({
  selector: 'app-create-funcionario',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title text-center mb-4">Crear Nuevo Funcionario</h2>
              <form [formGroup]="funcionarioForm" (ngSubmit)="onSubmit()">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="tipo_documento" class="form-label">Tipo Documento</label>
                    <select class="form-control" id="tipo_documento" formControlName="tipo_documento" required>
                      <option>CC</option>
                      <option>CE</option>
                      <option>PP</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="cedula" class="form-label">Cédula</label>
                    <input type="text" class="form-control" id="cedula" formControlName="cedula" required>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="nombre" class="form-label">Nombre</label>
                    <input type="text" class="form-control" id="nombre" formControlName="nombre" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="apellido" class="form-label">Apellido</label>
                    <input type="text" class="form-control" id="apellido" formControlName="apellido" required>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="cargo" class="form-label">Cargo</label>
                    <input type="text" class="form-control" id="cargo" formControlName="cargo" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="dependencia_id" class="form-label">Dependencia</label>
                    <select class="form-control" id="dependencia_id" formControlName="dependencia_id" required>
                      <option value="">Selecciona una dependencia</option>
                      <option *ngFor="let dep of dependencias" [value]="dep.id">{{ dep.nombre }}</option>
                    </select>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="email" class="form-label">Email</label>
                    <input type="email" class="form-control" id="email" formControlName="email" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="telefono" class="form-label">Teléfono</label>
                    <input type="text" class="form-control" id="telefono" formControlName="telefono" required>
                  </div>
                </div>
                <button type="submit" class="btn btn-primary w-100" [disabled]="loading">
                  {{ loading ? 'Creando...' : 'Crear Funcionario' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
            </div>
          </div>
          <div class="alert alert-success mt-4" *ngIf="tempPassword">
            <h4>¡Funcionario creado exitosamente!</h4>
            <p><strong>Contraseña temporal:</strong></p>
            <code class="bg-light p-2 d-block mb-2">{{ tempPassword }}</code>
            <button class="btn btn-sm btn-outline-primary" (click)="copyToClipboard()">📋 Copiar al portapapeles</button>
            <p class="small mt-2">Entrega esta contraseña al nuevo funcionario para que pueda iniciar sesión.</p>
            <button class="btn btn-primary mt-2" (click)="resetForm()">Crear otro funcionario</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class CreateFuncionarioComponent implements OnInit {
  funcionarioForm!: FormGroup;
  dependencias: any[] = [];
  loading = false;
  error = '';
  tempPassword = '';

  constructor(private fb: FormBuilder, private funcionariosService: FuncionariosService) {}

  ngOnInit() {
    this.funcionarioForm = this.fb.group({
      tipo_documento: ['CC', Validators.required],
      cedula: ['', Validators.required],
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      cargo: ['', Validators.required],
      dependencia_id: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required]
    });
    this.loadDependencias();
  }

  loadDependencias() {
    this.funcionariosService.getDependencias().subscribe(
      (res: any) => {
        this.dependencias = res.dependencias || [];
      },
      (err: any) => {
        this.error = 'Error al cargar las dependencias';
      }
    );
  }

  onSubmit() {
    if (!this.funcionarioForm.valid) return;
    this.loading = true;
    this.error = '';

    this.funcionariosService.createFuncionario(this.funcionarioForm.value).subscribe(
      (res: any) => {
        this.tempPassword = res.password_temporal;
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al crear el funcionario';
        this.loading = false;
      }
    );
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.tempPassword);
    alert('Contraseña copiada al portapapeles');
  }

  resetForm() {
    this.funcionarioForm.reset({ tipo_documento: 'CC' });
    this.tempPassword = '';
    this.error = '';
  }
}
