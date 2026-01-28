import Controller from '../interfaces/controller.interface';
import { Router, Response, Request } from 'express';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';

import Favorite from '../modules/schemas/favorite.schema';
import Post from '../modules/schemas/post.schema';

class FavoritesController implements Controller {
    public path = '/api/favorites';
    public router = Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // GET /api/favorites -> zwraca POSTY
        this.router.get(`${this.path}`, requireAuth, this.getMyFavorites);

        // POST /api/favorites/:postId -> dodaj do ulubionych
        this.router.post(`${this.path}/:postId`, requireAuth, this.addFavorite);

        // DELETE /api/favorites/:postId -> usuń z ulubionych
        this.router.delete(`${this.path}/:postId`, requireAuth, this.removeFavorite);
    }

    // 1) pobierz moje ulubione jako listę POSTÓW
    private getMyFavorites = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;

        // pobieramy ulubione w kolejności dodania do ulubionych (najnowsze na górze)
        const favs = await Favorite.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        const postIds = favs.map(f => (f as any).postId);

        // jeśli nie ma nic -> od razu zwróć pustą tablicę
        if (postIds.length === 0) {
            return res.status(200).json([]);
        }

        // pobierz posty po ID
        const posts = await Post.find({ _id: { $in: postIds } }).lean();

        // UWAGA: $in nie gwarantuje kolejności -> układamy według favs
        const postsById = new Map(posts.map(p => [(p as any)._id.toString(), p]));
        const ordered = postIds
            .map(id => postsById.get(id.toString()))
            .filter(Boolean);

        return res.status(200).json(ordered);
    };

    // 2) dodaj do ulubionych
    private addFavorite = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;
        const { postId } = req.params;

        if (!postId) return res.status(400).json({ error: 'Brak parametru postId' });

        // opcjonalnie: sprawdź czy post istnieje
        const exists = await Post.exists({ _id: postId });
        if (!exists) return res.status(404).json({ error: 'Post nie istnieje' });

        try {
            await Favorite.create({ userId, postId });
            return res.status(201).json({ ok: true });
        } catch (e: any) {
            // jeśli już istnieje (unikalny indeks) -> traktujemy jak OK
            if (e?.code === 11000) return res.status(200).json({ ok: true });
            return res.status(500).json({ error: 'Błąd serwera' });
        }
    };

    // 3) usuń z ulubionych
    private removeFavorite = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;
        const { postId } = req.params;

        if (!postId) return res.status(400).json({ error: 'Brak parametru postId' });

        await Favorite.deleteOne({ userId, postId });
        return res.status(200).json({ ok: true });
    };
}

export default FavoritesController;
