import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-mfa-setup',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">

          <!-- Paso 1: Obtener QR -->
          <div class="card" *ngIf="!qrBase64 && !activado">
            <div class="card-body text-center">
              <h2 class="card-title mb-3">Activar MFA</h2>
              <p class="text-muted">
                Proteja su cuenta con Google Authenticator u otra app TOTP.
                El código QR se muestra <strong>una sola vez</strong>.
              </p>
              <button class="btn btn-primary mt-3" (click)="generarQR()" [disabled]="loading">
                {{ loading ? 'Generando...' : 'Generar código QR' }}
              </button>
              <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
            </div>
          </div>

          <!-- Paso 2: Escanear QR y confirmar -->
          <div class="card" *ngIf="qrBase64 && !activado">
            <div class="card-body">
              <h2 class="card-title text-center mb-3">Escanea el código QR</h2>
              <p class="text-muted text-center small">
                Usa Google Authenticator, Authy u otra app TOTP.
                <strong>Este QR solo se muestra una vez.</strong>
              </p>
              <div class="text-center my-3">
                <img [src]="'data:image/png;base64,' + qrBase64"
                     alt="QR MFA" style="max-width:220px;border:4px solid #eee;border-radius:4px">
              </div>
              <form [formGroup]="confirmForm" (ngSubmit)="confirmar()">
                <div class="mb-3">
                  <label class="form-label">Ingresa el código de 6 dígitos de tu app</label>
                  <input type="text" class="form-control text-center form-control-lg"
                         formControlName="code" maxlength="6" placeholder="000000">
                  <div class="text-danger small mt-1"
                       *ngIf="confirmForm.get('code')?.invalid && confirmForm.get('code')?.touched">
                    Código de 6 dígitos requerido
                  </div>
                </div>
                <button type="submit" class="btn btn-success w-100" [disabled]="loading">
                  {{ loading ? 'Verificando...' : 'Confirmar y activar MFA' }}
                </button>
                <div class="text-danger mt-2" *ngIf="error">{{ error }}</div>
              </form>
            </div>
          </div>

          <!-- Paso 3: MFA activado -->
          <div class="card border-success" *ngIf="activado">
            <div class="card-body text-center">
              <h2 class="text-success mb-3">✔ MFA activado</h2>
              <p>A partir del próximo inicio de sesión se le pedirá el código TOTP.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: []
})
export class MfaSetupComponent implements OnInit {
  qrBase64 = '';
  activado = false;
  loading = false;
  error = '';
  confirmForm!: FormGroup;

  constructor(private http: HttpClient, private fb: FormBuilder) {}

  ngOnInit() {
    this.confirmForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  generarQR() {
    this.loading = true;
    this.error = '';
    this.http.post<any>(`${environment.apiUrl}/mfa/totp/setup`, {}).subscribe(
      (res: any) => {
        this.qrBase64 = res.qr_base64;
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al generar el QR';
        this.loading = false;
      }
    );
  }

  confirmar() {
    if (!this.confirmForm.valid) return;
    this.loading = true;
    this.error = '';
    this.http.post<any>(`${environment.apiUrl}/mfa/totp/confirm`, {
      code: this.confirmForm.value.code
    }).subscribe(
      (res: any) => {
        this.activado = true;
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Código inválido. Intente de nuevo.';
        this.loading = false;
      }
    );
  }
}
