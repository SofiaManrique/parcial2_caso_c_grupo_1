import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TramitesService } from '../shared/services/tramites.service';
import { AuthService } from '../shared/services/auth.service';
import DOMPurify from 'dompurify';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-view-tramites',
  template: `
    <div class="container mt-5">
      <h1 class="mb-4">Mis Trámites</h1>

      <div class="row mb-4">
        <div class="col-md-12">
          <button class="btn btn-primary" (click)="goToFileTramite()">+ Radicar Nuevo Trámite</button>
        </div>
      </div>

      <div class="alert alert-warning" *ngIf="tramites.length === 0 && !loading">
        <p>No has radiado trámites aún.</p>
      </div>

      <div class="table-responsive" *ngIf="tramites.length > 0">
        <table class="table table-striped">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Funcionario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let tramite of tramites">
              <td>{{ tramite.numero_radicado }}</td>
              <td>{{ tramite.tipo }}</td>
              <td><span class="badge bg-info">{{ tramite.estado }}</span></td>
              <td>{{ tramite.created_at | date:'short' }}</td>
              <td>{{ tramite.funcionario || '-' }}</td>
              <td>
                <button class="btn btn-sm btn-info" (click)="viewCertificate(tramite.numero_radicado)" title="Descargar certificado">
                  📄 Certificado
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    </div>
  `,
  styles: []
})
export class ViewTramitesComponent implements OnInit {
  tramites: any[] = [];
  loading = false;
  error = '';

  constructor(
    private tramitesService: TramitesService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTramites();
  }

  loadTramites() {
    this.loading = true;
    this.tramitesService.getMyTramites().subscribe(
      (res: any) => {
        this.tramites = res.tramites || [];
        this.loading = false;
      },
      (err: any) => {
        this.error = err.error?.detail || 'Error al cargar los trámites';
        this.loading = false;
      }
    );
  }

  goToFileTramite() {
    this.router.navigate(['/ciudadano/radicar']);
  }

  viewCertificate(radicado: string) {
    this.router.navigate([`/ciudadano/certificado/${radicado}`]);
  }
}
