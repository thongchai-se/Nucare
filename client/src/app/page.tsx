import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function HomePage() {
  const hasAccessToken = Boolean(cookies().get("accessToken")?.value);
  redirect(hasAccessToken ? "/dashboard" : "/login");
}
