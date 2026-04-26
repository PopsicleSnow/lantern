import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import logoSvg from './icon0.svg';

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroBackground}></div>
        <Image src={logoSvg} alt="" className={styles.heroLogo} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.title} style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
              ICEBERG<br />
              <span className={styles.titleHighlight} style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', display: 'block', marginTop: '0.5rem' }}>
                The Safesty Way to Show What's Below.
              </span>
            </h1>
            <p className={styles.subtitle}>
              Iceberg is a decentralized whistleblower platform that uses World ID to verify humanity and Fetch.ai agents to autonomously route tips to vetted journalists. Securely submit information and receive anonymous Solana bounties without ever revealing your identity.
            </p>
          </div>
          <div className={styles.actions}>
            <Link href="/submit" className={styles.primaryButton}>
              Submit a Tip
            </Link>
            <Link href="/journalist" className={styles.secondaryButton}>
              Journalist Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.stepsContainer}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '3rem' }}>Follow these steps to protect your anonymity</h2>
          <ol className={styles.stepList}>
            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Choose a safe location</h3>
                <p className={styles.stepDescription}>
                  Never use a work computer or a network monitored by your employer. Find a public, trusted Wi-Fi network.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Verify anonymously via World ID</h3>
                <p className={styles.stepDescription}>
                  Iceberg uses World ID to verify you are a unique human without linking to your real identity or biometric data. This prevents spam while maintaining zero-knowledge privacy.
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Submit securely</h3>
                <p className={styles.stepDescription}>
                  Your data is encrypted locally in your browser before ever hitting the network. Only the journalist holding the private key can decrypt your message.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.directorySection}>
        <div className={styles.directoryContainer}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '3rem' }}>Share documents securely with trusted organizations</h2>
          <div className={styles.directoryGrid}>
            <Link href="/journalist" className={styles.orgCard}>
              <h3 className={styles.orgName}>The Washington Post</h3>
              <p className={styles.orgDescription}>The Washington Post is an American daily newspaper published in Washington, DC.</p>
            </Link>
            <Link href="/journalist" className={styles.orgCard}>
              <h3 className={styles.orgName}>The Guardian</h3>
              <p className={styles.orgDescription}>The Guardian is a British daily newspaper known for independent investigative journalism.</p>
            </Link>
            <Link href="/journalist" className={styles.orgCard}>
              <h3 className={styles.orgName}>Der Spiegel</h3>
              <p className={styles.orgDescription}>The SPIEGEL Group is a German media company that publishes print magazines and online news.</p>
            </Link>
            <Link href="/journalist" className={styles.orgCard}>
              <h3 className={styles.orgName}>Disclose</h3>
              <p className={styles.orgDescription}>A French non-profit investigative media organization dedicated to public interest journalism.</p>
            </Link>
          </div>
          <div style={{ textAlign: 'left', marginTop: '3rem' }}>
            <Link href="/journalist" className={styles.secondaryButton}>
              See all verified journalists
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.featuresContainer}>
          <h2 className={styles.sectionTitle}>What Iceberg does</h2>
          <div className={styles.featuresGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3 className={styles.featureTitle}>End-to-End Encryption</h3>
              <p className={styles.featureText}>
                Encrypts your data in transit and at rest. TweetNaCl encryption runs entirely client-side before submission.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <h3 className={styles.featureTitle}>Minimizes Metadata</h3>
              <p className={styles.featureText}>
                Iceberg does not log your IP address, browser, or device details. We intentionally know as little about you as possible.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><line x1="8" y1="2" x2="8" y2="22"></line><line x1="16" y1="2" x2="16" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
              </div>
              <h3 className={styles.featureTitle}>No Third Parties</h3>
              <p className={styles.featureText}>
                No centralized intermediaries can read or intercept tips. Autonomous Fetch.ai agents route information directly to vetted journalists.
              </p>
            </article>

            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
              </div>
              <h3 className={styles.featureTitle}>Free & Open Source</h3>
              <p className={styles.featureText}>
                The platform is licensed as free and open source software. Public key transparency prevents key substitution attacks.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.manifestoSection}>
        <div className={styles.manifestoContent}>
          <blockquote className={styles.manifestoText}>
            "We handle the complex encryption locally on your device before any data is sent over the network.
            Not even the servers hosting The Iceberg can read your submissions. We are the tip of the iceberg;
            the truth lies beneath the surface."
          </blockquote>
          <div className={styles.manifestoAuthor}>— The Essence of the Idea</div>
        </div>
      </section>

    </main>
  );
}
