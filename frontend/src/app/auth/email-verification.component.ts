import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-email-verification',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card">
            <div class="card-body text-center">
              <h2 class="card-title mb-4" *ngIf="!verified && !error">Verificando email...</h2>
              <div *ngIf="loading" class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <div class="alert alert-success mt-3" *ngIf="verified">
                <h4>¡Email verificado!</h4>
                <p>Tu cuenta ha sido activada correctamente. Redirigiendo al login...</p>
              </div>
              <div class="alert alert-danger mt-3" *ngIf="error">
                <h4>Error en la verificación</h4>
                <p>{{ error }}</p>
                <a routerLink="/register" class="btn btn-primary mt-3">Volver a registrarse</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class EmailVerificationComponent implements OnInit {
  loading = true;
  verified = false;
  error = '';

  constructor(private route: ActivatedRoute, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      const token = params['token'];
      if (token) {
        this.auth.verifyEmail(token).subscribe(
          (res: any) => {
            this.loading = false;
            this.verified = true;
            setTimeout(() => this.router.navigate(['/login']), 2000);
          },
          (err: any) => {
            this.loading = false;
            this.error = err.error?.detail || 'Token inválido o expirado';
          }
        );
      }
    });
  }
}
