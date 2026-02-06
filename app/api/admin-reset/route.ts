
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Only verify the user we want to change
    const email = "admin@powderbrowsacademy.com.pl";
    const password = "admin1220@#"; 
    
    // Check if user exists first
    const user = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const hashedPassword = await hash(password, 12);
    
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash: hashedPassword }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Password updated for ${email}` 
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
