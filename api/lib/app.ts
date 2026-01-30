import express from 'express';
import { config } from './config'
import bodyParser from 'body-parser';
import path from 'path';
// import morgan from 'morgan';

import Controller from "./interfaces/controller.interface";
import mongoose from 'mongoose';
import { requestLogger } from './middlewares/logger.middleware';
import cors from 'cors';
import { getUploadsRootDir } from './utils/uploadsDir';

class App {
   public app: express.Application;

   constructor(controllers: Controller[]) {
       this.app = express();
       this.app.use('/uploads', express.static(getUploadsRootDir()));
       this.initializeMiddlewares();
       this.initializeControllers(controllers);
       this.connectToDatabase();
   }

    private initializeMiddlewares(): void {
        const allowedOrigins = [
            'http://localhost:4200',              // local dev
            'https://kuchblog.pl',                // apex (jeśli ktoś wejdzie bez www)
            'https://www.kuchblog.pl',            // PROD – główna domena
            'https://blog-murex-delta-27.vercel.app' // adres z Vercela
        ];

        const corsOptions: cors.CorsOptions = {
            origin: (origin, cb) => {
                if (!origin) return cb(null, true);
                if (allowedOrigins.includes(origin)) return cb(null, true);
                return cb(new Error(`CORS blocked for origin: ${origin}`));
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
        };

        this.app.use(cors(corsOptions));
        this.app.options('*', cors(corsOptions));


        this.app.options('*', cors());

        this.app.use(bodyParser.json());
        this.app.use(requestLogger);
    }



    private async connectToDatabase(): Promise<void> {
        try {
            await mongoose.connect(config.databaseUrl);
            console.log('Connection with database established');
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
        }

        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });
    }



    private initializeControllers(controllers: Controller[]): void {
       controllers.forEach((controller) => {
           this.app.use('/', controller.router);
       });
   }

   public listen(): void {
       this.app.listen(config.port, () => {
           console.log(`App listening on the port ${config.port}`);
       });
   }

}
export default App;
