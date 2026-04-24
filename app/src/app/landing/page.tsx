import { redirect } from "next/navigation";

// /landing has moved to /. Keep this redirect so any old links or bookmarks
// still land in the right place.
export default function LandingRedirect(): never {
  redirect("/");
}
