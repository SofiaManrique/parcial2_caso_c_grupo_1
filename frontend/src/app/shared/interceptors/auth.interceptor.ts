import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // El JWT viaja como httpOnly cookie — el navegador lo adjunta automáticamente.
    // Solo se añade Authorization header para el partial token del paso 2 de MFA.
    const partialToken = this.auth.getPartialToken();

    const authReq = req.clone({
      withCredentials: true,   // ← incluye cookies httpOnly en todas las solicitudes
      ...(partialToken
        ? { setHeaders: { Authorization: `Bearer ${partialToken}` } }
        : {}),
    });

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // Solo hace logout automático si el usuario YA estaba autenticado.
        // Durante MFA (paso 2), isAuthenticated()=false — no redirige a login.
        if (err.status === 401 && this.auth.isAuthenticated()) {
          this.auth.logout();
        }
        return throwError(() => err);
      })
    );
  }
}