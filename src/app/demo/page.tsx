import { redirect } from "next/navigation";
import { ENABLE_DEMO_MODE } from "@/lib/config";

export default function Page() {
  if (!ENABLE_DEMO_MODE) redirect("/sign-in");
  redirect("/app");
}
