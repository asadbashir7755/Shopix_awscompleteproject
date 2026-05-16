import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const reqBody = await request.json();
        const { productId, rating, comment } = reqBody;

        if (!productId || !rating || !comment) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        if (rating < 1 || rating > 5) {
            return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
        }

        // Create review
        const [result] = await pool.execute(
            'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
            [productId, userId, rating, comment]
        );

        const reviewId = (result as any).insertId;

        // Recalculate average rating for the product
        const [reviewRows] = await pool.execute(
            'SELECT AVG(rating) as avgRating FROM reviews WHERE product_id = ?',
            [productId]
        );

        const avgRating = (reviewRows as any[])[0].avgRating || 0;

        // Update product rating
        await pool.execute(
            'UPDATE products SET rating = ? WHERE id = ?',
            [avgRating, productId]
        );

        // Get the created review
        const [newReviewRows] = await pool.execute(
            'SELECT * FROM reviews WHERE id = ?',
            [reviewId]
        );

        const newReview = (newReviewRows as any[])[0];

        return NextResponse.json({
            success: true,
            message: "Review submitted successfully",
            review: newReview,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
