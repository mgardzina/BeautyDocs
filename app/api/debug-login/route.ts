
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";

export const dynamic = 'force-dynamic';

// GET endpoint to test password verification manually (simulates lib/auth.ts logic)
export async function GET(request: Request) {
  try {
    const email = "admin@powderbrowsacademy.com.pl";
    const passwordToCheck = "admin1220@#";

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found in DB" });
    }

    const isMatch = await compare(passwordToCheck, user.passwordHash);
    
    // Also re-hash to see what it *should* look like (for debugging)
    const newHash = await hash(passwordToCheck, 12);

    return NextResponse.json({ 
      success: isMatch, 
      userEmail: user.email,
      hashInDbPrefix: user.passwordHash.substring(0, 10) + "...",
      passwordToCheck,
      compareResult: isMatch,
      testNewHashPrefix: newHash.substring(0, 10) + "..."
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
