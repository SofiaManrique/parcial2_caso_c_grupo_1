import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/services/auth.service';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-tramites',
  template: `
    <div>
      <h1>Mis Trámites — Alcaldía de Municipio X</h1>

      <div [innerHTML]="noticiaHtml"></div>

      <ul>
        <li *ngFor="let t of tramites">{{ t[1] }} — {{ t[3] }}</li>
      </ul>

      <!-- Solo intranet roles (guía Caso C) -->
      <div *ngIf="canSearchFuncionarios">
        <input [(ngModel)]="busqueda" placeholder="Buscar funcionario..." />
        <button type="button" (click)="buscarFuncionario()">Buscar</button>
      </div>

      <form [formGroup]="pagoForm" (ngSubmit)="procesarPago()">
        <input formControlName="tarjeta" placeholder="Número de tarjeta (16 dígitos)" type="text" />
        <input formControlName="cvv" placeholder="CVV" type="password" />
        <input formControlName="monto" placeholder="Monto" type="number" />
        <input formControlName="matricula" placeholder="Matrícula inmobiliaria" type="text" />

        <button type="submit">Pagar Impuesto</button>
      </form>
    </div>
  `
})
export class TramitesComponent implements OnInit {
  tramites: any[] = [];
  busqueda = '';
  noticiaHtml: SafeHtml = '';
  pagoForm!: FormGroup;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private auth: AuthService
  ) {}

  get canSearchFuncionarios(): boolean {
    const role = this.auth.getRole();
    return role === 'ROLE_FUNCIONARIO' || role === 'ROLE_ADMIN';
  }

  ngOnInit(): void {
    this.pagoForm = this.fb.group({
      tarjeta: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      matricula: ['', [Validators.required, Validators.maxLength(50)]]
    });

    // Ya NO mandamos Authorization manual: lo pone el interceptor
    this.http.get<any>(`${environment.apiUrl}/tramites/mis-tramites`).subscribe({
      next: (r: any) => (this.tramites = r.tramites ?? []),
      error: () => {}
    });

    this.http.get<any>(`${environment.apiUrl}/noticias/ultima`).subscribe({
      next: (r: any) => {
        const limpio = DOMPurify.sanitize(r?.contenido_html ?? '', {
          ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'br'],
          ALLOWED_ATTR: []
        });
    
        this.noticiaHtml = this.sanitizer.bypassSecurityTrustHtml(limpio);
      },
      error: () => {}
    });
  }

  buscarFuncionario(): void {
    const q = encodeURIComponent(this.busqueda.trim());
    this.http.get<any>(`${environment.apiUrl}/intranet/funcionarios?buscar=${q}`).subscribe({
      next: (r: any) => console.log('Funcionarios:', r),
      error: () => {}
    });
  }

  procesarPago(): void {
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }

    const tarjeta = String(this.pagoForm.value.tarjeta);

    // Mock token de pasarela (no enviar PAN/CVV a backend)
    const paymentToken = `tok_${tarjeta.slice(-4)}_${Date.now()}`;

    this.http
      .post(`${environment.apiUrl}/pago/impuesto`, {
        payment_token: paymentToken,
        matricula_inmobiliaria: String(this.pagoForm.value.matricula),
        monto: Number(this.pagoForm.value.monto)
      })
      .subscribe({
        next: (r: any) => alert(`Pago OK: ${JSON.stringify(r)}`),
        error: () => {}
      });
  }
}