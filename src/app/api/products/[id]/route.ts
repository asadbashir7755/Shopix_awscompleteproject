import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { sendProductsClearedEmail } from "@/src/services/storeEmail";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary, deleteFromCloudinary } from "@/src/services/cloudinary";
import bcrypt from "bcryptjs";

export async function PUT(
    request: NextRequest,
    context: any
) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const p = (await context.params) as { id: string };
        const id = p.id;

        // Check if product exists and belongs to user
        const [productRows] = await pool.execute(
            'SELECT * FROM products WHERE id = ? AND seller_id = ?',
            [id, userId]
        );

        if ((productRows as any[]).length === 0) {
            return NextResponse.json({ error: "Product not found or unauthorized", success: false }, { status: 404 });
        }

        const product = (productRows as any[])[0];

        const formData = await request.formData();
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const price = Number(formData.get("price"));
        const quantity = Number(formData.get("quantity"));
        const file = formData.get("image") as File;

        const updates: any = {};
        if (name) updates.name = name;
        if (description) {
            if (description.length > 250) {
                return NextResponse.json({ error: "Description must be maximum 250 characters", success: false }, { status: 400 });
            }
            updates.description = description;
        }
        if (!isNaN(price)) updates.price = price;
        if (!isNaN(quantity)) updates.quantity = quantity;

        if (file && typeof file !== "string" && file.size > 0) {
            // Delete old image if it exists in Cloudinary
            if (product.image) {
                await deleteFromCloudinary(product.image);
            }

            // Upload new image
            const imageUrl = await uploadToCloudinary(file, "products");
            updates.image = imageUrl;
        }

        // Build update query
        const updateFields = Object.keys(updates);
        if (updateFields.length > 0) {
            const setClause = updateFields.map(field => `${field} = ?`).join(', ');
            const values = updateFields.map(field => updates[field]);
            values.push(id, userId); // for WHERE clause

            await pool.execute(
                `UPDATE products SET ${setClause} WHERE id = ? AND seller_id = ?`,
                values
            );
        }

        // Get updated product
        const [updatedRows] = await pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );

        const updatedProduct = (updatedRows as any[])[0];

        // Cast numeric fields
        const sanitizedProduct = {
            ...updatedProduct,
            price: Number(updatedProduct.price),
            rating: Number(updatedProduct.rating),
            sold: Number(updatedProduct.sold),
            quantity: Number(updatedProduct.quantity)
        };

        return NextResponse.json({ success: true, message: "Product updated successfully", data: sanitizedProduct }, { status: 200 });

    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}

export async function DELETE(
    request: NextRequest,
    context: any
) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const p = (await context.params) as { id: string };
        const id = p.id;

        // Get user info
        const [userRows] = await pool.execute(
            'SELECT id, name, email, password, role FROM users WHERE id = ?',
            [userId]
        );

        if ((userRows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 });
        }

        const user = (userRows as any[])[0];
        const isAdmin = user.role === "admin";

        // Delete all products for a specific user if id is 'all'
        if (id === "all") {
            const { password } = await request.json();
            if (!password) {
                return NextResponse.json({ error: "Password is required", success: false }, { status: 400 });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return NextResponse.json({ error: "Incorrect password", success: false }, { status: 401 });
            }

            const [storeRows] = await pool.execute(
                'SELECT id, name FROM stores WHERE seller_id = ?',
                [userId]
            );

            if ((storeRows as any[]).length === 0) {
                return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
            }

            const store = (storeRows as any[])[0];

            // Get all products to delete images from Cloudinary
            const [productRows] = await pool.execute(
                'SELECT image FROM products WHERE store_id = ?',
                [store.id]
            );

            // Delete images from Cloudinary
            for (const product of productRows as any[]) {
                if (product.image) {
                    await deleteFromCloudinary(product.image);
                }
            }

            // Delete all products
            await pool.execute('DELETE FROM products WHERE store_id = ?', [store.id]);

            // Send products cleared email notification
            await sendProductsClearedEmail({
                email: user.email,
                sellerName: user.name,
                storeName: store.name
            });

            return NextResponse.json({ success: true, message: "All products deleted successfully" }, { status: 200 });
        }

        // Delete specific product
        let query = 'SELECT * FROM products WHERE id = ?';
        let params: any[] = [id];

        if (!isAdmin) {
            query += ' AND seller_id = ?';
            params.push(userId);
        }

        const [productRows] = await pool.execute(query, params);

        if ((productRows as any[]).length === 0) {
            return NextResponse.json({ error: "Product not found or unauthorized", success: false }, { status: 404 });
        }

        const product = (productRows as any[])[0];

        // Delete image from Cloudinary
        if (product.image) {
            await deleteFromCloudinary(product.image);
        }

        await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        return NextResponse.json({ success: true, message: "Product deleted successfully" }, { status: 200 });

    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}
