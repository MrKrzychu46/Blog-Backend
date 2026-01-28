import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    image: { type: String, required: true }, // URL do /uploads/posts/...
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true } // ✅ createdAt, updatedAt
);

export default mongoose.model('Post', postSchema);
