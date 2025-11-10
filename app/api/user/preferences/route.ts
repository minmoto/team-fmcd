import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { DisplayUnit } from "@/lib/preferences/display-units";

interface UserPreferences {
  displayUnit: DisplayUnit;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  displayUnit: DisplayUnit.SATS,
};

export async function GET() {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user preferences from Stack Auth user serverMetadata
    const preferences = user.serverMetadata?.preferences as UserPreferences | undefined;

    // Return preferences or defaults
    return NextResponse.json(preferences || DEFAULT_PREFERENCES);
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate the request body
    if (!body.displayUnit || !Object.values(DisplayUnit).includes(body.displayUnit)) {
      return NextResponse.json(
        { error: "Invalid display unit. Must be SATS or BTC" },
        { status: 400 }
      );
    }

    const preferences: UserPreferences = {
      displayUnit: body.displayUnit,
    };

    // Get existing server metadata and update preferences
    const existingMetadata = user.serverMetadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      preferences,
    };

    // Update user server metadata with new preferences
    await user.update({
      serverMetadata: updatedMetadata,
    });

    return NextResponse.json({ 
      success: true, 
      preferences,
      message: "Preferences updated successfully" 
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}