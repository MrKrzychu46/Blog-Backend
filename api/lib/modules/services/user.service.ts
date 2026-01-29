import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import User from '../schemas/user.schema';
import { config } from '../../config';
import fs from 'fs';
import path from 'path';

import Post from '../schemas/post.schema';
import Rating from '../schemas/rating.schema';
import Favorite from '../schemas/favorite.schema';
import crypto from 'crypto';
import { sendVerificationEmail } from './mail.service';

import { getUploadsRootDir } from '../../utils/uploadsDir';


type Gender = 'male' | 'female' | 'other';

function defaultAvatar(gender: Gender): string {
  // ✅ możesz dać później lokalne assety / linki
  if (gender === 'male') return 'https://api.dicebear.com/7.x/personas/svg?seed=Michael-24&size=256&radius=50&backgroundColor=eef2ff&facialHairProbability=100';
  if (gender === 'female') return 'https://api.dicebear.com/7.x/personas/svg?seed=Sophia-24&size=256&radius=50&backgroundColor=eef2ff&facialHairProbability=0';
  return 'https://api.dicebear.com/7.x/personas/svg?seed=Alex-24&size=256&radius=50&backgroundColor=eef2ff&facialHairProbability=20';
}

export class UserService {

  async getMe(userId: string) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('NOT_FOUND');

    return {
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    };
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    gender: Gender;
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      throw new Error('USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const created = await User.create({
      email,
      passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      gender: data.gender,
      avatarUrl: defaultAvatar(data.gender)
    });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h

      await User.findByIdAndUpdate(created._id, {
          verifyTokenHash: tokenHash,
          verifyTokenExpiresAt: expires,
          isVerified: false
      });

      const frontUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const verifyLink = `${frontUrl}/verify?token=${rawToken}`;

      await sendVerificationEmail(created.email, verifyLink);


      return {
      userId: created._id.toString(),
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      gender: created.gender,
      avatarUrl: created.avatarUrl,
      createdAt: created.createdAt
    };
  }

  async authenticate(email: string, password: string) {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('INVALID_CREDENTIALS');

    if (!(user as any).isVerified) throw new Error('NOT_VERIFIED');


      const secret: jwt.Secret = String(config.jwtSecret);
    const signOptions: jwt.SignOptions = { expiresIn: String(config.jwtExpiresIn) as any };

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        avatarUrl: user.avatarUrl
      },
      secret,
      signOptions
    );

    return { token };
  }

  async updateProfile(userId: string, data: { firstName?: any; lastName?: any; gender?: any }) {
    const update: any = {};
    if (data.firstName) update.firstName = String(data.firstName).trim();
    if (data.lastName) update.lastName = String(data.lastName).trim();
    if (data.gender) update.gender = String(data.gender) as Gender;

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
    if (!user) throw new Error('NOT_FOUND');

    return {
      userId: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      avatarUrl: user.avatarUrl
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true }).lean();
    if (!user) throw new Error('NOT_FOUND');

    return {
      userId: user._id.toString(),
      avatarUrl: user.avatarUrl
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error('NOT_FOUND');

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new Error('INVALID_OLD_PASSWORD');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

    async deleteAccount(userId: string, password: string) {
        const user = await User.findById(userId);
        if (!user) throw new Error('NOT_FOUND');

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new Error('INVALID_PASSWORD');

        // 1) Pobierz wszystkie posty usera (żeby znać obrazki)
        const myPosts = await Post.find({ authorId: userId }).lean();
        const postIds = myPosts.map(p => (p as any)._id);
        await Rating.deleteMany({ postId: { $in: postIds } });
        await Favorite.deleteMany({ postId: { $in: postIds } });


        // 2) Usuń pliki obrazków postów
        for (const p of myPosts) {
            try {
                const imageUrl = String((p as any).image ?? '');
                if (!imageUrl) continue;

                // wyciągamy nazwę pliku z URL-a
                const filename = path.basename(new URL(imageUrl).pathname);
                const filePath = path.join(getUploadsRootDir(), 'posts', filename);

                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch {
                // nie blokujemy usuwania konta przez problem z jednym plikiem
            }
        }

        // 3) Usuń avatar z dysku (TYLKO jeśli jest z naszego /uploads/avatars/)
        try {
            const avatarUrl = String((user as any).avatarUrl ?? '');

            // usuwamy tylko avatary hostowane u nas
            if (avatarUrl.includes('/uploads/avatars/')) {
                const filename = path.basename(new URL(avatarUrl).pathname);
                const filePath = path.join(getUploadsRootDir(), 'avatars', filename);

                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        } catch {}

        // 4) Usuń dane powiązane w bazie
        await Rating.deleteMany({ userId });
        await Favorite.deleteMany({ userId });

        // 5) Usuń posty usera
        await Post.deleteMany({ authorId: userId });

        // 6) Usuń usera
        await User.findByIdAndDelete(userId);
    }

    async verifyAccount(token: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            verifyTokenHash: tokenHash,
            verifyTokenExpiresAt: { $gt: new Date() }
        });

        if (!user) throw new Error('INVALID_TOKEN');

        (user as any).isVerified = true;
        (user as any).verifyTokenHash = null;
        (user as any).verifyTokenExpiresAt = null;
        await user.save();
    }



    async logout(_userId: string) {
    return { ok: true };
  }
}
