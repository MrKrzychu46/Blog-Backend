import Controller from '../interfaces/controller.interface';
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import mongoose from 'mongoose';


import Rating from '../modules/schemas/rating.schema';
import Post from '../modules/schemas/post.schema';

class RatingController implements Controller {
    public path = '/api/ratings';
    public router = Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/ratings/:postId -> { averageRating, votesCount, myRating }
        this.router.get(`${this.path}/:postId`, requireAuth, this.getSummary);

        // PUT /api/ratings/:postId -> ustaw / zmień ocenę (upsert)
        this.router.put(`${this.path}/:postId`, requireAuth, this.setRating);
    }

    private getSummary = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;
        const { postId } = req.params;

        if (!postId) return res.status(400).json({ error: 'Brak parametru postId' });

        // (opcjonalnie) upewniamy się, że post istnieje
        const exists = await Post.exists({ _id: postId });
        if (!exists) return res.status(404).json({ error: 'Post nie istnieje' });

        // moja ocena
        const mine = await Rating.findOne({ userId, postId }).lean();
        const myRating = mine ? (mine as any).value : 0;

        // ^ powyżej byłoby za trudne i niepotrzebne.
        // Zrobimy prostszą i poprawną agregację:
        const stats = await Rating.aggregate([
            { $match: { postId: new mongoose.Types.ObjectId(postId) } },
            {
                $group: {
                    _id: '$postId',
                    avg: { $avg: '$value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const averageRating = stats.length ? stats[0].avg : 0;
        const votesCount = stats.length ? stats[0].count : 0;

        return res.status(200).json({ averageRating, votesCount, myRating });
    };

    private setRating = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;
        const { postId } = req.params;

        const ratingRaw = req.body?.rating;
        const rating = Number(ratingRaw);

        if (!postId) return res.status(400).json({ error: 'Brak parametru postId' });
        if (!ratingRaw || isNaN(rating)) return res.status(400).json({ error: 'Wymagane pole: rating (1-5)' });

        const r = Math.max(1, Math.min(5, rating));

        // post musi istnieć
        const exists = await Post.exists({ _id: postId });
        if (!exists) return res.status(404).json({ error: 'Post nie istnieje' });

        // upsert -> jeśli ocena istnieje: zmień, jeśli nie: dodaj
        await Rating.updateOne(
            { userId, postId },
            { $set: { value: r } },
            { upsert: true }
        );

        // po zapisie zwróć od razu nowe statystyki (żeby frontend nie musiał robić 2 requestów)
        const stats = await Rating.aggregate([
            { $match: { postId: new mongoose.Types.ObjectId(postId) } },
            {
                $group: {
                    _id: '$postId',
                    avg: { $avg: '$value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const averageRating = stats.length ? stats[0].avg : 0;
        const votesCount = stats.length ? stats[0].count : 0;

        return res.status(200).json({ averageRating, votesCount, myRating: r });
    };
}

export default RatingController;
