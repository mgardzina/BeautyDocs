import { NextResponse } from "next/server";
import { legacyDatabase } from "@/lib/legacy-database";
import { auth } from "@/lib/auth";

// DELETE - Usunięcie notatki
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { noteId } = await params;

    await legacyDatabase.clientNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania notatki:", error);
    return NextResponse.json(
      { success: false, error: "Błąd usuwania notatki" },
      { status: 500 }
    );
  }
}
