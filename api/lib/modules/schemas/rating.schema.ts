import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
        value: { type: Number, required: true, min: 1, max: 5 }
    },
    { timestamps: true }
);

// 1 user może mieć tylko 1 ocenę na 1 post
ratingSchema.index({ userId: 1, postId: 1 }, { unique: true });

export default mongoose.model('Rating', ratingSchema);
