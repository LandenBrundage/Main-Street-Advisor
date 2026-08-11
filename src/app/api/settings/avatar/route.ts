import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    if (ENABLE_DEMO_MODE)
      throw new AppError(
        "DEMO_AVATAR_UNAVAILABLE",
        "Avatar uploads require connected storage and are not persisted in demo mode.",
        400,
      );
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError("INVALID_AVATAR", "Choose an image to upload.", 400);
    const extension = AVATAR_TYPES.get(file.type);
    if (!extension)
      throw new AppError(
        "INVALID_AVATAR_TYPE",
        "Use a JPEG, PNG, or WebP image.",
        400,
      );
    if (file.size > MAX_AVATAR_BYTES)
      throw new AppError(
        "AVATAR_TOO_LARGE",
        "Profile pictures must be 5 MB or smaller.",
        400,
      );
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .single();
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-avatars")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError)
      throw new AppError(
        "AVATAR_UPLOAD_FAILED",
        "Your profile picture could not be uploaded.",
      );
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", user.id);
    if (updateError) {
      await supabase.storage.from("profile-avatars").remove([path]);
      throw new AppError(
        "AVATAR_UPLOAD_FAILED",
        "Your profile picture could not be saved.",
      );
    }
    if (profile?.avatar_path)
      await supabase.storage
        .from("profile-avatars")
        .remove([profile.avatar_path]);
    const { data: signed } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(path, 3600);
    return NextResponse.json({ avatarUrl: signed?.signedUrl || null });
  } catch (error) {
    safeDiagnostic("avatar-upload", error);
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    if (ENABLE_DEMO_MODE)
      return NextResponse.json({ removed: true, avatarUrl: null });
    const { supabase, user } = await requireUser();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .single();
    if (error)
      throw new AppError(
        "AVATAR_REMOVE_FAILED",
        "Your profile picture could not be removed.",
      );
    if (profile?.avatar_path) {
      const { error: removeError } = await supabase.storage
        .from("profile-avatars")
        .remove([profile.avatar_path]);
      if (removeError)
        throw new AppError(
          "AVATAR_REMOVE_FAILED",
          "Your profile picture could not be removed.",
        );
    }
    await supabase
      .from("profiles")
      .update({ avatar_path: null })
      .eq("id", user.id);
    return NextResponse.json({ removed: true, avatarUrl: null });
  } catch (error) {
    safeDiagnostic("avatar-remove", error);
    return apiError(error);
  }
}
