import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { ViewTramitesComponent } from './tramites/tramites.component';
import { AuthInterceptor } from './shared/interceptors/auth.interceptor';
import { AuthGuard } from './shared/guards/auth.guard';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { MFAVerifyComponent } from './auth/mfa-verify.component';
import { EmailVerificationComponent } from './auth/email-verification.component';
import { FileTramiteComponent } from './ciudadano/file-tramite.component';
import { CertificateViewerComponent } from './ciudadano/certificate-viewer.component';
import { UpdateTramiteStatusComponent } from './funcionario/update-tramite-status.component';
import { ActoViewerComponent } from './funcionario/acto-viewer.component';
import { CreateFuncionarioComponent } from './admin/create-funcionario.component';
import { AuditReportViewerComponent } from './auditor/audit-report-viewer.component';
import { RegisterContratistaComponent } from './auth/register-contratista.component';
import { ContratistaContratosComponent } from './contratista/contratos.component';
import { ChangePasswordComponent } from './auth/change-password.component';
import { MfaSetupComponent } from './funcionario/mfa-setup.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'register/contratista', component: RegisterContratistaComponent },
  { path: 'change-password', component: ChangePasswordComponent },
  { path: 'verify-email/:token', component: EmailVerificationComponent },
  { path: 'mfa-verify', component: MFAVerifyComponent },
  {
    path: 'ciudadano',
    canActivate: [AuthGuard],
    children: [
      { path: 'tramites', component: ViewTramitesComponent },
      { path: 'radicar', component: FileTramiteComponent },
      { path: 'certificado/:radicado', component: CertificateViewerComponent }
    ]
  },
  {
    path: 'funcionario',
    canActivate: [AuthGuard],
    children: [
      { path: 'tramites/:radicado', component: UpdateTramiteStatusComponent },
      { path: 'acto', component: ActoViewerComponent },
      { path: 'mfa-setup', component: MfaSetupComponent }
    ]
  },
  {
    path: 'admin',
    canActivate: [AuthGuard],
    children: [
      { path: 'crear-funcionario', component: CreateFuncionarioComponent }
    ]
  },
  {
    path: 'auditor',
    canActivate: [AuthGuard],
    children: [
      { path: 'reporte', component: AuditReportViewerComponent }
    ]
  },
  {
    path: 'contratista',
    canActivate: [AuthGuard],
    children: [
      { path: 'contratos', component: ContratistaContratosComponent }
    ]
  }
];

@NgModule({
  declarations: [
    AppComponent,
    ViewTramitesComponent,
    LoginComponent,
    RegisterComponent,
    MFAVerifyComponent,
    EmailVerificationComponent,
    FileTramiteComponent,
    CertificateViewerComponent,
    UpdateTramiteStatusComponent,
    ActoViewerComponent,
    CreateFuncionarioComponent,
    AuditReportViewerComponent,
    RegisterContratistaComponent,
    ContratistaContratosComponent,
    ChangePasswordComponent,
    MfaSetupComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    AuthGuard,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}

