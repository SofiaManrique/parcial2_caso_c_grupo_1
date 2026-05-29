import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFService } from '../shared/services/pdf.service';

@Component({
  selector: 'app-certificate-viewer',
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-10">
          <div class="card">
            <div class="card-body">
              <h2 class="card-title mb-4">Certificado de Trámite</h2>
              <div class="alert alert-info" *ngIf="loading">
                <p>Generando certificado...</p>
              </div>
              <div class="alert alert-danger" *ngIf="error">
                {{ error }}
              </div>
              <div *ngIf="pdfUrl" class="text-center">
                <iframe [src]="pdfUrl" width="100%" height="600px" style="border:none;border-radius:0.5rem"></iframe>
                <div class="mt-3">
                  <a [href]="pdfUrl" download="certificado.pdf" class="btn btn-primary">
                    📥 Descargar PDF
                  </a>
                  <button class="btn btn-secondary" (click)="goBack()">Volver</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class CertificateViewerComponent implements OnInit {
  pdfUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';
  radicado = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pdfService: PDFService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      this.radicado = params['radicado'];
      this.loadCertificate();
    });
  }

  loadCertificate() {
    this.loading = true;
    this.pdfService.getCertificate(this.radicado).subscribe(
      (blob: any) => {
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al generar el certificado';
        this.loading = false;
      }
    );
  }

  goBack() {
    this.router.navigate(['/ciudadano/tramites']);
  }
}
