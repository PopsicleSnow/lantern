'use client';


import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../app/icon1.png';


export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


  return (
    <>
      {/* Sticky Top Tier */}
      <header style={{
        width: '100%',
        backgroundColor: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          width: '100%',
          padding: '0.75rem 1rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center'
        }}>
          {/* Left: Hamburger Menu */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '0.5rem',
                margin: '-0.5rem' // Increase hit area
              }}
              aria-label="Toggle Menu"
            >
              <div style={{ width: '20px', height: '2px', backgroundColor: 'var(--text-primary)' }}></div>
              <div style={{ width: '20px', height: '2px', backgroundColor: 'var(--text-primary)' }}></div>
              <div style={{ width: '20px', height: '2px', backgroundColor: 'var(--text-primary)' }}></div>
            </button>
          </div>


          {/* Center: Small Logo and Title */}
          <Link href="/" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none'
          }}>
            <Image src={logo} alt="Iceberg Logo" width={24} height={24} style={{ borderRadius: '4px' }} />
            <span style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 'bold',
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>
              Iceberg
            </span>
          </Link>


          {/* Right: Submit Tip Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href="/source" style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              fontFamily: 'Arial, sans-serif'
            }}>
              Submit a Tip
            </Link>
          </div>
        </div>
      </header>


      {/* Static Second Tier (Scrolls out of view) */}
      <div style={{ width: '100%', backgroundColor: 'var(--surface)', zIndex: 900 }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', width: '100%', padding: '0.5rem 1rem 0' }}>
          {/* Top bar with date */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontFamily: 'Arial, sans-serif'
          }}>
            <span>{today} &nbsp; | &nbsp; Today&apos;s Edition</span>
          </div>


        </div>
      </div>


      {/* Slide-out Menu Overlay */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: '55px', // Below sticky header
          left: 0,
          bottom: 0,
          width: '300px',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 999,
          padding: '2rem 1.5rem',
          boxShadow: '4px 0 24px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <nav style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            fontFamily: 'Arial, sans-serif',
            fontSize: '1rem',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            <Link href="/" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>Home</Link>
            <Link href="/how-it-works" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>How It Works</Link>
            <Link href="/transparency" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>Transparency</Link>
          </nav>
        </div>
      )}
      {/* Background Dimmer for Slide-out Menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            top: '55px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 998
          }}
        />
      )}
    </>
  );
}



