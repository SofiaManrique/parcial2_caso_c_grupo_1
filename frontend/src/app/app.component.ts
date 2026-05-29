import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  template: `
    <!-- ── Layout autenticado: header + sidebar + main ── -->
    <div class="app-shell" *ngIf="isAuthenticated">

      <!-- Header superior -->
      <header class="app-header">
        <div class="header-brand" [routerLink]="homeRoute" style="cursor:pointer">
          <span class="header-brand-icon">🏛</span>
          <div class="header-brand-text">
            <span class="header-brand-name">Alcaldía Digital</span>
            <span class="header-brand-sub">Portal de Trámites</span>
          </div>
        </div>
        <div class="header-user">
          <div class="user-info">
            <div class="user-avatar">{{ userName.charAt(0).toUpperCase() }}</div>
            <div class="user-details">
              <span class="user-name">{{ userName }}</span>
              <span class="user-role-badge">{{ roleLabel }}</span>
            </div>
          </div>
          <button class="btn-logout" (click)="logout()" title="Cerrar sesión">
            <i class="bi bi-box-arrow-right"></i>
            <span>Salir</span>
          </button>
        </div>
      </header>

      <!-- Body: sidebar + contenido -->
      <div class="app-body">

        <!-- Sidebar de navegación -->
        <aside class="app-sidebar">
          <div class="sidebar-section-label">Navegación</div>
          <nav class="sidebar-nav">

            <!-- Ciudadano -->
            <a class="sidebar-link" *ngIf="role === 'ROLE_CIUDADANO'"
               routerLink="/ciudadano/tramites" routerLinkActive="active">
              <i class="bi bi-file-text"></i>
              <span>Mis Trámites</span>
            </a>
            <a class="sidebar-link" *ngIf="role === 'ROLE_CIUDADANO'"
               routerLink="/ciudadano/radicar" routerLinkActive="active">
              <i class="bi bi-plus-circle"></i>
              <span>Radicar Trámite</span>
            </a>

            <!-- Contratista -->
            <a class="sidebar-link" *ngIf="role === 'ROLE_CONTRATISTA'"
               routerLink="/contratista/contratos" routerLinkActive="active">
              <i class="bi bi-briefcase"></i>
              <span>Mis Contratos</span>
            </a>

            <!-- Funcionario -->
            <a class="sidebar-link" *ngIf="role === 'ROLE_FUNCIONARIO'"
               routerLink="/funcionario/acto" routerLinkActive="active">
              <i class="bi bi-pen-fill"></i>
              <span>Generar Acto</span>
            </a>

            <!-- Admin -->
            <a class="sidebar-link" *ngIf="role === 'ROLE_ADMIN'"
               routerLink="/admin/crear-funcionario" routerLinkActive="active">
              <i class="bi bi-person-plus-fill"></i>
              <span>Crear Funcionario</span>
            </a>

            <!-- Auditor -->
            <a class="sidebar-link" *ngIf="role === 'ROLE_AUDITOR'"
               routerLink="/auditor/reporte" routerLinkActive="active">
              <i class="bi bi-bar-chart-fill"></i>
              <span>Reporte Auditoría</span>
            </a>

            <!-- Funcionario + Admin: MFA -->
            <div class="sidebar-divider" *ngIf="role === 'ROLE_FUNCIONARIO' || role === 'ROLE_ADMIN'"></div>
            <div class="sidebar-section-label" *ngIf="role === 'ROLE_FUNCIONARIO' || role === 'ROLE_ADMIN'">
              Seguridad
            </div>
            <a class="sidebar-link" *ngIf="role === 'ROLE_FUNCIONARIO' || role === 'ROLE_ADMIN'"
               routerLink="/funcionario/mfa-setup" routerLinkActive="active">
              <i class="bi bi-shield-lock"></i>
              <span>Activar MFA</span>
            </a>

          </nav>
        </aside>

        <!-- Contenido principal -->
        <main class="app-main">
          <router-outlet></router-outlet>
        </main>

      </div>
    </div>

    <!-- ── Layout no autenticado: página limpia ── -->
    <div *ngIf="!isAuthenticated">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  isAuthenticated = false;
  role = '';
  userName = '';
  roleLabel = '';
  homeRoute = '/login';

  private readonly ROLE_LABELS: Record<string, string> = {
    ROLE_CIUDADANO:    'Ciudadano',
    ROLE_FUNCIONARIO:  'Funcionario',
    ROLE_ADMIN:        'Administrador',
    ROLE_AUDITOR:      'Auditor',
    ROLE_CONTRATISTA:  'Contratista',
  };

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.updateAuthStatus();
    this.router.events.subscribe((event: any) => {
      if (event instanceof NavigationEnd) {
        this.updateAuthStatus();
      }
    });
  }

  updateAuthStatus() {
    this.isAuthenticated = this.auth.isAuthenticated();
    this.role = this.auth.getRole();
    this.userName = this.auth.getUserName();
    this.roleLabel = this.ROLE_LABELS[this.role] || this.role;
    this.homeRoute = this.auth.getHomeRoute();
  }

  logout() {
    this.auth.logout();
  }
}
