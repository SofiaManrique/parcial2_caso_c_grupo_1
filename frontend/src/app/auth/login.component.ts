import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title text-center mb-4">Iniciar Sesión</h2>
              <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="cedula" class="form-label">Cédula</label>
                  <input type="text" class="form-control" id="cedula" formControlName="cedula" required>
                  <div class="text-danger small mt-1" *ngIf="loginForm.get('cedula')?.invalid && loginForm.get('cedula')?.touched">Requerido</div>
                </div>
                <div class="mb-3">
                  <label for="password" class="form-label">Contraseña</label>
                  <input type="password" class="form-control" id="password" formControlName="password" required>
                  <div class="text-danger small mt-1" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">Requerido</div>
                </div>
                <button type="submit" class="btn btn-primary w-100" [disabled]="loading">
                  {{ loading ? 'Cargando...' : 'Iniciar Sesión' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
              <hr>
              <p class="text-center">¿No tienes cuenta? <a routerLink="/register">Regístrate aquí</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  error = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      cedula: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (!this.loginForm.valid) return;
    this.loading = true;
    this.error = '';
    const { cedula, password } = this.loginForm.value;

    this.auth.login(cedula, password).subscribe(
      (res: any) => {
        if (res.token) {
          this.auth.saveToken(res.token);
          if (res.must_change_password) {
            this.router.navigate(['/change-password']);
          } else {
            this.router.navigate([this.auth.getHomeRoute()]);
          }
        } else if (res.mfa_required) {
          this.auth.savePartialToken(res.partial_token);
          this.router.navigate(['/mfa-verify']);
        }
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error en el login';
        this.loading = false;
      }
    );
  }
}
