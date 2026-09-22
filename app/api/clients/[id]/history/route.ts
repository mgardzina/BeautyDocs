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
    // 1. Find all forms for this Client
    const forms = await legacyDatabase.consentForm.findMany({
      where: { clientId: id },
      select: { id: true }
    });

    const formIds = forms.map(f => f.id);

    if (formIds.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Fetch history for all these forms
    const history = await legacyDatabase.treatmentHistory.findMany({
      where: { formId: { in: formIds } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching client history:", error);
    return NextResponse.json(
      { error: "Failed to fetch client history" },
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
  
  console.error("[API] POST /api/clients/[id]/history - START", { clientId: id });

  try {
    const body = await request.json();
    const { date, description, znieczulenie } = body;
    
    console.error("[API] Add visit request:", { clientId: id, date, description, znieczulenie });

    if (!date || !description) {
      console.error("[API] Missing date or description");
      return NextResponse.json(
        { error: "Date and description are required" },
        { status: 400 }
      );
    }

    // Parse ISO datetime format from HTML date/time inputs: YYYY-MM-DDTHH:MM
    let parsedDate: Date;
    try {
      console.error("[API] Parsing date:", date);
      parsedDate = new Date(date);
      
      if (isNaN(parsedDate.getTime())) {
        console.error("[API] Invalid date after parsing");
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
      console.error("[API] Date parsed successfully:", parsedDate);
    } catch (err) {
      console.error("[API] Date parsing error:", err);
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    console.error("[API] Finding latest form for client:", id);
    // 1. Find the MOST RECENT form for this client to attach history to
    let latestForm;
    try {
      latestForm = await legacyDatabase.consentForm.findFirst({
        where: { clientId: id },
        orderBy: { createdAt: "desc" }
      });
    } catch (dbError) {
      const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("[API] Database error finding form:", dbErrorMsg);
      return NextResponse.json(
        { 
          error: "Database error finding form",
          details: dbErrorMsg,
          step: "findForm"
        },
        { status: 500 }
      );
    }

    if (!latestForm) {
      console.error("[API] No forms found for client");
      return NextResponse.json(
        { error: "Client has no forms. Cannot attach history." },
        { status: 404 }
      );
    }
    
    console.error("[API] Found form:", latestForm.id);
    console.error("[API] Creating history entry...");

    // 2. Create history entry attached to the latest form
    let newEntry;
    try {
      newEntry = await legacyDatabase.treatmentHistory.create({
        data: {
          formId: latestForm.id,
          date: parsedDate,
          description,
          znieczulenie,
        },
      });
    } catch (createError) {
      const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
      const createErrorStack = createError instanceof Error ? createError.stack : undefined;
      console.error("[API] Database error creating history:", createErrorMsg);
      return NextResponse.json(
        { 
          error: "Database error creating history",
          details: createErrorMsg,
          stack: createErrorStack,
          step: "createHistory",
          data: { formId: latestForm.id, date: parsedDate.toISOString(), description }
        },
        { status: 500 }
      );
    }
    
    console.error("[API] History entry created successfully:", newEntry.id);

    return NextResponse.json(newEntry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[API] Error creating client history:", {
      error: errorMessage,
      stack: errorStack,
      clientId: id,
    });
    
    return NextResponse.json(
      { 
        error: "Failed to create client history",
        details: errorMessage,
        stack: errorStack,
        step: "unknown"
      },
      { status: 500 }
    );
  }
}
