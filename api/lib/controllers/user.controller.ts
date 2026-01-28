import Controller from '../interfaces/controller.interface';
import { Request, Response, NextFunction, Router } from 'express';
import { UserService } from '../modules/services/user.service';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import { avatarUpload } from '../middlewares/avatarUpload.middleware';
import { config } from '../config';


class UserController implements Controller {
    public path = '/api/user';
    public router = Router();
    private userService = new UserService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // POST /api/user/create
        this.router.post(`${this.path}/create`, this.create);

        // POST /api/user/auth
        this.router.post(`${this.path}/auth`, this.auth);

        // DELETE /api/user/logout/:id
        this.router.delete(`${this.path}/logout/:id`, this.logout);

        this.router.get(`${this.path}/me`, requireAuth, this.me);
        this.router.put(`${this.path}/me`, requireAuth, this.updateMe);
        this.router.put(`${this.path}/me/password`, requireAuth, this.changePassword);
        this.router.delete(`${this.path}/me`, requireAuth, this.deleteMe);

        this.router.post(
          `${this.path}/me/avatar`,
          requireAuth,
          avatarUpload.single('avatar'),
          this.uploadAvatar
        );
    }


  private create = async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, gender } = req.body;


      if (!email || !password || !firstName || !lastName || !gender) {
        return res.status(400).json({
          error: 'Wymagane pola: email, password, firstName, lastName, gender'
        });
      }

      const result = await this.userService.createUser({
        email: String(email),
        password: String(password),
        firstName: String(firstName),
        lastName: String(lastName),
        gender: String(gender) as any,
      });


      return res.status(201).json(result);
    } catch (e: any) {
      console.error('CREATE USER ERROR:', e);
      if (e?.message === 'USER_EXISTS') {
        return res.status(409).json({ error: 'Użytkownik o takim emailu już istnieje' });
      }
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  };


  private auth = async (req: Request, res: Response) => {
    try {
      const { login, email, password } = req.body;

      // żeby nie rozwalić starego frontu: bierzemy email z email lub login
      const emailValue = email ?? login;

      if (!emailValue || !password) {
        return res.status(400).json({ error: 'Wymagane pola: email/login oraz password' });
      }

      const result = await this.userService.authenticate(String(emailValue), String(password));
      return res.status(200).json(result);
    } catch (e: any) {
      if (e?.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: 'Nieprawidłowy login/email lub hasło' });
      }
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  };


  private logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id;

            if (!id) {
                return res.status(400).json({ error: 'Brak parametru id' });
            }

            await this.userService.logout(String(id));
            return res.status(200).json({ ok: true });
        } catch (e) {
            return res.status(500).json({ error: 'Błąd serwera' });
        }
    };

  private me = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const user = await this.userService.getMe(userId);
    return res.status(200).json(user);
  };

  private updateMe = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { firstName, lastName, gender } = req.body;

      const result = await this.userService.updateProfile(userId, {
        firstName,
        lastName,
        gender
      });

      return res.status(200).json(result);
    } catch (e) {
      return res.status(400).json({ error: 'Nie udało się zaktualizować danych' });
    }
  };

  private changePassword = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'oldPassword i newPassword są wymagane' });
      }

      await this.userService.changePassword(userId, String(oldPassword), String(newPassword));
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      if (e?.message === 'INVALID_OLD_PASSWORD') {
        return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
      }
      return res.status(400).json({ error: 'Nie udało się zmienić hasła' });
    }
  };

  private deleteMe = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Hasło jest wymagane do usunięcia konta' });
      }

      await this.userService.deleteAccount(userId, String(password));
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      if (e?.message === 'INVALID_PASSWORD') {
        return res.status(401).json({ error: 'Nieprawidłowe hasło' });
      }
      return res.status(400).json({ error: 'Nie udało się usunąć konta' });
    }
  };

  private uploadAvatar = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: 'Brak pliku' });
      }

        const avatarUrl = `${config.baseUrl}/uploads/avatars/${file.filename}`;
        const result = await this.userService.updateAvatar(userId, avatarUrl);

      return res.status(200).json(result);
    } catch {
      return res.status(400).json({ error: 'Nie udało się wgrać avatara' });
    }
  };


}

export default UserController;
