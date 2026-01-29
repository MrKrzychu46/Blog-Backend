import Controller from '../interfaces/controller.interface';
import { Response, NextFunction, Router, Request } from 'express';
import { checkPostCount } from "../middlewares/checkPostCount.middleware";
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import { postImageUpload } from '../middlewares/postImageUpload.middleware';
import Rating from '../modules/schemas/rating.schema';

import Post from '../modules/schemas/post.schema';
import User from '../modules/schemas/user.schema';
import { config } from '../config';


class PostController implements Controller {
  public path = '/api/posts';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Wszystkie posty
    this.router.get(`${this.path}`, this.getAll);

    // Moje posty (profil)
    this.router.get(`${this.path}/me`, requireAuth, this.getMyPosts);

    // N pierwszych
    this.router.get(`${this.path}/n/:num`, checkPostCount, this.getN);

    // Po ID
    this.router.get(`${this.path}/:id`, this.getById);

    // Dodanie posta (multipart + auth)
    this.router.post(
      `${this.path}`,
      requireAuth,
      postImageUpload.single('image'),
      this.addPost
    );

    // Usunięcie posta po ID (na razie bez sprawdzania autora — można dodać później)
    this.router.delete(`${this.path}/:id`, requireAuth, this.deleteById);
  }

    private getAll = async (_req: Request, res: Response) => {
        const posts = await Post.find().sort({ createdAt: -1 }).lean();

        const postIds = posts.map(p => (p as any)._id);

        const stats = await Rating.aggregate([
            { $match: { postId: { $in: postIds } } },
            {
                $group: {
                    _id: '$postId',
                    avg: { $avg: '$value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map<string, { avg: number; count: number }>();
        stats.forEach(s => statsMap.set(String(s._id), { avg: s.avg, count: s.count }));

        const enriched = posts.map(p => {
            const id = String((p as any)._id);
            const st = statsMap.get(id);
            return {
                ...p,
                averageRating: st ? st.avg : 0,
                votesCount: st ? st.count : 0
            };
        });

        res.status(200).json(enriched);
    };


    private getMyPosts = async (req: AuthRequest, res: Response) => {
        const userId = req.user!.userId;

        const posts = await Post.find({ authorId: userId }).sort({ createdAt: -1 }).lean();
        const postIds = posts.map(p => (p as any)._id);

        const stats = await Rating.aggregate([
            { $match: { postId: { $in: postIds } } },
            {
                $group: {
                    _id: '$postId',
                    avg: { $avg: '$value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map<string, { avg: number; count: number }>();
        stats.forEach(s => statsMap.set(String(s._id), { avg: s.avg, count: s.count }));

        const enriched = posts.map(p => {
            const id = String((p as any)._id);
            const st = statsMap.get(id);
            return {
                ...p,
                averageRating: st ? st.avg : 0,
                votesCount: st ? st.count : 0
            };
        });

        res.status(200).json(enriched);
    };


    private getById = async (req: Request, res: Response) => {
    const { id } = req.params;

    const post = await Post.findById(id).lean();
    if (!post) {
      return res.status(404).json({ error: `Nie znaleziono posta o id: ${id}` });
    }

    // ✅ doklejamy authorName
    let authorName = 'Nieznany';
    let authorEmail: string | undefined;

    try {
      const user = await User.findById((post as any).authorId).lean();
      const firstName = (user as any)?.firstName?.trim();
      const lastName = (user as any)?.lastName?.trim();

      authorName =
        firstName || lastName
          ? `${firstName ?? ''} ${lastName ?? ''}`.trim()
          : ((user as any)?.login || (user as any)?.email || 'Nieznany');

      authorEmail = (user as any)?.email;
    } catch {}

    res.status(200).json({
      ...post,
      authorName,
      authorEmail
    });
  };

  private addPost = async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const authorId = req.user!.userId;

    const title = String(req.body?.title ?? '').trim();
    const text = String(req.body?.text ?? '').trim();

    const file = (req as any).file;
    if (!title || !text) {
      return res.status(400).json({ error: 'Wymagane pola: title, text' });
    }
    if (!file) {
      return res.status(400).json({ error: 'Wymagane pole: image (plik)' });
    }

      const imageUrl = `${config.baseUrl}/uploads/posts/${file.filename}`;

      const created = await Post.create({
      title,
      text,
      image: imageUrl,
      authorId
    });

    // zwracamy gotowego posta z bazy (ma _id i createdAt)
    const saved = await Post.findById(created._id).lean();
    res.status(201).json(saved);
  };

  private deleteById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: `Nie znaleziono posta o id: ${id}` });
    }

    // (opcjonalnie) tylko autor może usuwać:
    // if (post.authorId.toString() !== req.user!.userId) {
    //   return res.status(403).json({ error: 'Brak uprawnień' });
    // }

    await Post.findByIdAndDelete(id);
    res.status(200).json({ ok: true });
  };

    private getN = async (req: Request, res: Response) => {
        const num = Number(req.params.num);
        if (isNaN(num) || num <= 0) {
            return res.status(400).json({ error: 'Parametr N musi być dodatnią liczbą całkowitą.' });
        }

        const posts = await Post.find().sort({ createdAt: -1 }).limit(num).lean();
        const postIds = posts.map(p => (p as any)._id);

        const stats = await Rating.aggregate([
            { $match: { postId: { $in: postIds } } },
            {
                $group: {
                    _id: '$postId',
                    avg: { $avg: '$value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map<string, { avg: number; count: number }>();
        stats.forEach(s => statsMap.set(String(s._id), { avg: s.avg, count: s.count }));

        const enriched = posts.map(p => {
            const id = String((p as any)._id);
            const st = statsMap.get(id);
            return {
                ...p,
                averageRating: st ? st.avg : 0,
                votesCount: st ? st.count : 0
            };
        });

        res.status(200).json(enriched);
    };

}

export default PostController;
