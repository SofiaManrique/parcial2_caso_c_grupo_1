import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Metadatos del usuario — NUNCA el JWT (que vive en httpOnly cookie)
interface UserMeta {
  user_id: number;
  nombre: string;
  role: string;
  user_type: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ── Almacenamiento en MEMORIA — no accesible por XSS ──────
  private userMeta: UserMeta | null = null;
  private partialToken: string | null = null;   // solo para MFA paso 2 (5 min)

  constructor(private http: HttpClient, private router: Router) {
    // Intentar recuperar metadatos de sessionStorage en recarga de página
    const saved = sessionStorage.getItem('user_meta');
    if (saved) {
      try { this.userMeta = JSON.parse(saved); } catch { this.userMeta = null; }
    }
  }

  login(cedula: string, password: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/auth/login`,
      { cedula, password },
      { withCredentials: true }    // ← necesario para que el navegador guarde la cookie
    );
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/register`, data);
  }

  registerContratista(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/register/contratista`, data);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/auth/verify/${token}`);
  }

  verifyMFA(code: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/mfa/verify`,
      { code },
      { withCredentials: true }
    );
  }

  /** Guarda los metadatos del usuario (NO el JWT) tras login exitoso */
  saveUserMeta(meta: UserMeta) {
    this.userMeta = meta;
    // sessionStorage solo guarda rol/nombre — no el token
    sessionStorage.setItem('user_meta', JSON.stringify(meta));
    this.partialToken = null;
  }

  savePartialToken(t: string) {
    this.partialToken = t;
  }

  getPartialToken(): string | null {
    return this.partialToken;
  }

  /** Cierra sesión: borra cookie en el backend y limpia memoria */
  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this.userMeta = null;
    this.partialToken = null;
    sessionStorage.removeItem('user_meta');
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.userMeta;
  }

  getRole(): string {
    return this.userMeta?.role || '';
  }

  getRoleType(): string {
    return this.userMeta?.user_type || '';
  }

  getUserId(): number | null {
    return this.userMeta?.user_id || null;
  }

  getUserName(): string {
    return this.userMeta?.nombre || '';
  }

  getHomeRoute(): string {
    const role = this.getRole();
    if (role === 'ROLE_CIUDADANO')   return '/ciudadano/tramites';
    if (role === 'ROLE_CONTRATISTA') return '/contratista/contratos';
    if (role === 'ROLE_FUNCIONARIO') return '/funcionario/acto';
    if (role === 'ROLE_ADMIN')       return '/admin/crear-funcionario';
    if (role === 'ROLE_AUDITOR')     return '/auditor/reporte';
    return '/login';
  }
}