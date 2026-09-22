import { NextResponse } from "next/server";
import { legacyDatabase } from "@/lib/legacy-database";
import { auth } from "@/lib/auth";

// GET - Lista wszystkich klientek
export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clients = await legacyDatabase.client.findMany({
      where: {
        forms: {
          some: {},
        },
      },
      include: {
        _count: {
          select: { forms: true, notes: true },
        },
        forms: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const clientsWithStats = clients.map((client) => ({
      id: client.id,
      imieNazwisko: client.imieNazwisko,
      telefon: client.telefon,
      createdAt: client.createdAt,
      formsCount: client._count.forms,
      notesCount: client._count.notes,
      lastVisit: client.forms[0]?.createdAt || null,
    }));

    return NextResponse.json({ success: true, clients: clientsWithStats });
  } catch (error) {
    console.error("Błąd pobierania klientek:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania klientek" },
      { status: 500 }
    );
  }
}
