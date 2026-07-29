import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Da forma uniforme a todos los errores de la API y, sobre todo, impide que
 * detalles internos salgan por la red.
 *
 * El proyecto anterior no tenía manejo de errores: una excepción del driver
 * llegaba tal cual al cliente en un 500, con el mensaje del motor incluido.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.describe(exception);

    // Anotado como number a propósito: getStatus() devuelve number y comparar
    // number contra el enum HttpStatus es un error de tipos.
    const serverErrorThreshold: number = HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= serverErrorThreshold) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // El ValidationPipe devuelve { message: string[], error, statusCode }.
      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        return {
          status,
          error: typeof record.error === 'string' ? record.error : exception.name,
          message: (record.message as string | string[]) ?? exception.message,
        };
      }

      return { status, error: exception.name, message: String(payload) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Siempre es un bug nuestro: una consulta mal construida.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: this.genericMessage(exception),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: this.genericMessage(exception),
    };
  }

  /**
   * Traduce los códigos de Prisma a HTTP. Los mensajes son deliberadamente
   * genéricos: los de Prisma incluyen nombres de tabla y de columna.
   */
  private describePrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Ya existe un registro con esos datos',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'La operación referencia un registro que no existe',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'El recurso solicitado no existe',
        };
      default:
        this.logger.error(`Error de Prisma sin mapear: ${exception.code}`, exception.message);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Error interno del servidor',
        };
    }
  }

  /** En producción nunca se filtra el mensaje original. */
  private genericMessage(exception: unknown): string {
    if (this.isProduction) {
      return 'Error interno del servidor';
    }
    return exception instanceof Error ? exception.message : 'Error interno del servidor';
  }
}
