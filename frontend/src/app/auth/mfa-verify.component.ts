import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-mfa-verify',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title text-center mb-4">Verificación MFA</h2>
              <p class="text-center mb-4">Ingresa el código de 6 dígitos de tu aplicación autenticadora</p>
              <form [formGroup]="mfaForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label for="code" class="form-label">Código MFA</label>
                  <input type="text" class="form-control text-center form-control-lg" id="code" formControlName="code" placeholder="000000" maxlength="6" required>
                  <div class="text-danger small mt-1" *ngIf="mfaForm.get('code')?.invalid && mfaForm.get('code')?.touched">6 dígitos requeridos</div>
                </div>
                <button type="submit" class="btn btn-primary w-100" [disabled]="loading">
                  {{ loading ? 'Verificando...' : 'Verificar' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
              <hr>
              <p class="text-center"><a href="#" (click)="goBack(); $event.preventDefault()">Volver al login</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class MFAVerifyComponent implements OnInit {
  mfaForm!: FormGroup;
  loading = false;
  error = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (!this.auth.getPartialToken()) {
      this.router.navigate(['/login']);
    }
    this.mfaForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  onSubmit() {
    if (!this.mfaForm.valid) return;
    this.loading = true;
    this.error = '';

    this.auth.verifyMFA(this.mfaForm.value.code).subscribe(
      (res: any) => {
        this.auth.saveToken(res.token);
        this.router.navigate([this.auth.getHomeRoute()]);
      },
      (err: any) => {
        this.error = err.error?.detail || 'Código MFA inválido';
        this.loading = false;
      }
    );
  }

  goBack() {
    this.router.navigate(['/login']);
  }
}
