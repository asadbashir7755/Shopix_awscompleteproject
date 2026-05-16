import pool from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { sendAccountDeletionEmail } from "@/src/services/welcome";

export async function DELETE(request: NextRequest) {
    try {
        const { userId, password } = await request.json();

        if (!userId || !password) {
            return NextResponse.json({ message: "User ID and password are required", success: false }, { status: 400 });
        }

        const [rows] = await pool.execute(
            `SELECT id, name, email, password, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );

        if ((rows as any[]).length === 0) {
            return NextResponse.json({ message: "User not found", success: false }, { status: 404 });
        }

        const user = (rows as any[])[0];

        if (user.role === "admin") {
            return NextResponse.json({ message: "Admin accounts cannot be deleted", success: false }, { status: 403 });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json({ message: "Incorrect Password", success: false }, { status: 401 });
        }

        const userEmail = user.email;
        const userName = user.name;

        await pool.execute(`DELETE FROM users WHERE id = ?`, [userId]);

        // Send deletion confirmation email
        try {
            await sendAccountDeletionEmail({
                email: userEmail,
                username: userName
            });
        } catch (mailError) {
            console.error("Warning: Deletion confirmation email failed:", mailError);
        }

        const response = NextResponse.json(
            { message: "Account Deleted Successfully", success: true },
            { status: 200 }
        );

        response.cookies.set("Accesstoken", "", { maxAge: 0 });
        response.cookies.set("RefreshToken", "", { maxAge: 0 });

        return response;

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", success: false },
            { status: 500 }
        );
    }
}
