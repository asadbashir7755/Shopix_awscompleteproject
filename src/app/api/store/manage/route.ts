import bcrypt from "bcryptjs";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { sendStoreDeletionEmail } from "@/src/services/storeEmail";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary, deleteFromCloudinary } from "@/src/services/cloudinary";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const [storeRows] = await pool.execute(
            `SELECT * FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }
        const store = (storeRows as any[])[0];

        const [userRows] = await pool.execute(
            `SELECT id, email FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((userRows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 });
        }
        const user = (userRows as any[])[0];

        return NextResponse.json({
            success: true,
            store: {
                ...store,
                sellerEmail: user.email
            }
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const formData = await request.formData();
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const type = formData.get("type") as string;
        const file = formData.get("logo") as File;

        const [storeRows] = await pool.execute(
            `SELECT * FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }
        const store = (storeRows as any[])[0];

        const updates: any = {};
        if (name) updates.name = name;
        if (description) updates.description = description;
        if (type) updates.type = type;

        if (file && typeof file !== "string" && file.size > 0) {
            // Delete old logo if it exists in Cloudinary
            if (store.logo) {
                await deleteFromCloudinary(store.logo);
            }
            
            // Upload new logo
            const logoUrl = await uploadToCloudinary(file, "stores");
            updates.logo = logoUrl;
        }

        const fields = Object.keys(updates);
        if (fields.length > 0) {
            const setClause = fields.map((f) => `${f} = ?`).join(", ");
            const values = fields.map((f) => updates[f]);
            values.push(store.id);
            await pool.execute(`UPDATE stores SET ${setClause} WHERE id = ?`, values);
        }

        const [updatedRows] = await pool.execute(`SELECT * FROM stores WHERE id = ? LIMIT 1`, [store.id]);

        return NextResponse.json({ success: true, message: "Store updated successfully", store: (updatedRows as any[])[0] }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const { password } = await request.json();
        if (!password) {
            return NextResponse.json({ error: "Password is required", success: false }, { status: 400 });
        }

        const [userRows] = await pool.execute(
            `SELECT id, name, email, password FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((userRows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 });
        }
        const user = (userRows as any[])[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Incorrect password. Authorization failed.", success: false }, { status: 401 });
        }

        const [storeRows] = await pool.execute(
            `SELECT * FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }
        const store = (storeRows as any[])[0];

        // Delete logo from Cloudinary
        if (store.logo) {
            await deleteFromCloudinary(store.logo);
        }

        await pool.execute(`DELETE FROM stores WHERE id = ?`, [store.id]);

        // Send deletion notification email
        await sendStoreDeletionEmail({
            email: user.email,
            sellerName: user.name,
            storeName: store.name
        });

        return NextResponse.json({ success: true, message: "Store deleted successfully" }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
