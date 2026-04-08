export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-bold">Exchange Tunnel Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: April 8, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
            <p>
              We collect account and platform data required to run Exchange Tunnel, including your name, email,
              connected Facebook account ID, selected Facebook Page ID, campaign/task activity, credits, and related
              timestamps.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Facebook data usage</h2>
            <p>
              We use Facebook data only to support requested features such as login, Page connection, post selection,
              and engagement verification. We do not sell Facebook data and we do not request unnecessary permissions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How we use your data</h2>
            <p>
              Data is used to authenticate users, run campaigns, track credits, prevent abuse, support operations, and
              comply with legal obligations. Access tokens are stored in encrypted form on the backend.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Data retention</h2>
            <p>
              We retain data while your account is active or as needed for fraud prevention, security, tax/accounting,
              and legal compliance. You may request deletion as described below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Sharing</h2>
            <p>
              We do not sell personal data. Data may be shared with service providers strictly for hosting, database,
              and security operations under confidentiality obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Security</h2>
            <p>
              We use reasonable technical and organizational safeguards to protect data. No method of storage or
              transmission is guaranteed to be 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Your rights</h2>
            <p>
              You may request access, correction, or deletion of your data. For deletion requests, see our{" "}
              <a className="text-primary underline underline-offset-2" href="/data-deletion">
                Data Deletion Instructions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>
              For privacy questions, contact:{" "}
              <a className="text-primary underline underline-offset-2" href="mailto:support@exchangetunnel.app">
                support@exchangetunnel.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
