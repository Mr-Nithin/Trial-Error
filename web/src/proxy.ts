import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "arc_session";

export function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "mock") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (pathname === "/") {
    return signedIn ? NextResponse.redirect(new URL("/projects", request.url)) : NextResponse.next();
  }

  // Cookie presence is only a hint; the API validates the session and the client redirects on 401.
  if (!signedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/projects/:path*", "/profile"],
};
