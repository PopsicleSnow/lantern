import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import logoSvg from './icon0.svg';
import JournalistEncryptDemo from '@/components/home/JournalistEncryptDemo';
import SourceAnonymityDemo from '@/components/home/SourceAnonymityDemo';
import BountyBoard from '@/components/BountyBoard';

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
                The Safesty Way to Show What&apos;s Below.
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
            <Link href="/journalist/dashboard" className={styles.secondaryButton}>
              Journalist Sign In
            </Link>
          </div>
        </div>
      </section>

      <section id="journalists" className={styles.roleSection}>
        <div className={styles.roleContainer}>
          <span className={styles.roleEyebrow}>For Journalists</span>
          <h2 className={styles.roleTitle}>
            Receive sealed tips,
            <br />
            <span className={styles.roleTitleSecondary}>on your terms.</span>
          </h2>

          <div className={styles.roleGrid}>
            <div className={styles.roleCopy}>
              <p className={styles.roleLead}>
                Iceberg routes verified, classified tips directly to the journalists who cover the beat.
                Cleartext is sealed in the source&apos;s browser to your public key — Iceberg itself
                never sees the message.
              </p>

              <ul className={styles.roleList}>
                <li>
                  <strong>Generate a keypair on first sign in.</strong> Your private key lives only
                  on your device, encrypted by a passphrase you choose. We never get a copy.
                </li>
                <li>
                  <strong>A Fetch.ai agent triages incoming tips</strong> using only metadata —
                  category, urgency, structural quality, source credibility — then routes the
                  sealed envelope to you and any peers covering that beat.
                </li>
                <li>
                  <strong>Decrypt in your browser, rate the tip,</strong> and follow up with the
                  source through your existing SecureDrop. Ratings feed back into source
                  credibility so future signal rises.
                </li>
                <li>
                  <strong>Post a Solana bounty for the beats you want.</strong> Escrow SOL on
                  devnet, set a per-claim payout, and have the agent prefer your inbox for
                  matching tips. Reclaim unspent funds any time.
                </li>
              </ul>

              <div className={styles.roleActions}>
                <Link href="/journalist/dashboard" className={styles.primaryButton}>
                  Sign In to Dashboard
                </Link>
                <Link href="/transparency" className={styles.secondaryButton}>
                  Verify a Public Key
                </Link>
              </div>
            </div>

            <div className={styles.roleVisual}>
              <JournalistEncryptDemo />
            </div>
          </div>
        </div>
      </section>

      <section id="sources" className={styles.roleSectionAlt}>
        <div className={styles.roleContainer}>
          <span className={styles.roleEyebrow}>For Sources</span>
          <h2 className={styles.roleTitle}>
            You speak.
            <br />
            <span className={styles.roleTitleSecondary}>We protect.</span>
          </h2>

          <div className={`${styles.roleGrid} ${styles.roleGridReverse}`}>
            <div className={styles.roleVisual}>
              <SourceAnonymityDemo />
            </div>

            <div className={styles.roleCopy}>
              <p className={styles.roleLead}>
                If you have evidence of wrongdoing, Iceberg is built so the platform itself can&apos;t
                betray you. Your name, your network, your device — none of it touches our servers.
                Only a sealed envelope and a proof you&apos;re a real human.
              </p>

              <ul className={styles.roleList}>
                <li>
                  <strong>Verify humanity, not identity.</strong> World ID gives a one-shot proof
                  you&apos;re a unique person without revealing who you are. Anti-bot, zero
                  knowledge.
                </li>
                <li>
                  <strong>Encryption happens on your device</strong> with TweetNaCl before anything
                  hits the network. Cleartext never leaves your browser.
                </li>
                <li>
                  <strong>Pin your tip to a journalist or beat,</strong> or let the Fetch.ai agent
                  pick the best-matched recipients. Claim a Solana bounty if your tip leads to
                  publication.
                </li>
              </ul>

              <div className={styles.roleActions}>
                <Link href="/submit" className={styles.primaryButton}>
                  Submit a Tip
                </Link>
                <Link href="/how-it-works" className={styles.secondaryButton}>
                  How It Works
                </Link>
              </div>
            </div>
          </div>

          <div id="bounties" className={styles.bountiesBlock}>
            <div className={styles.bountiesHeader}>
              <h3 className={styles.bountiesTitle}>Active bounties</h3>
              <p className={styles.bountiesSub}>
                Journalists escrow SOL on devnet for tips that lead to a published story. Pick a
                beat that fits — the bounty unlocks when the journalist marks the tip as closed.
              </p>
            </div>
            <BountyBoard />
          </div>
        </div>
      </section>
    </main>
  );
}
