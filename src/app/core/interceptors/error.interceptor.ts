import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { classifyHttpFailure, failureText, LOCAL_FAILURE_FEEDBACK } from '../http/http-failure';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!req.context.get(LOCAL_FAILURE_FEEDBACK)) {
        notifications.error(failureText(classifyHttpFailure(error)));
      }
      return throwError(() => error);
    }),
  );
};
