import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-security-events',
  template: `
    <div>
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 class="mb-1" style="font-size:1.4rem">Panel de Seguridad</h1>
          <p class="text-muted mb-0" style="font-size:0.85rem">
            Registro de eventos del sistema · auto-actualiza cada 30s
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <select class="form-select form-select-sm" style="width:auto"
                  [(ngModel)]="filtroNivel" (change)="cargar()">
            <option value="0">Todos los eventos</option>
            <option value="6">Solo alertas (≥ 6)</option>
            <option value="10">Solo críticos (≥ 10)</option>
          </select>
          <button class="btn btn-sm btn-primary" (click)="cargar()" [disabled]="loading">
            <i class="bi bi-arrow-clockwise me-1"></i>{{ loading ? '...' : 'Actualizar' }}
          </button>
        </div>
      </div>

      <!-- Resumen de contadores -->
      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="card text-center py-3" style="border-left:3px solid #ef4444">
            <div style="font-size:2rem;font-weight:700;color:#ef4444">{{ criticos }}</div>
            <div class="text-muted" style="font-size:0.8rem">Eventos críticos (nivel 10)</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center py-3" style="border-left:3px solid #f59e0b">
            <div style="font-size:2rem;font-weight:700;color:#f59e0b">{{ alertas }}</div>
            <div class="text-muted" style="font-size:0.8rem">Alertas (nivel 6-9)</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center py-3" style="border-left:3px solid #10b981">
            <div style="font-size:2rem;font-weight:700;color:#10b981">{{ normales }}</div>
            <div class="text-muted" style="font-size:0.8rem">Eventos normales (nivel ≤ 5)</div>
          </div>
        </div>
      </div>

      <!-- Tabla de eventos -->
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span>Registro de eventos <span class="badge bg-secondary ms-1">{{ eventos.length }}</span></span>
          <span class="text-muted" style="font-size:0.75rem">
            <i class="bi bi-clock me-1"></i>Última actualización: {{ ultimaActualizacion }}
          </span>
        </div>
        <div class="table-responsive" style="max-height:520px;overflow-y:auto">
          <table class="table table-sm mb-0">
            <thead style="position:sticky;top:0;z-index:1">
              <tr>
                <th style="width:30px">Niv.</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Detalle</th>
                <th>IP</th>
                <th>Fecha/Hora</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of eventos" [class]="rowClass(e.level)">
                <td class="text-center">
                  <span [class]="levelBadge(e.level)">{{ e.level }}</span>
                </td>
                <td>
                  <span class="fw-500" style="font-size:0.82rem">{{ e.action }}</span>
                </td>
                <td style="font-size:0.82rem">
                  <span *ngIf="e.user_type" class="text-muted">{{ e.user_type }}</span>
                  <span *ngIf="e.user_id"> #{{ e.user_id }}</span>
                  <span *ngIf="!e.user_id" class="text-muted">—</span>
                </td>
                <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{ e.detail || '—' }}
                </td>
                <td style="font-size:0.8rem;font-family:monospace">{{ e.ip || '—' }}</td>
                <td style="font-size:0.78rem;white-space:nowrap;color:#64748b">
                  {{ formatDate(e.created_at) }}
                </td>
              </tr>
              <tr *ngIf="eventos.length === 0 && !loading">
                <td colspan="6" class="text-center text-muted py-4">Sin eventos registrados</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fw-500 { font-weight: 500; }
    .row-critical { background: oklch(0.98 0.02 25) !important; }
    .row-warning  { background: oklch(0.99 0.02 80) !important; }
  `]
})
export class SecurityEventsComponent implements OnInit, OnDestroy {
  eventos: any[] = [];
  loading = false;
  filtroNivel = '0';
  ultimaActualizacion = '—';
  private timer: any;

  get criticos() { return this.eventos.filter(e => e.level >= 10).length; }
  get alertas()  { return this.eventos.filter(e => e.level >= 6 && e.level < 10).length; }
  get normales() { return this.eventos.filter(e => e.level < 6).length; }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargar();
    this.timer = setInterval(() => this.cargar(), 30000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  cargar() {
    this.loading = true;
    const url = `${environment.apiUrl}/intranet/audit-log?limit=200&nivel_min=${this.filtroNivel}`;
    this.http.get<any>(url).subscribe(
      (res: any) => {
        this.eventos = res.eventos || [];
        this.loading = false;
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-CO');
      },
      (err: any) => { this.loading = false; }
    );
  }

  rowClass(level: number): string {
    if (level >= 10) return 'row-critical';
    if (level >= 6)  return 'row-warning';
    return '';
  }

  levelBadge(level: number): string {
    if (level >= 10) return 'badge rounded-pill text-white';
    if (level >= 6)  return 'badge rounded-pill text-dark';
    return 'badge rounded-pill text-white';
  }

  levelBgStyle(level: number): string {
    if (level >= 10) return 'background:#ef4444';
    if (level >= 6)  return 'background:#f59e0b';
    return 'background:#10b981';
  }

  formatDate(d: string): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('es-CO', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return d; }
  }
}