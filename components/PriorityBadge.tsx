interface PriorityBadgeProps {
  priority: 'high' | 'standard';
  urgency?: 'low' | 'medium' | 'high';
}

export default function PriorityBadge({ priority, urgency }: PriorityBadgeProps) {
  const isHigh = priority === 'high' || urgency === 'high';
  const label = urgency ?? priority;

  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '0.2rem 0.6rem',
        border: `1px solid ${isHigh ? 'var(--warning)' : 'var(--border)'}`,
        color: isHigh ? 'var(--warning)' : 'var(--text-secondary)',
        backgroundColor: 'transparent',
      }}
    >
      {label}
    </span>
  );
}
