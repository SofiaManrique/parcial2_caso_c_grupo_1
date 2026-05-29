import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private token = localStorage.getItem('token');
  private partialToken: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  login(cedula: string, password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { cedula, password });
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
    return this.http.post<any>(`${environment.apiUrl}/mfa/verify`, { code });
  }

  saveToken(t: string) {
    this.token = t;
    localStorage.setItem('token', t);
    this.partialToken = null;
  }

  savePartialToken(t: string) {
    this.partialToken = t;
  }

  getToken(): string | null {
    return this.token;
  }

  getPartialToken(): string | null {
    return this.partialToken;
  }

  logout() {
    this.token = null;
    this.partialToken = null;
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getRole(): string {
    if (!this.token) return '';
    try {
      return JSON.parse(atob(this.token.split('.')[1])).role || '';
    } catch {
      return '';
    }
  }

  getRoleType(): string {
    if (!this.token) return '';
    try {
      return JSON.parse(atob(this.token.split('.')[1])).user_type || '';
    } catch {
      return '';
    }
  }

  getUserId(): number | null {
    if (!this.token) return null;
    try {
      return JSON.parse(atob(this.token.split('.')[1])).user_id || null;
    } catch {
      return null;
    }
  }

  getUserName(): string {
    if (!this.token) return '';
    try {
      return JSON.parse(atob(this.token.split('.')[1])).nombre || '';
    } catch {
      return '';
    }
  }

  getHomeRoute(): string {
    const role = this.getRole();
    if (role === 'ROLE_CIUDADANO') return '/ciudadano/tramites';
    if (role === 'ROLE_CONTRATISTA') return '/contratista/contratos';
    if (role === 'ROLE_FUNCIONARIO') return '/funcionario/acto';
    if (role === 'ROLE_ADMIN') return '/admin/crear-funcionario';
    if (role === 'ROLE_AUDITOR') return '/auditor/reporte';
    return '/login';
  }
}
