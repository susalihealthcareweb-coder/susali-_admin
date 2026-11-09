// Shared Auth.js settings with no database access, so the proxy can use them.

const secure = process.env.NODE_ENV === "production";
const opts = { httpOnly: true, sameSite: "lax", path: "/", secure };

// Browsers share cookies across ports on localhost, so other Auth.js apps
// (for example another project on :3000) would otherwise overwrite or send a
// cookie this app cannot decrypt. App-specific names keep them apart.
const cookies = {
  sessionToken: { name: `${secure ? "__Secure-" : ""}susali.session-token`, options: opts },
  callbackUrl: { name: `${secure ? "__Secure-" : ""}susali.callback-url`, options: { sameSite: "lax", path: "/", secure } },
  csrfToken: { name: `${secure ? "__Host-" : ""}susali.csrf-token`, options: opts },
};

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  trustHost: true,
  cookies,
  providers: [],
  logger: {
    error(error) {
      // A stale or foreign cookie just means "not logged in"; don't flood the console.
      if (error?.type === "JWTSessionError" || error?.name === "JWTSessionError") return;
      // Wrong password or OTP is a normal failed login, already shown to the user.
      if (error?.type === "CredentialsSignin" || error?.kind === "signIn") return;
      console.error(error);
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user = { ...session.user, id: token.uid, role: token.role };
      return session;
    },
  },
};
