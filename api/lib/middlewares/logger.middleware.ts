import { Request, Response, NextFunction, RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request: Request, response: Response, next: NextFunction) => {
    console.log(
        `[${request.method} ${request.url} ${new Date().toISOString()}]`
    );
    next();
};
