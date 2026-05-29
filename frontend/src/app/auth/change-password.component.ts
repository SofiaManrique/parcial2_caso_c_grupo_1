import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-change-password',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card border-warning">
            <div class="card-header bg-warning text-dark">
              <strong>⚠️ Cambio de contraseña obligatorio</strong>
            </div>
            <div class="card-body">
              <p class="text-muted mb-4">
                Su cuenta usa credenciales temporales. Debe establecer una nueva contraseña para continuar.
              </p>
              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label class="form-label">Contraseña temporal (actual)</label>
                  <input type="password" class="form-control" formControlName="password_actual" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Nueva contraseña</label>
                  <input type="password" class="form-control" formControlName="password_nuevo" required>
                  <div class="text-danger small mt-1"
                       *ngIf="form.get('password_nuevo')?.invalid && form.get('password_nuevo')?.touched">
                    Mín. 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Confirmar nueva contraseña</label>
                  <input type="password" class="form-control" formControlName="confirmar" required>
                  <div class="text-danger small mt-1" *ngIf="mismatch">
                    Las contraseñas no coinciden
                  </div>
                </div>
                <button type="submit" class="btn btn-warning w-100" [disabled]="loading">
                  {{ loading ? 'Guardando...' : 'Cambiar contraseña' }}
                </button>
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
export class ChangePasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  error = '';
  success = '';
  mismatch = false;

  passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]{8,}$/;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.form = this.fb.group({
      password_actual: ['', Validators.required],
      password_nuevo: ['', [Validators.required, Validators.pattern(this.passwordRegex)]],
      confirmar: ['', Validators.required]
    });
  }

  onSubmit() {
    this.mismatch = false;
    if (!this.form.valid) return;

    const { password_actual, password_nuevo, confirmar } = this.form.value;
    if (password_nuevo !== confirmar) {
      this.mismatch = true;
      return;
    }

    this.loading = true;
    this.error = '';

    this.http.post<any>(`${environment.apiUrl}/auth/change-password`, {
      password_actual,
      password_nuevo
    }).subscribe(
      (res: any) => {
        this.success = 'Contraseña actualizada. Redirigiendo...';
        this.loading = false;
        setTimeout(() => this.router.navigate([this.auth.getHomeRoute()]), 1500);
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al cambiar la contraseña';
        this.loading = false;
      }
    );
  }
}
