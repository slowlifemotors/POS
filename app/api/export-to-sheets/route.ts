/// app/api/export-to-sheets/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

// Fetch POS data — modify this if needed
import { supabase } from "@/lib/supabaseClient";

export async function POST() {
  try {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { error: "Google Sheets environment variables missing" },
        { status: 500 }
      );
    }

    // Authenticate Google Sheets API
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // -----------------------------
    // 1. Fetch POS Data
    // -----------------------------
    const { data, error } = await supabase.from("items").select("*");

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to fetch POS data from Supabase" },
        { status: 500 }
      );
    }

    // -----------------------------
    // 2. Prepare sheet values
    // -----------------------------
    const header = Object.keys(data[0] || {});
    const rows = data.map((item: any) => Object.values(item));

    const values = [header, ...rows];

    // -----------------------------
    // 3. Write to Google Sheets
    // -----------------------------
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true, rows: values.length });

  } catch (err: any) {
    console.error("GOOGLE SHEETS EXPORT ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
