import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import User from '../schemas/user.schema';
import { config } from '../../config';

type Gender = 'male' | 'female' | 'other';

function defaultAvatar(gender: Gender): string {
  // ✅ możesz dać później lokalne assety / linki
  if (gender === 'male') return 'https://api.dicebear.com/7.x/thumbs/svg?seed=male';
  if (gender === 'female') return 'https://api.dicebear.com/7.x/thumbs/svg?seed=female';
  return 'https://api.dicebear.com/7.x/thumbs/svg?seed=other';
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

    await User.findByIdAndDelete(userId);
  }

  async logout(_userId: string) {
    return { ok: true };
  }
}
