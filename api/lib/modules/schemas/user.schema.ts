import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    gender: {
      type: String,
      required: true,
      enum: ['male', 'female', 'other']
    },

    // domyślny avatar, później user go zmieni po zalogowaniu
    avatarUrl: { type: String, required: true }
  },
  {
    timestamps: true // ✅ doda createdAt i updatedAt automatycznie
  }
);

export default mongoose.model('User', userSchema);
