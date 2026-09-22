
import { NextRequest, NextResponse } from "next/server";
import { legacyDatabase } from "@/lib/legacy-database";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const history = await legacyDatabase.treatmentHistory.findMany({
      where: { formId: id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching treatment history:", error);
    return NextResponse.json(
      { error: "Failed to fetch treatment history" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { date, description } = body;

    if (!date || !description) {
      return NextResponse.json(
        { error: "Date and description are required" },
        { status: 400 }
      );
    }

    const newEntry = await legacyDatabase.treatmentHistory.create({
      data: {
        formId: id,
        date: new Date(date),
        description,
      },
    });

    return NextResponse.json(newEntry);
  } catch (error) {
    console.error("Error creating treatment history:", error);
    return NextResponse.json(
      { error: "Failed to create treatment history" },
      { status: 500 }
    );
  }
}
