import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-register',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title text-center mb-4">Registro de Ciudadano</h2>
              <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
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
                    <label for="email" class="form-label">Email</label>
                    <input type="email" class="form-control" id="email" formControlName="email" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="telefono" class="form-label">Teléfono</label>
                    <input type="text" class="form-control" id="telefono" formControlName="telefono" required>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="fecha_nacimiento" class="form-label">Fecha Nacimiento</label>
                    <input type="date" class="form-control" id="fecha_nacimiento" formControlName="fecha_nacimiento">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="municipio" class="form-label">Municipio</label>
                    <input type="text" class="form-control" id="municipio" formControlName="municipio">
                  </div>
                </div>
                <div class="mb-3">
                  <label for="password" class="form-label">Contraseña</label>
                  <input type="password" class="form-control" id="password" formControlName="password" required>
                  <div class="text-danger small mt-1" *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched">
                    Min 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial
                  </div>
                </div>
                <button type="submit" class="btn btn-primary w-100" [disabled]="loading">
                  {{ loading ? 'Registrando...' : 'Registrarse' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
                <div class="text-success mt-2" *ngIf="success">{{ success }}</div>
              </form>
              <hr>
              <p class="text-center">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión aquí</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  loading = false;
  error = '';
  success = '';
  passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]{8,}$/;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.registerForm = this.fb.group({
      tipo_documento: ['CC', Validators.required],
      cedula: ['', Validators.required],
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required],
      fecha_nacimiento: [''],
      municipio: [''],
      password: ['', [Validators.required, Validators.pattern(this.passwordRegex)]]
    });
  }

  onSubmit() {
    if (!this.registerForm.valid) return;
    this.loading = true;
    this.error = '';
    this.success = '';

    this.auth.register(this.registerForm.value).subscribe(
      (res: any) => {
        this.success = res.mensaje;
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error en el registro';
        this.loading = false;
      }
    );
  }
}
