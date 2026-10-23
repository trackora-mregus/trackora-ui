import { HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

function isTrustedApiDestination(destination: string, browserBase: string): boolean {
  // Reject ambiguity before URL parsing removes whitespace, backslashes or dot segments.
  if (!destination || /[\u0000-\u0020\u007f\\]/.test(destination)) {
    return false;
  }

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(destination);
  if (
    (hasScheme && !/^https?:\/\/[^/?#]/i.test(destination)) ||
    (destination.startsWith('//') && !/^\/\/[^/?#]/.test(destination))
  ) {
    return false;
  }

  const reference = destination.split(/[?#]/, 1)[0];
  const authority = /^(?:https?:)?\/\/([^/]*)(.*)$/i.exec(reference);
  if (authority?.[1].includes('@')) {
    return false;
  }

  try {
    const rawPath = authority ? authority[2] : reference;
    for (const segment of rawPath.split('/')) {
      const decoded = decodeURIComponent(segment);
      // Reject separators, nested encoding and traversal, including encoded variants.
      if (decoded === '.' || decoded === '..' || /[/\\%\u0000-\u001f\u007f]/.test(decoded)) {
        return false;
      }
    }

    const api = new URL(environment.apiBaseUrl);
    const target = hasScheme ? new URL(destination) : new URL(destination, browserBase);
    const apiPath = api.pathname.replace(/\/+$/, '');
    return (
      (api.protocol === 'http:' || api.protocol === 'https:') &&
      !api.username &&
      !api.password &&
      !target.username &&
      !target.password &&
      target.origin === api.origin &&
      (target.pathname === apiPath || target.pathname.startsWith(`${apiPath}/`))
    );
  } catch {
    return false;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Caller-supplied credentials (including third-party or empty headers) take precedence.
  if (
    req.headers.has('Authorization') ||
    !isTrustedApiDestination(req.urlWithParams, inject(DOCUMENT).baseURI)
  ) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Only the initial destination is checked; native redirects do not re-enter this guard.
  return next(authReq);
};
